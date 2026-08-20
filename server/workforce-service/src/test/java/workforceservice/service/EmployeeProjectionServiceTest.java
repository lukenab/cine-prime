package workforceservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import movie.theater.common.event.CanonicalEventEnvelope;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import workforceservice.entity.EmployeeProjection;
import workforceservice.repository.WorkforceStore;
import java.time.OffsetDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EmployeeProjectionServiceTest {
    private WorkforceStore store;
    private EmployeeProjectionService service;
    private ObjectMapper mapper;

    @BeforeEach
    void setup() {
        store = mock(WorkforceStore.class);
        mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        service = new EmployeeProjectionService(mapper, store);
    }

    @Test
    void projectsLatestAssignmentAndClusterScope() throws Exception {
        when(store.findProjectionForUpdate("account-1")).thenReturn(Optional.empty());
        var payload = new EmployeeProjectionService.Payload("account-1", "EMPLOYEE", "ACTIVE", List.of("45"), 3);
        var event = new CanonicalEventEnvelope<>("event-1", "STAFF_ACCESS_UPDATED", "1", OffsetDateTime.now(), "corr-1", null, "user-service", payload);

        assertEquals(EmployeeProjectionService.ProjectionResult.PROJECTED, service.project(mapper.writeValueAsString(event)));
        ArgumentCaptor<EmployeeProjection> captor = ArgumentCaptor.forClass(EmployeeProjection.class);
        verify(store).save(captor.capture());
        assertTrue(captor.getValue().isAssignmentActive());
        assertEquals(List.of("45"), captor.getValue().clusterIds());
        assertEquals(3, captor.getValue().getLastAssignmentVersion());
    }

    @Test
    void duplicateEventIsIdempotent() throws Exception {
        EmployeeProjection current = EmployeeProjection.builder().accountId("account-1").lastEventId("event-1").lastAssignmentVersion(3).build();
        when(store.findProjectionForUpdate("account-1")).thenReturn(Optional.of(current));
        var payload = new EmployeeProjectionService.Payload("account-1", "EMPLOYEE", "ACTIVE", List.of("45"), 3);
        var event = new CanonicalEventEnvelope<>("event-1", "STAFF_ACCESS_UPDATED", "1", OffsetDateTime.now(), "corr-1", null, "user-service", payload);

        assertEquals(EmployeeProjectionService.ProjectionResult.DUPLICATE, service.project(mapper.writeValueAsString(event)));
        verify(store, never()).save(any());
    }
}
