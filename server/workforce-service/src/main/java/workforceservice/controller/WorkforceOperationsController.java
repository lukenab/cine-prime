package workforceservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import workforceservice.domain.WorkforceEnums.TimesheetStatus;
import workforceservice.dto.WorkforceDtos.*;
import workforceservice.service.WorkforceApplicationService;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@RestController @RequestMapping("/api/workforce/admin") @RequiredArgsConstructor
public class WorkforceOperationsController {
    private final WorkforceApplicationService service;

    @PostMapping("/shift-templates")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_CONFIG')")
    public ApiResponse<TemplateResponse> createTemplate(@Valid @RequestBody CreateTemplateRequest request) {
        return ApiResponse.<TemplateResponse>builder().message("Shift template created.").result(service.createTemplate(request)).build();
    }
    @GetMapping("/shift-templates")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_PLAN')")
    public ApiResponse<List<TemplateResponse>> templates(@RequestParam String clusterId) {
        return ApiResponse.<List<TemplateResponse>>builder().result(service.templates(clusterId)).build();
    }
    @PostMapping("/rosters")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_PLAN')")
    public ApiResponse<RosterResponse> createRoster(@Valid @RequestBody CreateRosterRequest request) {
        return ApiResponse.<RosterResponse>builder().message("Draft roster created.").result(service.createRoster(request)).build();
    }
    @GetMapping("/rosters")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_PLAN')")
    public ApiResponse<List<RosterResponse>> rosters(@RequestParam String clusterId,
                                                     @RequestParam(required=false) LocalDate from,
                                                     @RequestParam(required=false) LocalDate to) {
        return ApiResponse.<List<RosterResponse>>builder().result(service.rosters(clusterId, from, to)).build();
    }
    @PostMapping("/rosters/{rosterId}/shifts")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_PLAN')")
    public ApiResponse<ShiftResponse> addShift(@PathVariable String rosterId, @Valid @RequestBody AddShiftRequest request) {
        return ApiResponse.<ShiftResponse>builder().message("Shift assigned.").result(service.addShift(rosterId, request)).build();
    }
    @PostMapping("/rosters/{rosterId}/publish")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_PUBLISH')")
    public ApiResponse<RosterResponse> publish(@PathVariable String rosterId) {
        return ApiResponse.<RosterResponse>builder().message("Roster published.").result(service.publishRoster(rosterId)).build();
    }
    @GetMapping("/timesheets")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','TIMESHEET_REVIEW')")
    public ApiResponse<List<TimesheetResponse>> timesheets(@RequestParam String clusterId,
                                                           @RequestParam(required=false) TimesheetStatus status) {
        return ApiResponse.<List<TimesheetResponse>>builder().result(service.clusterTimesheets(clusterId, status)).build();
    }
    @GetMapping("/timesheets/monthly")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','TIMESHEET_REVIEW')")
    public ApiResponse<List<MonthlySummaryResponse>> monthly(@RequestParam String clusterId,
                                                             @RequestParam(required=false) YearMonth month) {
        return ApiResponse.<List<MonthlySummaryResponse>>builder().result(service.clusterMonthlySummary(clusterId, month)).build();
    }
    @PostMapping("/timesheets/{timesheetId}/approve")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','TIMESHEET_REVIEW')")
    public ApiResponse<TimesheetResponse> approve(@PathVariable String timesheetId, @Valid @RequestBody(required=false) ReviewRequest request) {
        return ApiResponse.<TimesheetResponse>builder().message("Timesheet approved.").result(service.reviewTimesheet(timesheetId, true, request)).build();
    }
    @PostMapping("/timesheets/{timesheetId}/reject")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','TIMESHEET_REVIEW')")
    public ApiResponse<TimesheetResponse> reject(@PathVariable String timesheetId, @Valid @RequestBody(required=false) ReviewRequest request) {
        return ApiResponse.<TimesheetResponse>builder().message("Timesheet rejected.").result(service.reviewTimesheet(timesheetId, false, request)).build();
    }
    @PostMapping("/timesheets/{timesheetId}/lock")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','TIMESHEET_REVIEW')")
    public ApiResponse<TimesheetResponse> lock(@PathVariable String timesheetId, @Valid @RequestBody(required=false) ReviewRequest request) {
        return ApiResponse.<TimesheetResponse>builder().message("Timesheet locked for payroll handoff.").result(service.lockTimesheet(timesheetId, request)).build();
    }
    @PostMapping("/attendance-exceptions/{exceptionId}/resolve")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','TIMESHEET_REVIEW')")
    public ApiResponse<ExceptionResponse> resolve(@PathVariable String exceptionId, @Valid @RequestBody ResolveExceptionRequest request) {
        return ApiResponse.<ExceptionResponse>builder().message("Attendance exception resolved.").result(service.resolveException(exceptionId, request)).build();
    }
    @GetMapping("/shift-swaps")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_REQUEST_APPROVE')")
    public ApiResponse<List<SwapResponse>> swaps(@RequestParam String clusterId) { return ApiResponse.<List<SwapResponse>>builder().result(service.pendingSwaps(clusterId)).build(); }
    @PostMapping("/shift-swaps/{requestId}/approve")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_REQUEST_APPROVE')")
    public ApiResponse<SwapResponse> approveSwap(@PathVariable String requestId, @Valid @RequestBody(required=false) ReviewRequest request) { return ApiResponse.<SwapResponse>builder().message("Shift swap approved.").result(service.reviewSwap(requestId, true, request)).build(); }
    @PostMapping("/shift-swaps/{requestId}/reject")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_REQUEST_APPROVE')")
    public ApiResponse<SwapResponse> rejectSwap(@PathVariable String requestId, @Valid @RequestBody(required=false) ReviewRequest request) { return ApiResponse.<SwapResponse>builder().message("Shift swap rejected.").result(service.reviewSwap(requestId, false, request)).build(); }
    @GetMapping("/leave-requests")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_REQUEST_APPROVE')")
    public ApiResponse<List<LeaveResponse>> leaves(@RequestParam String clusterId) { return ApiResponse.<List<LeaveResponse>>builder().result(service.pendingLeaves(clusterId)).build(); }
    @PostMapping("/leave-requests/{requestId}/approve")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_REQUEST_APPROVE')")
    public ApiResponse<LeaveResponse> approveLeave(@PathVariable String requestId, @Valid @RequestBody(required=false) ReviewRequest request) { return ApiResponse.<LeaveResponse>builder().message("Leave approved.").result(service.reviewLeave(requestId, true, request)).build(); }
    @PostMapping("/leave-requests/{requestId}/reject")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','WORKFORCE_REQUEST_APPROVE')")
    public ApiResponse<LeaveResponse> rejectLeave(@PathVariable String requestId, @Valid @RequestBody(required=false) ReviewRequest request) { return ApiResponse.<LeaveResponse>builder().message("Leave rejected.").result(service.reviewLeave(requestId, false, request)).build(); }
}
