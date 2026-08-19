package userservice.service;

import jakarta.transaction.Transactional;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import userservice.client.AuthAccountClient;
import userservice.dto.AuthAccountStatusRequest;
import userservice.dto.AuthAccountSummary;
import userservice.dto.AuthAccountInvitationRequest;
import userservice.dto.EmployeeCreateRequest;
import userservice.dto.EmployeeInvitationRequest;
import userservice.dto.EmployeeResponse;
import userservice.dto.EmployeeUpdateRequest;
import userservice.dto.PageResponse;
import userservice.entity.Employee;
import userservice.entity.User;
import userservice.enums.EmployeeStatus;
import userservice.enums.StaffAccessRole;
import userservice.exception.ErrorCode;
import userservice.mapper.EmployeeMapper;
import userservice.messaging.StaffAccessEventPublisher;
import userservice.repository.EmployeeRepository;
import userservice.repository.UserRepository;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmployeeService {

    private static final Set<String> EMPLOYMENT_ROLES = Set.of(
            "EMPLOYEE", "BRANCH_MANAGER", "PROGRAMMING_OPERATOR", "PROGRAMMING_APPROVER",
            "FINANCE_OFFICER", "FINANCE_APPROVER", "COMMERCIAL_MANAGER",
            "SECURITY_AUDITOR", "SYSTEM_ADMIN");

    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final EmployeeMapper employeeMapper;
    private final AuditLogService auditLogService;
    private final AuthAccountClient authAccountClient;
    private final StaffAccessEventPublisher staffAccessEventPublisher;

    @Value("${app.internal-service-key}")
    private String internalServiceKey;

    @Transactional
    public EmployeeResponse createEmployee(EmployeeCreateRequest request) {
        AuthAccountSummary account = authAccountClient
                .getAccount(request.getAccountId(), internalServiceKey)
                .getResult();
        boolean employmentRole = account != null && account.getRoles() != null
                && account.getRoles().stream().anyMatch(EMPLOYMENT_ROLES::contains);
        if (!employmentRole
                || "INACTIVE".equals(account.getStatus())) {
            throw new AppException(ErrorCode.INVALID_EMPLOYEE_ACCOUNT);
        }

        // accountId is the natural idempotency key. Retrying after a timeout returns
        // the original employee instead of creating a duplicate or orphan record.
        var existing = employeeRepository.findByUser_AccountId(request.getAccountId());
        if (existing.isPresent()) {
            return employeeMapper.toEmployeeResponse(existing.get());
        }

        // Kafka profile creation may still be in flight. The account has already been
        // verified through auth-service, so creating the skeleton here is safe and non-blocking.
        User user = userRepository.findById(request.getAccountId()).orElseGet(() ->
                userRepository.save(User.builder()
                        .accountId(request.getAccountId())
                        .email(account.getEmail())
                        .isActive(true)
                        .profileCompleted(false)
                        .build()));

        Employee employee = Employee.builder()
                .employeeId(UUID.randomUUID().toString())
                .employeeCode(generateEmployeeCode())
                .user(user)
                .cinemaId(request.getCinemaId())
                .position(request.getPosition())
                .department(request.getDepartment())
                .employmentType(request.getEmploymentType())
                .hireDate(request.getHireDate())
                .status(EmployeeStatus.ACTIVE)
                .accessRole(resolveAccessRole(account))
                .build();

        Employee saved;
        try {
            saved = employeeRepository.saveAndFlush(employee);
        } catch (DataIntegrityViolationException conflict) {
            return employeeRepository.findByUser_AccountId(request.getAccountId())
                    .map(employeeMapper::toEmployeeResponse)
                    .orElseThrow(() -> new AppException(ErrorCode.ACCOUNT_ALREADY_EMPLOYEE));
        }
        auditLogService.log("Employee", saved.getEmployeeId(), "CREATE", null, saved, getCurrentAccountId());
        staffAccessEventPublisher.assignmentCreated(saved);
        return employeeMapper.toEmployeeResponse(saved);
    }

    /**
     * Executes the complete staff invitation as one command from the browser.
     * The employee profile is created locally after auth-service issues the
     * pending account, so this flow does not race the Kafka profile consumer.
     */
    @Transactional
    public EmployeeResponse inviteEmployee(EmployeeInvitationRequest request) {
        AuthAccountSummary account;
        try {
            account = authAccountClient.inviteStaff(
                    internalServiceKey,
                    AuthAccountInvitationRequest.builder()
                            .fullName(request.getFullName().trim())
                            .email(request.getEmail().trim().toLowerCase())
                            .phoneNumber(request.getPhoneNumber())
                            .role(request.getAccessRole().name())
                            .build())
                    .getResult();
        } catch (FeignException.BadRequest exception) {
            // Preserve the auth-service business error at the public boundary. Without
            // this mapping Feign's RuntimeException is converted to a misleading 500.
            if (exception.contentUTF8().contains("\"code\":1011")) {
                throw new AppException(ErrorCode.EMAIL_EXISTED);
            }
            log.warn("Auth service rejected staff invitation for role {}: {}",
                    request.getAccessRole(), exception.contentUTF8());
            throw new AppException(ErrorCode.STAFF_INVITATION_REJECTED);
        }

        if (account == null || account.getAccountId() == null) {
            throw new AppException(ErrorCode.INVALID_EMPLOYEE_ACCOUNT);
        }

        try {
            EmployeeResponse created = createEmployee(EmployeeCreateRequest.builder()
                    .accountId(account.getAccountId())
                    .cinemaId(request.getCinemaId())
                    .position(request.getPosition())
                    .department(request.getDepartment())
                    .employmentType(request.getEmploymentType())
                    .hireDate(request.getHireDate())
                    .build());

            User user = userRepository.findById(account.getAccountId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
            user.setFullName(request.getFullName().trim());
            user.setPhoneNumber(request.getPhoneNumber());
            userRepository.save(user);

            return employeeMapper.toEmployeeResponse(findEmployee(created.getEmployeeId()));
        } catch (RuntimeException failure) {
            // Cross-service transactions cannot roll back the auth database. Make
            // a partial invitation unusable instead of leaving an orphan account.
            authAccountClient.updateStatus(
                    account.getAccountId(),
                    internalServiceKey,
                    new AuthAccountStatusRequest("INACTIVE"));
            throw failure;
        }
    }

    @Transactional
    public EmployeeResponse getEmployeeById(String id) {
        return employeeMapper.toEmployeeResponse(findEmployee(id));
    }

    @Transactional
    public EmployeeResponse getCurrentEmployee() {
        Employee employee = employeeRepository.findByUser_AccountId(getCurrentAccountId())
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_EMPLOYEE_ACCOUNT));
        return employeeMapper.toEmployeeResponse(employee);
    }

    @Transactional
    public PageResponse<EmployeeResponse> getAllEmployees(int page, int size) {
        if (page < 1 || size < 1 || size > 200) {
            throw new AppException(ErrorCode.INVALID_INPUT);
        }
        var pageable = PageRequest.of(page - 1, size);
        Page<Employee> pageData = isBranchManager()
                ? employeeRepository.findAllByCinemaId(currentCinemaId(), pageable)
                : employeeRepository.findAll(pageable);

        return PageResponse.<EmployeeResponse>builder()
                .currentPage(page)
                .totalPages(pageData.getTotalPages())
                .pageSize(pageData.getSize())
                .totalElements(pageData.getTotalElements())
                .data(pageData.getContent().stream().map(employeeMapper::toEmployeeResponse).toList())
                .build();
    }

    @Transactional
    public EmployeeResponse updateEmployee(String id, EmployeeUpdateRequest request) {
        Employee employee = findEmployee(id);
        EmployeeResponse oldData = employeeMapper.toEmployeeResponse(employee);
        employeeMapper.updateEmployee(request, employee);
        Employee saved = employeeRepository.saveAndFlush(employee);
        auditLogService.log("Employee", saved.getEmployeeId(), "UPDATE", oldData, saved, getCurrentAccountId());
        staffAccessEventPublisher.assignmentUpdated(saved);
        return employeeMapper.toEmployeeResponse(saved);
    }

    @Transactional
    public void disableEmployee(String id) {
        Employee employee = findEmployee(id);
        if (EmployeeStatus.DISABLED.equals(employee.getStatus())) {
            throw new AppException(ErrorCode.EMPLOYEE_ALREADY_DISABLED);
        }

        authAccountClient.updateStatus(
                employee.getUser().getAccountId(),
                internalServiceKey,
                new AuthAccountStatusRequest("INACTIVE"));

        EmployeeResponse oldData = employeeMapper.toEmployeeResponse(employee);
        employee.setStatus(EmployeeStatus.DISABLED);
        employee.getUser().setIsActive(false);
        Employee saved = employeeRepository.saveAndFlush(employee);
        auditLogService.log("Employee", saved.getEmployeeId(), "DELETE", oldData, saved, getCurrentAccountId());
        staffAccessEventPublisher.assignmentSuspended(saved);
        log.info("Disabled employee {} and revoked its auth sessions", id);
    }

    @Transactional
    public EmployeeResponse reactivateEmployee(String id) {
        Employee employee = findEmployee(id);
        authAccountClient.updateStatus(
                employee.getUser().getAccountId(),
                internalServiceKey,
                new AuthAccountStatusRequest("ACTIVE"));

        EmployeeResponse oldData = employeeMapper.toEmployeeResponse(employee);
        employee.setStatus(EmployeeStatus.ACTIVE);
        employee.getUser().setIsActive(true);
        Employee saved = employeeRepository.saveAndFlush(employee);
        auditLogService.log("Employee", saved.getEmployeeId(), "REACTIVATE", oldData, saved, getCurrentAccountId());
        staffAccessEventPublisher.assignmentReactivated(saved);
        return employeeMapper.toEmployeeResponse(saved);
    }

    private Employee findEmployee(String id) {
        return employeeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EMPLOYEE_NOT_FOUND));
    }

    private boolean isBranchManager() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_BRANCH_MANAGER"));
    }

    private String currentCinemaId() {
        return employeeRepository.findByUser_AccountId(getCurrentAccountId())
                .map(Employee::getCinemaId)
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_EMPLOYEE_ACCOUNT));
    }

    private String getCurrentAccountId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt.getClaimAsString("accountId");
        }
        return "SYSTEM";
    }

    private String generateEmployeeCode() {
        String employeeCode;
        do {
            employeeCode = "EMP" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        } while (employeeRepository.existsByEmployeeCode(employeeCode));
        return employeeCode;
    }

    private StaffAccessRole resolveAccessRole(AuthAccountSummary account) {
        for (StaffAccessRole role : List.of(
                StaffAccessRole.SYSTEM_ADMIN,
                StaffAccessRole.PROGRAMMING_APPROVER,
                StaffAccessRole.FINANCE_APPROVER,
                StaffAccessRole.FINANCE_OFFICER,
                StaffAccessRole.COMMERCIAL_MANAGER,
                StaffAccessRole.SECURITY_AUDITOR,
                StaffAccessRole.BRANCH_MANAGER,
                StaffAccessRole.PROGRAMMING_OPERATOR,
                StaffAccessRole.EMPLOYEE)) {
            if (account.getRoles().contains(role.name())) {
                return role;
            }
        }
        return StaffAccessRole.EMPLOYEE;
    }
}
