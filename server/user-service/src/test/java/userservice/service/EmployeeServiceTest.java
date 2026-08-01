package userservice.service;

import movie.theater.common.dto.ApiResponse;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import userservice.client.AuthAccountClient;
import userservice.dto.AuthAccountSummary;
import userservice.dto.EmployeeCreateRequest;
import userservice.dto.EmployeeResponse;
import userservice.entity.Employee;
import userservice.mapper.EmployeeMapper;
import userservice.repository.EmployeeRepository;
import userservice.repository.UserRepository;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmployeeServiceTest {

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
