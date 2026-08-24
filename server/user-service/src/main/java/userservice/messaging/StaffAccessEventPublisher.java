package userservice.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.event.CanonicalEventEnvelope;
import movie.theater.common.exception.AppException;
import movie.theater.common.exception.GlobalErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import userservice.entity.Employee;
import userservice.enums.EmployeeDepartment;
import userservice.enums.EmployeePosition;
import userservice.enums.StaffAccessRole;
import userservice.event.StaffAccessEventPayload;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
@RequiredArgsConstructor
@Slf4j
public class StaffAccessEventPublisher {
    public static final String EVENT_VERSION = "2";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${app.kafka.staff-access-topic:staff-access.events.v1}")
    private String topic;

    public void assignmentCreated(Employee employee) {
        publish("STAFF_ACCESS_ASSIGNED", employee);
    }

    public void assignmentUpdated(Employee employee) {
        publish("STAFF_ACCESS_UPDATED", employee);
    }

    public void assignmentSuspended(Employee employee) {
        publish("STAFF_ACCESS_SUSPENDED", employee);
    }

    public void assignmentReactivated(Employee employee) {
        publish("STAFF_ACCESS_REACTIVATED", employee);
    }

    private void publish(String eventType, Employee employee) {
        String accountId = employee.getUser().getAccountId();
        String eventId = UUID.randomUUID().toString();
        CanonicalEventEnvelope<StaffAccessEventPayload> event = new CanonicalEventEnvelope<>(
                eventId,
                eventType,
                EVENT_VERSION,
                OffsetDateTime.now(),
                eventId,
                null,
                "user-service",
                new StaffAccessEventPayload(
                        accountId,
                        accessRole(employee).name(),
                        accessProfile(employee),
                        employee.getStatus().name(),
                        clusterIds(employee),
                        employee.getAssignmentVersion()));
        try {
            kafkaTemplate.send(topic, accountId, event).get(5, TimeUnit.SECONDS);
            log.info("Published {} v{} for account {} at assignment version {}",
                    eventType, EVENT_VERSION, accountId, employee.getAssignmentVersion());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AppException(GlobalErrorCode.UNCATEGORIZED_EXCEPTION);
        } catch (ExecutionException | TimeoutException exception) {
            log.error("Failed to publish {} for account {}", eventType, accountId, exception);
            throw new AppException(GlobalErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    private StaffAccessRole accessRole(Employee employee) {
        if (employee.getAccessRole() != null) {
            return employee.getAccessRole();
        }
        // Compatibility for assignments created before access_role was persisted.
        if (employee.getPosition() == EmployeePosition.CINEMA_MANAGER) {
            return StaffAccessRole.BRANCH_MANAGER;
        }
        if (employee.getPosition() == EmployeePosition.PROGRAMMING_OPERATOR) {
            return StaffAccessRole.PROGRAMMING_OPERATOR;
        }
        return StaffAccessRole.EMPLOYEE;
    }

    private List<String> clusterIds(Employee employee) {
        String cinemaId = employee.getCinemaId();
        return cinemaId == null || cinemaId.isBlank() ? List.of() : List.of(cinemaId.trim());
    }

    private String accessProfile(Employee employee) {
        if (accessRole(employee) != StaffAccessRole.EMPLOYEE) {
            return "NOT_APPLICABLE";
        }
        EmployeeDepartment department = employee.getDepartment();
        if (department == null) {
            return "UNASSIGNED";
        }
        return switch (department) {
            case GENERAL_OPERATIONS, BOX_OFFICE, FOOD_BEVERAGE, FLOOR_GUEST_SERVICES,
                    PROJECTION_TECHNICAL, FACILITIES_MAINTENANCE -> department.name();
            case CONCESSION -> EmployeeDepartment.FOOD_BEVERAGE.name();
            case FLOOR, CUSTOMER_SERVICE -> EmployeeDepartment.FLOOR_GUEST_SERVICES.name();
            case PROJECTION -> EmployeeDepartment.PROJECTION_TECHNICAL.name();
            case MANAGEMENT -> EmployeeDepartment.GENERAL_OPERATIONS.name();
            default -> "UNASSIGNED";
        };
    }
}
