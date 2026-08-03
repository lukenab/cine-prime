package userservice.controller;

import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import userservice.entity.Employee;
import userservice.enums.EmployeeStatus;
import userservice.repository.EmployeeRepository;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InternalEmployeeScopeControllerTest {

    @Test
    void returnsOnlyActivePersistedAssignmentForValidInternalCaller() {
        EmployeeRepository repository = mock(EmployeeRepository.class);
        InternalEmployeeScopeController controller = new InternalEmployeeScopeController(repository);
        ReflectionTestUtils.setField(controller, "configuredInternalKey", "internal-key");
        when(repository.findByUser_AccountId("ACC-1")).thenReturn(Optional.of(
                Employee.builder()
                        .employeeId("EMP-1")
                        .cinemaId("81")
                        .status(EmployeeStatus.ACTIVE)
                        .build()));

        var response = controller.branchScope("ACC-1", "internal-key");

        assertThat(response.getResult().cinemaClusterIds()).containsExactly("81");
    }

    @Test
    void rejectsInvalidInternalCredential() {
        InternalEmployeeScopeController controller = new InternalEmployeeScopeController(
                mock(EmployeeRepository.class));
        ReflectionTestUtils.setField(controller, "configuredInternalKey", "internal-key");

        assertThatThrownBy(() -> controller.branchScope("ACC-1", "wrong-key"))
                .isInstanceOf(AppException.class);
    }
}
