package workforceservice.service;

import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.Test;
import workforceservice.entity.EmployeeShift;
import java.time.OffsetDateTime;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class WorkforcePolicyTest {
    private final OffsetDateTime base = OffsetDateTime.parse("2026-08-24T08:00:00+07:00");

    @Test
    void rejectsOverlappingShift() {
        EmployeeShift existing = EmployeeShift.builder().shiftId("existing").startsAt(base).endsAt(base.plusHours(8)).build();
        assertThrows(AppException.class, () -> WorkforcePolicy.validateNoConflict(base.plusHours(4), base.plusHours(10), List.of(existing), 12));
    }

    @Test
    void rejectsShiftWithoutRequiredRest() {
        EmployeeShift existing = EmployeeShift.builder().shiftId("existing").startsAt(base).endsAt(base.plusHours(8)).build();
        assertThrows(AppException.class, () -> WorkforcePolicy.validateNoConflict(base.plusHours(18), base.plusHours(22), List.of(existing), 12));
    }

    @Test
    void calculatesRegularAndOvertimeFromActualTimeWithoutChangingRawPunches() {
        EmployeeShift shift = EmployeeShift.builder().startsAt(base).endsAt(base.plusHours(8)).breakMinutes(30).build();
        WorkforcePolicy.MinuteBreakdown result = WorkforcePolicy.payableMinutes(shift, base, base.plusHours(9));
        assertEquals(450, result.regular());
        assertEquals(60, result.overtime());
        assertEquals(510, result.payable());
    }
}
