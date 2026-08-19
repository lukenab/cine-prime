package userservice.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import userservice.repository.EmployeeRepository;

/**
 * One-release compatibility bridge for assignments that existed before the
 * projection topic was introduced. Replays are safe because consumers compare
 * the employee assignment version.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(
        name = "app.staff-access-bootstrap-enabled",
        havingValue = "true",
        matchIfMissing = true)
public class StaffAccessProjectionBootstrap {
    private final EmployeeRepository employeeRepository;
    private final StaffAccessEventPublisher eventPublisher;

    @EventListener(ApplicationReadyEvent.class)
    public void republishExistingAssignments() {
        int published = 0;
        for (var employee : employeeRepository.findAll()) {
            try {
                eventPublisher.assignmentUpdated(employee);
                published++;
            } catch (RuntimeException exception) {
                // Keep user-service available; the next restart or an ordinary
                // assignment write will replay this account.
                log.error("Could not bootstrap staff access for employee {}",
                        employee.getEmployeeId(), exception);
            }
        }
        log.info("Staff access bootstrap published {} assignment snapshots", published);
    }
}
