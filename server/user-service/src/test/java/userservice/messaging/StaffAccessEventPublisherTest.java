package userservice.messaging;

import movie.theater.common.event.CanonicalEventEnvelope;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import userservice.entity.Employee;
import userservice.entity.User;
import userservice.enums.EmployeeStatus;
import userservice.enums.StaffAccessRole;
import userservice.event.StaffAccessEventPayload;

import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StaffAccessEventPublisherTest {
    @Test
    void publishesVersionedCanonicalEventsForEveryAssignmentTransition() {
        @SuppressWarnings("unchecked")
        KafkaTemplate<String, Object> kafka = mock(KafkaTemplate.class);
        when(kafka.send(anyString(), anyString(), any()))
                .thenReturn(CompletableFuture.completedFuture(null));
        StaffAccessEventPublisher publisher = new StaffAccessEventPublisher(kafka);
        ReflectionTestUtils.setField(publisher, "topic", "staff-access.events.v1");
        Employee employee = Employee.builder()
                .employeeId("employee-1")
                .user(User.builder().accountId("account-1").build())
                .accessRole(StaffAccessRole.BRANCH_MANAGER)
                .status(EmployeeStatus.ACTIVE)
                .cinemaId("81")
                .assignmentVersion(4)
                .build();

        publisher.assignmentCreated(employee);
        publisher.assignmentUpdated(employee);
        employee.setStatus(EmployeeStatus.DISABLED);
        publisher.assignmentSuspended(employee);
        employee.setStatus(EmployeeStatus.ACTIVE);
        publisher.assignmentReactivated(employee);

        ArgumentCaptor<Object> events = ArgumentCaptor.forClass(Object.class);
        verify(kafka, times(4)).send(eq("staff-access.events.v1"), eq("account-1"), events.capture());
        assertThat(events.getAllValues())
                .extracting(value -> ((CanonicalEventEnvelope<?>) value).eventType())
                .containsExactly(
                        "STAFF_ACCESS_ASSIGNED",
                        "STAFF_ACCESS_UPDATED",
                        "STAFF_ACCESS_SUSPENDED",
                        "STAFF_ACCESS_REACTIVATED");
        CanonicalEventEnvelope<?> first = (CanonicalEventEnvelope<?>) events.getAllValues().getFirst();
        assertThat(first.eventVersion()).isEqualTo("1");
        assertThat(first.producer()).isEqualTo("user-service");
        StaffAccessEventPayload payload = (StaffAccessEventPayload) first.payload();
        assertThat(payload.accountRole()).isEqualTo("BRANCH_MANAGER");
        assertThat(payload.cinemaClusterIds()).isEqualTo(List.of("81"));
        assertThat(payload.assignmentVersion()).isEqualTo(4);
    }
}
