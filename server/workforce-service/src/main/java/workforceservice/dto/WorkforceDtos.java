package workforceservice.dto;

import jakarta.validation.constraints.*;
import workforceservice.domain.WorkforceEnums.*;
import java.time.*;
import java.util.List;

public final class WorkforceDtos {
    private WorkforceDtos() {}

    public record CreateTemplateRequest(
            String clusterId,
            @NotBlank @Size(max=100) String name,
            @NotNull LocalTime startTime,
            @NotNull LocalTime endTime,
            @Min(0) @Max(240) int breakMinutes) {}

    public record TemplateResponse(String templateId, String clusterId, String name, LocalTime startTime,
                                   LocalTime endTime, int breakMinutes, boolean active) {}

    public record CreateRosterRequest(@NotBlank String clusterId, @NotNull LocalDate periodStart,
                                      @NotNull LocalDate periodEnd) {}

    public record AddShiftRequest(@NotBlank String accountId, @NotBlank @Size(max=50) String roleCode,
                                  @NotNull OffsetDateTime startsAt, @NotNull OffsetDateTime endsAt,
                                  @Min(0) @Max(240) int breakMinutes, @Size(max=500) String note) {}

    public record ShiftResponse(String shiftId, String rosterId, String accountId, String clusterId,
                                String roleCode, OffsetDateTime startsAt, OffsetDateTime endsAt,
                                int breakMinutes, ShiftStatus status, String note) {}

    public record RosterResponse(String rosterId, String clusterId, LocalDate periodStart, LocalDate periodEnd,
                                 RosterStatus status, OffsetDateTime publishedAt, List<ShiftResponse> shifts) {}

    public record PunchRequest(OffsetDateTime occurredAt, @Size(max=30) String source) {}
    public record PunchResponse(String punchId, String shiftId, PunchType punchType, OffsetDateTime occurredAt,
                                ShiftStatus shiftStatus, String timesheetId) {}

    public record TimesheetEntryResponse(String entryId, String shiftId, OffsetDateTime actualStart,
                                         OffsetDateTime actualEnd, int regularMinutes, int overtimeMinutes,
                                         int payableMinutes, List<ExceptionResponse> exceptions) {}
    public record ExceptionResponse(String exceptionId, ExceptionCode code, int varianceMinutes,
                                    ExceptionStatus status, String resolutionNote) {}
    public record TimesheetResponse(String timesheetId, String accountId, String clusterId, LocalDate periodStart,
                                    LocalDate periodEnd, TimesheetStatus status, int regularMinutes,
                                    int overtimeMinutes, int exceptionCount, OffsetDateTime submittedAt,
                                    String reviewedBy, OffsetDateTime reviewedAt, String reviewNote,
                                    List<TimesheetEntryResponse> entries) {}
    public record MonthlySummaryResponse(String accountId, String clusterId, YearMonth month,
                                         int regularMinutes, int overtimeMinutes, int payableMinutes,
                                         int openExceptionCount) {}
    public record ReviewRequest(@Size(max=1000) String note) {}
    public record ResolveExceptionRequest(@NotNull ExceptionStatus status, @NotBlank @Size(max=1000) String note) {}

    public record CreateSwapRequest(@NotBlank String sourceShiftId, @NotBlank String targetAccountId,
                                    @Size(max=500) String reason) {}
    public record SwapResponse(String requestId, String sourceShiftId, String requestedBy,
                               String targetAccountId, String reason, RequestStatus status,
                               String reviewedBy, OffsetDateTime reviewedAt, String reviewNote) {}

    public record CreateLeaveRequest(@NotBlank String clusterId, @NotNull LeaveType leaveType,
                                     @NotNull OffsetDateTime startsAt, @NotNull OffsetDateTime endsAt,
                                     @Size(max=500) String reason) {}
    public record LeaveResponse(String requestId, String accountId, String clusterId, LeaveType leaveType,
                                OffsetDateTime startsAt, OffsetDateTime endsAt, String reason,
                                RequestStatus status, String reviewedBy, OffsetDateTime reviewedAt,
                                String reviewNote) {}
}
