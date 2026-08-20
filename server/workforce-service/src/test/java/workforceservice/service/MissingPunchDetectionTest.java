package workforceservice.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import workforceservice.domain.WorkforceEnums.*;
import workforceservice.entity.*;
import workforceservice.repository.WorkforceStore;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MissingPunchDetectionTest {
    @Test
    void createsZeroPayEntryAndMissingClockInExceptionWithoutInventingWorkedTime() {
        WorkforceStore store = mock(WorkforceStore.class);
        WorkforceApplicationService service = new WorkforceApplicationService(store, mock(WorkforceOutboxService.class));
        ReflectionTestUtils.setField(service, "timezone", "Asia/Ho_Chi_Minh");
        ReflectionTestUtils.setField(service, "clockToleranceMinutes", 5);
        OffsetDateTime start = OffsetDateTime.now().minusHours(9);
        EmployeeShift shift = EmployeeShift.builder().shiftId("shift-1").rosterId("roster-1").accountId("employee-1")
                .clusterId("45").roleCode("TEAM_MEMBER").startsAt(start).endsAt(start.plusHours(8))
                .breakMinutes(60).status(ShiftStatus.PUBLISHED).build();
        when(store.shiftsMissingPunch(any())).thenReturn(List.of(shift));
        when(store.punches("shift-1")).thenReturn(List.of());
        when(store.timesheet(eq("employee-1"), eq("45"), any(), any())).thenReturn(Optional.empty());
        when(store.save(any(Timesheet.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(store.save(any(TimesheetEntry.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(store.entries(anyString())).thenReturn(List.of());

        assertEquals(1, service.detectMissingPunches());

        ArgumentCaptor<TimesheetEntry> entry = ArgumentCaptor.forClass(TimesheetEntry.class);
        verify(store).save(entry.capture());
        assertEquals(0, entry.getValue().getPayableMinutes());
        assertEquals(null, entry.getValue().getActualStart());
        assertEquals(null, entry.getValue().getActualEnd());
        ArgumentCaptor<AttendanceException> exception = ArgumentCaptor.forClass(AttendanceException.class);
        verify(store).save(exception.capture());
        assertEquals(ExceptionCode.MISSING_CLOCK_IN, exception.getValue().getExceptionCode());
    }
}
