package userservice.service;

import movie.theater.common.dto.ApiResponse;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import userservice.client.AuthAccountClient;
import userservice.dto.AuthAccountSummary;
import userservice.dto.AuthAccountInvitationRequest;
import userservice.dto.EmployeeCreateRequest;
import userservice.dto.EmployeeInvitationRequest;
import userservice.dto.EmployeeResponse;
import userservice.entity.Employee;
import userservice.entity.User;
import userservice.enums.EmployeeDepartment;
import userservice.enums.EmployeePosition;
import userservice.enums.EmploymentType;
import userservice.enums.StaffAccessRole;
import userservice.mapper.EmployeeMapper;
import userservice.repository.EmployeeRepository;
import userservice.repository.UserRepository;

import java.util.Optional;
import java.util.Set;
import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;

class EmployeeServiceTest {

    @Test
    void inviteEmployeeUsesSingleAuthInvitationAndCreatesAssignment() {
        EmployeeRepository employees = mock(EmployeeRepository.class);
        UserRepository users = mock(UserRepository.class);
        EmployeeMapper mapper = mock(EmployeeMapper.class);
        AuthAccountClient auth = mock(AuthAccountClient.class);
        User user = User.builder().accountId("account-1").email("staff@cineprime.vn").build();
        AuthAccountSummary account = new AuthAccountSummary();
        account.setAccountId("account-1");
        account.setEmail("staff@cineprime.vn");
        account.setStatus("PENDING");
        account.setRoles(Set.of("EMPLOYEE"));
        AtomicReference<Employee> savedEmployee = new AtomicReference<>();

        when(auth.inviteStaff(org.mockito.ArgumentMatchers.eq("test-key"), any(AuthAccountInvitationRequest.class)))
                .thenReturn(ApiResponse.<AuthAccountSummary>builder().result(account).build());
        when(auth.getAccount("account-1", "test-key"))
                .thenReturn(ApiResponse.<AuthAccountSummary>builder().result(account).build());
        when(employees.findByUser_AccountId("account-1")).thenReturn(Optional.empty());
        when(users.findById("account-1")).thenReturn(Optional.of(user));
        when(employees.existsByEmployeeCode(anyString())).thenReturn(false);
        when(employees.saveAndFlush(any(Employee.class))).thenAnswer(invocation -> {
            Employee employee = invocation.getArgument(0);
            savedEmployee.set(employee);
            return employee;
        });
        when(employees.findById(anyString())).thenAnswer(ignored -> Optional.ofNullable(savedEmployee.get()));
        when(mapper.toEmployeeResponse(any(Employee.class))).thenAnswer(invocation -> {
            Employee employee = invocation.getArgument(0);
            return EmployeeResponse.builder().employeeId(employee.getEmployeeId()).build();
        });

        EmployeeService service = new EmployeeService(
                employees, users, mapper, mock(AuditLogService.class), auth);
        ReflectionTestUtils.setField(service, "internalServiceKey", "test-key");

        EmployeeResponse response = service.inviteEmployee(EmployeeInvitationRequest.builder()
                .fullName("Nguyen Van Staff")
                .email("STAFF@cineprime.vn")
                .phoneNumber("0901234567")
                .cinemaId("81")
                .department(EmployeeDepartment.CONCESSION)
                .position(EmployeePosition.STAFF)
                .employmentType(EmploymentType.FULL_TIME)
                .hireDate(LocalDate.now())
                .accessRole(StaffAccessRole.EMPLOYEE)
                .build());

        assertThat(response.getEmployeeId()).isNotBlank();
        assertThat(user.getFullName()).isEqualTo("Nguyen Van Staff");
        assertThat(savedEmployee.get().getCinemaId()).isEqualTo("81");
        verify(auth).inviteStaff(org.mockito.ArgumentMatchers.eq("test-key"), any(AuthAccountInvitationRequest.class));
        verify(users).save(user);
    }

    @Test
    void retryReturnsExistingEmployeeWithoutCreatingAnotherProfile() {
        EmployeeRepository employees = mock(EmployeeRepository.class);
        UserRepository users = mock(UserRepository.class);
        EmployeeMapper mapper = mock(EmployeeMapper.class);
        AuthAccountClient auth = mock(AuthAccountClient.class);
        Employee existing = Employee.builder().employeeId("employee-1").build();
        EmployeeResponse expected = mock(EmployeeResponse.class);
        AuthAccountSummary account = new AuthAccountSummary();
        account.setAccountId("account-1");
        account.setStatus("PENDING");
        account.setRoles(Set.of("EMPLOYEE"));

        when(auth.getAccount("account-1", "test-key"))
                .thenReturn(ApiResponse.<AuthAccountSummary>builder().result(account).build());
        when(employees.findByUser_AccountId("account-1")).thenReturn(Optional.of(existing));
        when(mapper.toEmployeeResponse(existing)).thenReturn(expected);

        EmployeeService service = new EmployeeService(
                employees, users, mapper, mock(AuditLogService.class), auth);
        ReflectionTestUtils.setField(service, "internalServiceKey", "test-key");

        EmployeeResponse actual = service.createEmployee(
                EmployeeCreateRequest.builder().accountId("account-1").build());

        assertThat(actual).isSameAs(expected);
        verify(users, never()).save(org.mockito.ArgumentMatchers.any());
    }
}
