package authservice.service;

import authservice.entity.Account;
import authservice.entity.Role;
import authservice.entity.StaffAccessProjection;
import authservice.repository.StaffAccessProjectionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StaffAccessProjectionServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private final StaffAccessProjectionRepository repository = mock(StaffAccessProjectionRepository.class);
    private final StaffAccessProjectionService service = new StaffAccessProjectionService(objectMapper, repository);

    @Test
    void consumesCanonicalV1ContractAndStoresLastEventAndVersions() {
        when(repository.findByAccountIdForUpdate("account-1")).thenReturn(Optional.empty());

        var result = service.project(event("event-7", "STAFF_ACCESS_ASSIGNED", 7, "ACTIVE", "81", "81"));

        ArgumentCaptor<StaffAccessProjection> captor = ArgumentCaptor.forClass(StaffAccessProjection.class);
        verify(repository).save(captor.capture());
        StaffAccessProjection projection = captor.getValue();
        assertThat(result).isEqualTo(StaffAccessProjectionService.ProjectionResult.PROJECTED);
        assertThat(projection.getAccountRole()).isEqualTo("BRANCH_MANAGER");
        assertThat(projection.isAssignmentActive()).isTrue();
        assertThat(projection.clusterIds()).containsExactly("81");
        assertThat(projection.getLastEventId()).isEqualTo("event-7");
        assertThat(projection.getLastEventVersion()).isEqualTo("1");
        assertThat(projection.getLastAssignmentVersion()).isEqualTo(7);
    }

    @Test
    void duplicateAndOutOfOrderEventsAreIdempotent() {
        StaffAccessProjection current = StaffAccessProjection.builder()
                .accountId("account-1")
                .accountRole("BRANCH_MANAGER")
                .assignmentActive(true)
                .lastEventId("event-7")
                .lastEventVersion("1")
                .lastAssignmentVersion(7)
                .build();
        when(repository.findByAccountIdForUpdate("account-1")).thenReturn(Optional.of(current));

        assertThat(service.project(event("event-7", "STAFF_ACCESS_ASSIGNED", 7, "ACTIVE", "81")))
                .isEqualTo(StaffAccessProjectionService.ProjectionResult.DUPLICATE);
        assertThat(service.project(event("event-6", "STAFF_ACCESS_UPDATED", 6, "ACTIVE", "82")))
                .isEqualTo(StaffAccessProjectionService.ProjectionResult.STALE);
        verify(repository, never()).save(any());
    }

    @Test
    void missingDisabledOrBranchlessProjectionDeniesStaffAuthorization() {
        Account employee = Account.builder()
                .accountId("account-1")
                .roles(Set.of(Role.builder().roleName("EMPLOYEE").build()))
                .build();
        StaffAccessProjection disabled = StaffAccessProjection.builder()
                .accountId("account-1")
                .accountRole("EMPLOYEE")
                .assignmentActive(false)
                .cinemaClusterIds("81")
                .build();
        StaffAccessProjection branchless = StaffAccessProjection.builder()
                .accountId("account-1")
                .accountRole("EMPLOYEE")
                .assignmentActive(true)
                .cinemaClusterIds("")
                .build();
        when(repository.findById("account-1"))
                .thenReturn(Optional.empty(), Optional.of(disabled), Optional.of(branchless));

        assertThat(service.resolve(employee).authorized()).isFalse();
        assertThat(service.resolve(employee).authorized()).isFalse();
        assertThat(service.resolve(employee).authorized()).isFalse();
    }

    @Test
    void activeHeadOfficeAssignmentDoesNotRequireCinemaScope() {
        Account approver = Account.builder()
                .accountId("account-2")
                .roles(Set.of(Role.builder().roleName("FINANCE_APPROVER").build()))
                .build();
        StaffAccessProjection projection = StaffAccessProjection.builder()
                .accountId("account-2")
                .accountRole("FINANCE_APPROVER")
                .assignmentActive(true)
                .cinemaClusterIds("")
                .build();
        when(repository.findById("account-2")).thenReturn(Optional.of(projection));

        var authorization = service.resolve(approver);

        assertThat(authorization.authorized()).isTrue();
        assertThat(authorization.cinemaClusterIds()).isEmpty();
    }

    private String event(String eventId, String eventType, long assignmentVersion, String status, String... clusterIds) {
        try {
            return objectMapper.writeValueAsString(java.util.Map.of(
                    "eventId", eventId,
                    "eventType", eventType,
                    "eventVersion", "1",
                    "occurredAt", "2026-08-18T10:00:00Z",
                    "correlationId", "correlation-1",
                    "producer", "user-service",
                    "payload", java.util.Map.of(
                            "accountId", "account-1",
                            "accountRole", "BRANCH_MANAGER",
                            "assignmentStatus", status,
                            "cinemaClusterIds", java.util.List.of(clusterIds),
                            "assignmentVersion", assignmentVersion)));
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }
}
