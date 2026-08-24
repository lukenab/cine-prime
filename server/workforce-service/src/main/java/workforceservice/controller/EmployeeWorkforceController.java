package workforceservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import workforceservice.domain.WorkforceEnums.PunchType;
import workforceservice.dto.WorkforceDtos.*;
import workforceservice.service.WorkforceApplicationService;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.util.List;

@RestController @RequestMapping("/api/workforce/me") @RequiredArgsConstructor
@PreAuthorize("hasAuthority('WORKFORCE_SELF_READ')")
public class EmployeeWorkforceController {
    private final WorkforceApplicationService service;

    @GetMapping("/shifts")
    public ApiResponse<List<ShiftResponse>> shifts(@RequestParam(required=false) OffsetDateTime from,
                                                    @RequestParam(required=false) OffsetDateTime to) {
        return ApiResponse.<List<ShiftResponse>>builder().result(service.myShifts(from, to)).build();
    }

    @PostMapping("/shifts/{shiftId}/clock-in")
    @PreAuthorize("hasAuthority('ATTENDANCE_CLOCK')")
    public ApiResponse<PunchResponse> clockIn(@PathVariable String shiftId,
                                              @RequestHeader("Idempotency-Key") String key,
                                              @Valid @RequestBody(required=false) PunchRequest request) {
        return ApiResponse.<PunchResponse>builder().message("Clock-in recorded.").result(service.clock(shiftId, PunchType.CLOCK_IN, request, key)).build();
    }

    @PostMapping("/shifts/{shiftId}/clock-out")
    @PreAuthorize("hasAuthority('ATTENDANCE_CLOCK')")
    public ApiResponse<PunchResponse> clockOut(@PathVariable String shiftId,
                                               @RequestHeader("Idempotency-Key") String key,
                                               @Valid @RequestBody(required=false) PunchRequest request) {
        return ApiResponse.<PunchResponse>builder().message("Clock-out recorded and timesheet updated.").result(service.clock(shiftId, PunchType.CLOCK_OUT, request, key)).build();
    }

    @GetMapping("/timesheets")
    public ApiResponse<List<TimesheetResponse>> timesheets() {
        return ApiResponse.<List<TimesheetResponse>>builder().result(service.myTimesheets()).build();
    }

    @GetMapping("/timesheets/monthly")
    public ApiResponse<List<MonthlySummaryResponse>> monthly(@RequestParam(required=false) YearMonth month) {
        return ApiResponse.<List<MonthlySummaryResponse>>builder().result(service.myMonthlySummary(month)).build();
    }

    @PostMapping("/timesheets/{timesheetId}/submit")
    @PreAuthorize("hasAuthority('TIMESHEET_SUBMIT')")
    public ApiResponse<TimesheetResponse> submit(@PathVariable String timesheetId) {
        return ApiResponse.<TimesheetResponse>builder().message("Timesheet submitted for review.").result(service.submitTimesheet(timesheetId)).build();
    }

    @GetMapping("/shift-swaps")
    public ApiResponse<List<SwapResponse>> swaps() { return ApiResponse.<List<SwapResponse>>builder().result(service.mySwaps()).build(); }

    @PostMapping("/shift-swaps")
    @PreAuthorize("hasAuthority('WORKFORCE_REQUEST')")
    public ApiResponse<SwapResponse> createSwap(@Valid @RequestBody CreateSwapRequest request) {
        return ApiResponse.<SwapResponse>builder().message("Shift swap submitted.").result(service.createSwap(request)).build();
    }

    @GetMapping("/leave-requests")
    public ApiResponse<List<LeaveResponse>> leaves() { return ApiResponse.<List<LeaveResponse>>builder().result(service.myLeaves()).build(); }

    @PostMapping("/leave-requests")
    @PreAuthorize("hasAuthority('WORKFORCE_REQUEST')")
    public ApiResponse<LeaveResponse> createLeave(@Valid @RequestBody CreateLeaveRequest request) {
        return ApiResponse.<LeaveResponse>builder().message("Leave request submitted.").result(service.createLeave(request)).build();
    }
}
