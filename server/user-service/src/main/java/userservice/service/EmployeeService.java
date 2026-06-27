package userservice.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import userservice.dto.EmployeeCreateRequest;
import userservice.dto.EmployeeResponse;
import userservice.dto.EmployeeUpdateRequest;
import userservice.dto.PageResponse;
import userservice.entity.Employee;
import userservice.entity.EmployeeStatus;
import userservice.entity.User;
import userservice.exception.ErrorCode;
import userservice.mapper.EmployeeMapper;
import userservice.repository.EmployeeRepository;
import userservice.repository.UserRepository;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class EmployeeService {

    EmployeeRepository employeeRepository;
    UserRepository userRepository;
    EmployeeMapper employeeMapper;
    AuditLogService auditLogService;

    @Transactional
    public EmployeeResponse createEmployee(EmployeeCreateRequest request) {
        // Verify user profile exists before linking it to an employee.
        User user = userRepository.findById(request.getAccountId())
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        // Prevent duplicate employee for same account.
        if (employeeRepository.existsByUser_AccountId(request.getAccountId())) {
            throw new AppException(ErrorCode.ACCOUNT_ALREADY_EMPLOYEE);
        }

        Employee employee = Employee.builder()
                .employeeId(UUID.randomUUID().toString())
                .user(user)
                .position(request.getPosition())
                .hireDate(request.getHireDate())
                .status(EmployeeStatus.ACTIVE)
                .build();

        Employee saved = employeeRepository.save(employee);
        auditLogService.log("Employee", saved.getEmployeeId(), "CREATE", null, saved, getCurrentAccountId());

        log.info("Created employee {} for account {}", saved.getEmployeeId(), request.getAccountId());
        return employeeMapper.toEmployeeResponse(saved);
    }

    @Transactional
    public EmployeeResponse getEmployeeById(String id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EMPLOYEE_NOT_FOUND));
        return employeeMapper.toEmployeeResponse(employee);
    }

    @Transactional
    public PageResponse<EmployeeResponse> getAllEmployees(int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);
        Page<Employee> pageData = employeeRepository.findAll(pageable);

        List<EmployeeResponse> responses = pageData.getContent().stream()
                .map(employeeMapper::toEmployeeResponse)
                .toList();

        return PageResponse.<EmployeeResponse>builder()
                .currentPage(page)
                .totalPages(pageData.getTotalPages())
                .pageSize(pageData.getSize())
                .totalElements(pageData.getTotalElements())
                .data(responses)
                .build();
    }

    @Transactional
    public EmployeeResponse updateEmployee(String id, EmployeeUpdateRequest request) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EMPLOYEE_NOT_FOUND));

        EmployeeResponse oldData = employeeMapper.toEmployeeResponse(employee);

        employeeMapper.updateEmployee(request, employee);

        Employee saved = employeeRepository.save(employee);
        auditLogService.log("Employee", saved.getEmployeeId(), "UPDATE", oldData, saved, getCurrentAccountId());

        return employeeMapper.toEmployeeResponse(saved);
    }

    /**
     * Soft delete: set status = DISABLED (per SRS "delete = change status to Disable")
     */
    @Transactional
    public void disableEmployee(String id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.EMPLOYEE_NOT_FOUND));

        if (EmployeeStatus.DISABLED.equals(employee.getStatus())) {
            throw new AppException(ErrorCode.EMPLOYEE_ALREADY_DISABLED);
        }

        EmployeeResponse oldData = employeeMapper.toEmployeeResponse(employee);

        employee.setStatus(EmployeeStatus.DISABLED);
        Employee saved = employeeRepository.save(employee);

        auditLogService.log("Employee", saved.getEmployeeId(), "DELETE", oldData, saved, getCurrentAccountId());
        log.info("Disabled employee {}", id);
    }

    private String getCurrentAccountId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt.getClaimAsString("accountId");
        }
        return "SYSTEM";
    }
}
