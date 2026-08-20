package workforceservice.service;

import movie.theater.common.exception.AppException;
import workforceservice.entity.EmployeeShift;
import workforceservice.exception.WorkforceErrorCode;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

public final class WorkforcePolicy {
    private WorkforcePolicy() {}

    public static void validatePeriod(LocalDate start, LocalDate end) {
        if (start == null || end == null || end.isBefore(start) || start.plusDays(31).isBefore(end)) {
            throw new AppException(WorkforceErrorCode.INVALID_PERIOD);
        }
    }

    public static void validateShift(OffsetDateTime start, OffsetDateTime end, int breakMinutes) {
        if (start == null || end == null || !end.isAfter(start) || Duration.between(start, end).toHours() > 24
                || breakMinutes < 0 || breakMinutes >= Duration.between(start, end).toMinutes()) {
            throw new AppException(WorkforceErrorCode.INVALID_PERIOD);
        }
    }

    public static void validateNoConflict(OffsetDateTime start, OffsetDateTime end, List<EmployeeShift> nearby, int restHours) {
        for (EmployeeShift other : nearby) {
            if (start.isBefore(other.getEndsAt()) && end.isAfter(other.getStartsAt())) {
                throw new AppException(WorkforceErrorCode.SHIFT_OVERLAP);
            }
            long restBefore = Duration.between(end, other.getStartsAt()).toHours();
            long restAfter = Duration.between(other.getEndsAt(), start).toHours();
            if ((restBefore >= 0 && restBefore < restHours) || (restAfter >= 0 && restAfter < restHours)) {
                throw new AppException(WorkforceErrorCode.MINIMUM_REST_VIOLATION);
            }
        }
    }

    public static LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    public static MinuteBreakdown payableMinutes(EmployeeShift shift, OffsetDateTime actualStart, OffsetDateTime actualEnd) {
        int planned = Math.max(0, (int) Duration.between(shift.getStartsAt(), shift.getEndsAt()).toMinutes() - shift.getBreakMinutes());
        int actual = Math.max(0, (int) Duration.between(actualStart, actualEnd).toMinutes() - shift.getBreakMinutes());
        return new MinuteBreakdown(Math.min(planned, actual), Math.max(0, actual - planned), actual);
    }

    public record MinuteBreakdown(int regular, int overtime, int payable) {}
}
