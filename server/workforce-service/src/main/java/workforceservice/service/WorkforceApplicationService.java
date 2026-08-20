package workforceservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movie.theater.common.security.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import workforceservice.domain.WorkforceEnums.*;
import workforceservice.dto.WorkforceDtos.*;
import workforceservice.entity.*;
import workforceservice.exception.WorkforceErrorCode;
import workforceservice.repository.WorkforceStore;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service @RequiredArgsConstructor
public class WorkforceApplicationService {
    private final WorkforceStore store;
    private final WorkforceOutboxService outbox;

    @Value("${workforce.timezone:Asia/Ho_Chi_Minh}") private String timezone;
    @Value("${workforce.minimum-rest-hours:12}") private int minimumRestHours;
    @Value("${workforce.clock-tolerance-minutes:5}") private int clockToleranceMinutes;

    @Transactional
    public TemplateResponse createTemplate(CreateTemplateRequest request) {
        if (request.startTime().equals(request.endTime())) throw new AppException(WorkforceErrorCode.INVALID_PERIOD);
        if (request.clusterId() != null) requireClusterAccess(request.clusterId());
        OffsetDateTime now = OffsetDateTime.now();
        ShiftTemplate template = ShiftTemplate.builder().templateId(id()).clusterId(clean(request.clusterId()))
                .name(request.name().trim()).startTime(request.startTime()).endTime(request.endTime())
                .breakMinutes(request.breakMinutes()).active(true).createdBy(actor()).createdAt(now).updatedAt(now).build();
        store.save(template); audit("SHIFT_TEMPLATE_CREATED", "SHIFT_TEMPLATE", template.getTemplateId(), template.getName());
        return templateResponse(template);
    }

    @Transactional(readOnly=true)
    public List<TemplateResponse> templates(String clusterId) {
        requireClusterAccess(clusterId);
        return store.templates(clusterId).stream().map(this::templateResponse).toList();
    }

    @Transactional
    public RosterResponse createRoster(CreateRosterRequest request) {
        requireClusterAccess(request.clusterId());
        WorkforcePolicy.validatePeriod(request.periodStart(), request.periodEnd());
        OffsetDateTime now = OffsetDateTime.now();
        RosterPeriod roster = RosterPeriod.builder().rosterId(id()).clusterId(request.clusterId().trim())
                .periodStart(request.periodStart()).periodEnd(request.periodEnd()).status(RosterStatus.DRAFT)
                .createdBy(actor()).createdAt(now).updatedAt(now).build();
        store.save(roster); audit("ROSTER_CREATED", "ROSTER", roster.getRosterId(), request.clusterId());
        return rosterResponse(roster);
    }

    @Transactional(readOnly=true)
    public List<RosterResponse> rosters(String clusterId, LocalDate from, LocalDate to) {
        requireClusterAccess(clusterId);
        LocalDate effectiveFrom = from == null ? LocalDate.now().minusWeeks(4) : from;
        LocalDate effectiveTo = to == null ? LocalDate.now().plusWeeks(8) : to;
        if (effectiveTo.isBefore(effectiveFrom) || ChronoUnit.DAYS.between(effectiveFrom, effectiveTo) > 366) {
            throw new AppException(WorkforceErrorCode.INVALID_PERIOD);
        }
        return store.rosters(clusterId, effectiveFrom, effectiveTo).stream().map(this::rosterResponse).toList();
    }

    @Transactional
    public ShiftResponse addShift(String rosterId, AddShiftRequest request) {
        RosterPeriod roster = roster(rosterId); requireClusterAccess(roster.getClusterId());
        if (roster.getStatus() != RosterStatus.DRAFT) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        WorkforcePolicy.validateShift(request.startsAt(), request.endsAt(), request.breakMinutes());
        ZoneId zone = ZoneId.of(timezone);
        LocalDate startDate = request.startsAt().atZoneSameInstant(zone).toLocalDate();
        LocalDate endDate = request.endsAt().minusNanos(1).atZoneSameInstant(zone).toLocalDate();
        if (startDate.isBefore(roster.getPeriodStart()) || endDate.isAfter(roster.getPeriodEnd())) throw new AppException(WorkforceErrorCode.INVALID_PERIOD);
        requireActiveEmployee(request.accountId(), roster.getClusterId());
        validateAvailability(request.accountId(), request.startsAt(), request.endsAt(), null);
        OffsetDateTime now = OffsetDateTime.now();
        EmployeeShift shift = EmployeeShift.builder().shiftId(id()).rosterId(rosterId).accountId(request.accountId().trim())
                .clusterId(roster.getClusterId()).roleCode(request.roleCode().trim()).startsAt(request.startsAt())
                .endsAt(request.endsAt()).breakMinutes(request.breakMinutes()).status(ShiftStatus.ASSIGNED)
                .note(clean(request.note())).createdBy(actor()).createdAt(now).updatedAt(now).build();
        store.save(shift); audit("SHIFT_ASSIGNED", "SHIFT", shift.getShiftId(), shift.getAccountId());
        return shiftResponse(shift);
    }

    @Transactional
    public RosterResponse publishRoster(String rosterId) {
        RosterPeriod roster = roster(rosterId); requireClusterAccess(roster.getClusterId());
        if (roster.getStatus() != RosterStatus.DRAFT) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        List<EmployeeShift> shifts = store.shiftsByRoster(rosterId);
        if (shifts.isEmpty()) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        shifts.forEach(shift -> {
            requireActiveEmployee(shift.getAccountId(), roster.getClusterId());
            shift.setStatus(ShiftStatus.PUBLISHED); shift.setUpdatedAt(OffsetDateTime.now()); store.save(shift);
        });
        roster.setStatus(RosterStatus.PUBLISHED); roster.setPublishedBy(actor()); roster.setPublishedAt(OffsetDateTime.now()); roster.setUpdatedAt(OffsetDateTime.now());
        store.save(roster); audit("ROSTER_PUBLISHED", "ROSTER", rosterId, shifts.size() + " shifts");
        return rosterResponse(roster);
    }

    @Transactional(readOnly=true)
    public List<ShiftResponse> myShifts(OffsetDateTime from, OffsetDateTime to) {
        OffsetDateTime effectiveFrom = from == null ? OffsetDateTime.now().minusDays(7) : from;
        OffsetDateTime effectiveTo = to == null ? OffsetDateTime.now().plusDays(30) : to;
        if (!effectiveTo.isAfter(effectiveFrom) || Duration.between(effectiveFrom, effectiveTo).toDays() > 120) throw new AppException(WorkforceErrorCode.INVALID_PERIOD);
        return store.shiftsForAccount(actor(), effectiveFrom, effectiveTo).stream().map(this::shiftResponse).toList();
    }

    @Transactional
    public PunchResponse clock(String shiftId, PunchType type, PunchRequest request, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) throw new AppException(WorkforceErrorCode.IDEMPOTENCY_CONFLICT);
        Optional<TimePunch> replay = store.punchByIdempotencyKey(idempotencyKey.trim());
        if (replay.isPresent()) {
            TimePunch punch = replay.get();
            if (!punch.getShiftId().equals(shiftId) || punch.getPunchType() != type) throw new AppException(WorkforceErrorCode.IDEMPOTENCY_CONFLICT);
            EmployeeShift replayShift = shift(shiftId);
            String sheetId = store.entryByShift(shiftId).map(TimesheetEntry::getTimesheetId).orElse(null);
            return punchResponse(punch, replayShift, sheetId);
        }
        EmployeeShift shift = shift(shiftId);
        String current = actor();
        if (!shift.getAccountId().equals(current)) throw new AppException(WorkforceErrorCode.CLUSTER_FORBIDDEN);
        requireActiveEmployee(current, shift.getClusterId());
        OffsetDateTime occurredAt = request == null || request.occurredAt() == null ? OffsetDateTime.now() : request.occurredAt();
        if (occurredAt.isAfter(OffsetDateTime.now().plusMinutes(5))) throw new AppException(WorkforceErrorCode.INVALID_PERIOD);
        List<TimePunch> punches = store.punches(shiftId);
        if (type == PunchType.CLOCK_IN && (!punches.isEmpty() || shift.getStatus() != ShiftStatus.PUBLISHED)) throw new AppException(WorkforceErrorCode.CLOCK_SEQUENCE_INVALID);
        if (type == PunchType.CLOCK_OUT && (punches.size() != 1 || punches.getFirst().getPunchType() != PunchType.CLOCK_IN || shift.getStatus() != ShiftStatus.IN_PROGRESS)) throw new AppException(WorkforceErrorCode.CLOCK_SEQUENCE_INVALID);
        if (type == PunchType.CLOCK_OUT && !occurredAt.isAfter(punches.getFirst().getOccurredAt())) throw new AppException(WorkforceErrorCode.INVALID_PERIOD);
        TimePunch punch = TimePunch.builder().punchId(id()).shiftId(shiftId).accountId(current).punchType(type)
                .occurredAt(occurredAt).recordedAt(OffsetDateTime.now()).idempotencyKey(idempotencyKey.trim())
                .source(request == null || request.source() == null ? "WEB" : request.source().trim()).build();
        store.save(punch);
        String timesheetId = null;
        if (type == PunchType.CLOCK_IN) shift.setStatus(ShiftStatus.IN_PROGRESS);
        else {
            shift.setStatus(ShiftStatus.COMPLETED);
            timesheetId = recordTimesheet(shift, punches.getFirst().getOccurredAt(), occurredAt).getTimesheetId();
        }
        shift.setUpdatedAt(OffsetDateTime.now()); store.save(shift);
        audit(type.name(), "SHIFT", shiftId, occurredAt.toString());
        return punchResponse(punch, shift, timesheetId);
    }

    @Transactional(readOnly=true)
    public List<TimesheetResponse> myTimesheets() {
        return store.timesheetsForAccount(actor()).stream().map(this::timesheetResponse).toList();
    }

    @Transactional(readOnly=true)
    public List<MonthlySummaryResponse> myMonthlySummary(YearMonth month) {
        YearMonth effective = effectiveMonth(month);
        return monthlySummary(store.entriesForAccountBetween(actor(), monthStart(effective), monthEnd(effective)), effective);
    }

    @Transactional(readOnly=true)
    public List<TimesheetResponse> clusterTimesheets(String clusterId, TimesheetStatus status) {
        requireClusterAccess(clusterId);
        return store.timesheetsForCluster(clusterId, status).stream().map(this::timesheetResponse).toList();
    }

    @Transactional(readOnly=true)
    public List<MonthlySummaryResponse> clusterMonthlySummary(String clusterId, YearMonth month) {
        requireClusterAccess(clusterId);
        YearMonth effective = effectiveMonth(month);
        return monthlySummary(store.entriesForClusterBetween(clusterId, monthStart(effective), monthEnd(effective)), effective);
    }

    @Transactional
    public TimesheetResponse submitTimesheet(String timesheetId) {
        Timesheet sheet = timesheet(timesheetId);
        if (!sheet.getAccountId().equals(actor())) throw new AppException(WorkforceErrorCode.CLUSTER_FORBIDDEN);
        if (sheet.getStatus() != TimesheetStatus.OPEN && sheet.getStatus() != TimesheetStatus.REJECTED) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        if (store.entries(timesheetId).isEmpty()) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        sheet.setStatus(TimesheetStatus.SUBMITTED); sheet.setSubmittedAt(OffsetDateTime.now()); sheet.setReviewNote(null); sheet.setUpdatedAt(OffsetDateTime.now());
        store.save(sheet); audit("TIMESHEET_SUBMITTED", "TIMESHEET", timesheetId, null);
        return timesheetResponse(sheet);
    }

    @Transactional
    public TimesheetResponse reviewTimesheet(String timesheetId, boolean approve, ReviewRequest request) {
        Timesheet sheet = timesheet(timesheetId); requireClusterAccess(sheet.getClusterId());
        if (sheet.getStatus() != TimesheetStatus.SUBMITTED) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        String reviewer = actor();
        if (reviewer.equals(sheet.getAccountId())) throw new AppException(WorkforceErrorCode.SELF_APPROVAL_FORBIDDEN);
        if (approve && store.openExceptions(timesheetId) > 0) throw new AppException(WorkforceErrorCode.UNRESOLVED_EXCEPTIONS);
        sheet.setStatus(approve ? TimesheetStatus.APPROVED : TimesheetStatus.REJECTED);
        sheet.setReviewedBy(reviewer); sheet.setReviewedAt(OffsetDateTime.now()); sheet.setReviewNote(request == null ? null : clean(request.note())); sheet.setUpdatedAt(OffsetDateTime.now());
        store.save(sheet); audit(approve ? "TIMESHEET_APPROVED" : "TIMESHEET_REJECTED", "TIMESHEET", timesheetId, sheet.getReviewNote());
        if (approve) {
            store.flush();
            appendTimesheetApproved(sheet);
        }
        return timesheetResponse(sheet);
    }

    @Transactional
    public TimesheetResponse lockTimesheet(String timesheetId, ReviewRequest request) {
        Timesheet sheet = timesheet(timesheetId); requireClusterAccess(sheet.getClusterId());
        if (sheet.getStatus() != TimesheetStatus.APPROVED || store.openExceptions(timesheetId) > 0) {
            throw new AppException(WorkforceErrorCode.INVALID_STATE);
        }
        sheet.setStatus(TimesheetStatus.LOCKED);
        sheet.setReviewNote(request == null || clean(request.note()) == null ? sheet.getReviewNote() : clean(request.note()));
        sheet.setUpdatedAt(OffsetDateTime.now()); store.save(sheet);
        audit("TIMESHEET_LOCKED", "TIMESHEET", timesheetId, sheet.getReviewNote());
        return timesheetResponse(sheet);
    }

    @Transactional
    public ExceptionResponse resolveException(String exceptionId, ResolveExceptionRequest request) {
        AttendanceException exception = store.find(AttendanceException.class, exceptionId).orElseThrow(() -> new AppException(WorkforceErrorCode.NOT_FOUND));
        TimesheetEntry entry = store.find(TimesheetEntry.class, exception.getEntryId()).orElseThrow(() -> new AppException(WorkforceErrorCode.NOT_FOUND));
        Timesheet sheet = timesheet(entry.getTimesheetId()); requireClusterAccess(sheet.getClusterId());
        if (sheet.getStatus() == TimesheetStatus.APPROVED || sheet.getStatus() == TimesheetStatus.LOCKED) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        if (request.status() == ExceptionStatus.OPEN) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        exception.setStatus(request.status()); exception.setResolutionNote(request.note().trim()); exception.setResolvedBy(actor()); exception.setResolvedAt(OffsetDateTime.now());
        store.save(exception); refreshTotals(sheet); audit("ATTENDANCE_EXCEPTION_" + request.status(), "ATTENDANCE_EXCEPTION", exceptionId, request.note());
        return exceptionResponse(exception);
    }

    @Transactional
    public SwapResponse createSwap(CreateSwapRequest request) {
        EmployeeShift source = shift(request.sourceShiftId());
        if (!source.getAccountId().equals(actor())) throw new AppException(WorkforceErrorCode.CLUSTER_FORBIDDEN);
        if (source.getStatus() != ShiftStatus.PUBLISHED || !source.getStartsAt().isAfter(OffsetDateTime.now())) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        if (store.hasActiveSwap(source.getShiftId())) throw new AppException(WorkforceErrorCode.REQUEST_ALREADY_ACTIVE);
        requireActiveEmployee(request.targetAccountId(), source.getClusterId());
        validateAvailability(request.targetAccountId(), source.getStartsAt(), source.getEndsAt(), source.getShiftId());
        OffsetDateTime now = OffsetDateTime.now();
        ShiftSwapRequest swap = ShiftSwapRequest.builder().requestId(id()).sourceShiftId(source.getShiftId()).requestedBy(actor())
                .targetAccountId(request.targetAccountId().trim()).reason(clean(request.reason())).status(RequestStatus.SUBMITTED)
                .createdAt(now).updatedAt(now).build();
        store.save(swap); audit("SHIFT_SWAP_SUBMITTED", "SHIFT_SWAP", swap.getRequestId(), source.getShiftId());
        return swapResponse(swap);
    }

    @Transactional(readOnly=true)
    public List<SwapResponse> mySwaps() { return store.swapsForAccount(actor()).stream().map(this::swapResponse).toList(); }

    @Transactional
    public SwapResponse reviewSwap(String requestId, boolean approve, ReviewRequest request) {
        ShiftSwapRequest swap = store.find(ShiftSwapRequest.class, requestId).orElseThrow(() -> new AppException(WorkforceErrorCode.NOT_FOUND));
        EmployeeShift shift = shift(swap.getSourceShiftId()); requireClusterAccess(shift.getClusterId());
        if (swap.getStatus() != RequestStatus.SUBMITTED || !shift.getStartsAt().isAfter(OffsetDateTime.now())) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        if (approve) {
            requireActiveEmployee(swap.getTargetAccountId(), shift.getClusterId());
            validateAvailability(swap.getTargetAccountId(), shift.getStartsAt(), shift.getEndsAt(), shift.getShiftId());
            shift.setAccountId(swap.getTargetAccountId()); shift.setUpdatedAt(OffsetDateTime.now()); store.save(shift);
        }
        swap.setStatus(approve ? RequestStatus.APPROVED : RequestStatus.REJECTED); swap.setReviewedBy(actor()); swap.setReviewedAt(OffsetDateTime.now()); swap.setReviewNote(request == null ? null : clean(request.note())); swap.setUpdatedAt(OffsetDateTime.now());
        store.save(swap); audit(approve ? "SHIFT_SWAP_APPROVED" : "SHIFT_SWAP_REJECTED", "SHIFT_SWAP", requestId, shift.getShiftId());
        return swapResponse(swap);
    }

    @Transactional
    public LeaveResponse createLeave(CreateLeaveRequest request) {
        requireOwnCluster(request.clusterId());
        WorkforcePolicy.validateShift(request.startsAt(), request.endsAt(), 0);
        OffsetDateTime now = OffsetDateTime.now();
        LeaveRequest leave = LeaveRequest.builder().requestId(id()).accountId(actor()).clusterId(request.clusterId().trim())
                .leaveType(request.leaveType()).startsAt(request.startsAt()).endsAt(request.endsAt()).reason(clean(request.reason()))
                .status(RequestStatus.SUBMITTED).createdAt(now).updatedAt(now).build();
        store.save(leave); audit("LEAVE_SUBMITTED", "LEAVE", leave.getRequestId(), leave.getLeaveType().name());
        return leaveResponse(leave);
    }

    @Transactional(readOnly=true)
    public List<LeaveResponse> myLeaves() { return store.leavesForAccount(actor()).stream().map(this::leaveResponse).toList(); }

    @Transactional
    public LeaveResponse reviewLeave(String requestId, boolean approve, ReviewRequest request) {
        LeaveRequest leave = store.find(LeaveRequest.class, requestId).orElseThrow(() -> new AppException(WorkforceErrorCode.NOT_FOUND));
        requireClusterAccess(leave.getClusterId());
        if (leave.getStatus() != RequestStatus.SUBMITTED) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        if (approve) store.shiftsForAccount(leave.getAccountId(), leave.getStartsAt(), leave.getEndsAt()).stream()
                .filter(s -> s.getStatus() == ShiftStatus.ASSIGNED || s.getStatus() == ShiftStatus.PUBLISHED)
                .forEach(s -> { s.setStatus(ShiftStatus.CANCELLED); s.setUpdatedAt(OffsetDateTime.now()); store.save(s); });
        leave.setStatus(approve ? RequestStatus.APPROVED : RequestStatus.REJECTED); leave.setReviewedBy(actor()); leave.setReviewedAt(OffsetDateTime.now()); leave.setReviewNote(request == null ? null : clean(request.note())); leave.setUpdatedAt(OffsetDateTime.now());
        store.save(leave); audit(approve ? "LEAVE_APPROVED" : "LEAVE_REJECTED", "LEAVE", requestId, leave.getReviewNote());
        return leaveResponse(leave);
    }

    @Transactional(readOnly=true)
    public List<SwapResponse> pendingSwaps(String clusterId) { requireClusterAccess(clusterId); return store.pendingSwaps(clusterId).stream().map(this::swapResponse).toList(); }
    @Transactional(readOnly=true)
    public List<LeaveResponse> pendingLeaves(String clusterId) { requireClusterAccess(clusterId); return store.pendingLeaves(clusterId).stream().map(this::leaveResponse).toList(); }

    @Transactional
    public int detectMissingPunches() {
        OffsetDateTime now = OffsetDateTime.now();
        List<EmployeeShift> missing = store.shiftsMissingPunch(now.minusMinutes(clockToleranceMinutes));
        for (EmployeeShift shift : missing) {
            List<TimePunch> punches = store.punches(shift.getShiftId());
            OffsetDateTime actualStart = punches.isEmpty() ? null : punches.getFirst().getOccurredAt();
            Timesheet sheet = getOrCreateTimesheet(shift, shift.getStartsAt());
            TimesheetEntry entry = store.save(TimesheetEntry.builder().entryId(id()).timesheetId(sheet.getTimesheetId())
                    .shiftId(shift.getShiftId()).actualStart(actualStart).actualEnd(null).regularMinutes(0)
                    .overtimeMinutes(0).payableMinutes(0).createdAt(now).updatedAt(now).build());
            ExceptionCode code = punches.isEmpty() ? ExceptionCode.MISSING_CLOCK_IN : ExceptionCode.MISSING_CLOCK_OUT;
            int variance = (int) Math.min(1440, Math.max(0, Duration.between(shift.getEndsAt(), now).toMinutes()));
            createException(entry, code, variance);
            refreshTotals(sheet);
            store.save(WorkforceAuditLog.builder().auditId(id()).action(code.name()).aggregateType("SHIFT")
                    .aggregateId(shift.getShiftId()).actorAccountId("SYSTEM").details("Detected after shift end")
                    .occurredAt(now).build());
        }
        return missing.size();
    }

    private Timesheet recordTimesheet(EmployeeShift shift, OffsetDateTime actualStart, OffsetDateTime actualEnd) {
        OffsetDateTime now = OffsetDateTime.now();
        Timesheet sheet = getOrCreateTimesheet(shift, shift.getStartsAt());
        if (sheet.getStatus() != TimesheetStatus.OPEN && sheet.getStatus() != TimesheetStatus.REJECTED) throw new AppException(WorkforceErrorCode.INVALID_STATE);
        if (sheet.getStatus() == TimesheetStatus.REJECTED) sheet.setStatus(TimesheetStatus.OPEN);
        WorkforcePolicy.MinuteBreakdown minutes = WorkforcePolicy.payableMinutes(shift, actualStart, actualEnd);
        TimesheetEntry entry = store.entryByShift(shift.getShiftId()).orElseGet(() -> TimesheetEntry.builder()
                .entryId(id()).timesheetId(sheet.getTimesheetId()).shiftId(shift.getShiftId()).createdAt(now).build());
        entry.setActualStart(actualStart); entry.setActualEnd(actualEnd); entry.setRegularMinutes(minutes.regular());
        entry.setOvertimeMinutes(minutes.overtime()); entry.setPayableMinutes(minutes.payable()); entry.setUpdatedAt(now);
        entry = store.save(entry);
        store.exceptions(entry.getEntryId()).stream()
                .filter(e -> e.getStatus() == ExceptionStatus.OPEN && (e.getExceptionCode() == ExceptionCode.MISSING_CLOCK_IN || e.getExceptionCode() == ExceptionCode.MISSING_CLOCK_OUT))
                .forEach(e -> { e.setStatus(ExceptionStatus.RESOLVED); e.setResolutionNote("Completed by a subsequent punch");
                    e.setResolvedBy("SYSTEM"); e.setResolvedAt(now); store.save(e); });
        long late = Duration.between(shift.getStartsAt(), actualStart).toMinutes();
        long early = Duration.between(actualEnd, shift.getEndsAt()).toMinutes();
        if (late > clockToleranceMinutes) createException(entry, ExceptionCode.LATE_CLOCK_IN, (int) late);
        if (early > clockToleranceMinutes) createException(entry, ExceptionCode.EARLY_CLOCK_OUT, (int) early);
        if (minutes.overtime() > clockToleranceMinutes) createException(entry, ExceptionCode.OVERTIME, minutes.overtime());
        refreshTotals(sheet);
        return sheet;
    }

    private Timesheet getOrCreateTimesheet(EmployeeShift shift, OffsetDateTime referenceTime) {
        ZoneId zone = ZoneId.of(timezone);
        LocalDate periodStart = WorkforcePolicy.weekStart(referenceTime.atZoneSameInstant(zone).toLocalDate());
        LocalDate periodEnd = periodStart.plusDays(6);
        OffsetDateTime now = OffsetDateTime.now();
        return store.timesheet(shift.getAccountId(), shift.getClusterId(), periodStart, periodEnd)
                .orElseGet(() -> store.save(Timesheet.builder().timesheetId(id()).accountId(shift.getAccountId()).clusterId(shift.getClusterId())
                        .periodStart(periodStart).periodEnd(periodEnd).status(TimesheetStatus.OPEN).createdAt(now).updatedAt(now).build()));
    }

    private void createException(TimesheetEntry entry, ExceptionCode code, int variance) {
        store.save(AttendanceException.builder().exceptionId(id()).entryId(entry.getEntryId()).exceptionCode(code)
                .varianceMinutes(variance).status(ExceptionStatus.OPEN).createdAt(OffsetDateTime.now()).build());
    }

    private void refreshTotals(Timesheet sheet) {
        List<TimesheetEntry> entries = store.entries(sheet.getTimesheetId());
        sheet.setRegularMinutes(entries.stream().mapToInt(TimesheetEntry::getRegularMinutes).sum());
        sheet.setOvertimeMinutes(entries.stream().mapToInt(TimesheetEntry::getOvertimeMinutes).sum());
        sheet.setExceptionCount((int) entries.stream().flatMap(e -> store.exceptions(e.getEntryId()).stream()).filter(e -> e.getStatus() == ExceptionStatus.OPEN).count());
        sheet.setUpdatedAt(OffsetDateTime.now()); store.save(sheet);
    }

    private void appendTimesheetApproved(Timesheet sheet) {
        String eventId = id();
        var payload = new TimesheetApprovedPayload(sheet.getTimesheetId(), sheet.getAccountId(), sheet.getClusterId(), sheet.getPeriodStart(), sheet.getPeriodEnd(), sheet.getRegularMinutes(), sheet.getOvertimeMinutes(), sheet.getVersion());
        outbox.append(eventId, sheet.getTimesheetId(), sheet.getVersion(), "TIMESHEET_APPROVED", "1", sheet.getAccountId(), payload);
    }

    private List<MonthlySummaryResponse> monthlySummary(List<TimesheetEntry> entries, YearMonth month) {
        Map<String, int[]> totals = new LinkedHashMap<>();
        Map<String, Timesheet> sheets = new LinkedHashMap<>();
        for (TimesheetEntry entry : entries) {
            Timesheet sheet = timesheet(entry.getTimesheetId());
            String key = sheet.getAccountId() + "\u0000" + sheet.getClusterId();
            sheets.putIfAbsent(key, sheet);
            int[] value = totals.computeIfAbsent(key, ignored -> new int[4]);
            value[0] += entry.getRegularMinutes(); value[1] += entry.getOvertimeMinutes(); value[2] += entry.getPayableMinutes();
            value[3] += (int) store.exceptions(entry.getEntryId()).stream().filter(e -> e.getStatus() == ExceptionStatus.OPEN).count();
        }
        return totals.entrySet().stream().map(item -> {
            Timesheet sheet = sheets.get(item.getKey()); int[] value = item.getValue();
            return new MonthlySummaryResponse(sheet.getAccountId(), sheet.getClusterId(), month, value[0], value[1], value[2], value[3]);
        }).toList();
    }

    private YearMonth effectiveMonth(YearMonth month) { return month == null ? YearMonth.now(ZoneId.of(timezone)) : month; }
    private OffsetDateTime monthStart(YearMonth month) { return month.atDay(1).atStartOfDay(ZoneId.of(timezone)).toOffsetDateTime(); }
    private OffsetDateTime monthEnd(YearMonth month) { return month.plusMonths(1).atDay(1).atStartOfDay(ZoneId.of(timezone)).toOffsetDateTime(); }

    private void validateAvailability(String accountId, OffsetDateTime start, OffsetDateTime end, String excludedId) {
        WorkforcePolicy.validateNoConflict(start, end, store.shiftsNear(accountId, start.minusHours(minimumRestHours), end.plusHours(minimumRestHours), excludedId), minimumRestHours);
    }
    private void requireActiveEmployee(String accountId, String clusterId) {
        EmployeeProjection employee = store.find(EmployeeProjection.class, accountId).orElseThrow(() -> new AppException(WorkforceErrorCode.EMPLOYEE_UNAVAILABLE));
        if (!employee.isAssignmentActive() || !employee.clusterIds().contains(clusterId)) throw new AppException(WorkforceErrorCode.EMPLOYEE_UNAVAILABLE);
    }
    private void requireOwnCluster(String clusterId) {
        requireActiveEmployee(actor(), clusterId);
        if (!JwtBranchScope.canAccess(parseCluster(clusterId))) throw new AppException(WorkforceErrorCode.CLUSTER_FORBIDDEN);
    }
    private void requireClusterAccess(String clusterId) {
        if (clusterId == null || clusterId.isBlank()) throw new AppException(WorkforceErrorCode.CLUSTER_FORBIDDEN);
        boolean privileged = hasRole("ADMIN") || hasRole("SUPER_ADMIN") || hasRole("SYSTEM_ADMIN");
        if (!privileged && !JwtBranchScope.canAccess(parseCluster(clusterId))) throw new AppException(WorkforceErrorCode.CLUSTER_FORBIDDEN);
    }
    private boolean hasRole(String role) { return JwtSecurityUtils.hasRole(role) || JwtSecurityUtils.hasRole("ROLE_" + role); }
    private Long parseCluster(String value) { try { return Long.valueOf(value); } catch (Exception e) { throw new AppException(WorkforceErrorCode.CLUSTER_FORBIDDEN); } }
    private String actor() { String value = JwtSecurityUtils.getCurrentAccountId(); if (value == null || value.isBlank()) throw new AppException(WorkforceErrorCode.CLUSTER_FORBIDDEN); return value; }
    private String id() { return UUID.randomUUID().toString(); }
    private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private RosterPeriod roster(String id) { return store.find(RosterPeriod.class, id).orElseThrow(() -> new AppException(WorkforceErrorCode.NOT_FOUND)); }
    private EmployeeShift shift(String id) { return store.find(EmployeeShift.class, id).orElseThrow(() -> new AppException(WorkforceErrorCode.NOT_FOUND)); }
    private Timesheet timesheet(String id) { return store.find(Timesheet.class, id).orElseThrow(() -> new AppException(WorkforceErrorCode.NOT_FOUND)); }
    private void audit(String action, String type, String aggregateId, String details) { store.save(WorkforceAuditLog.builder().auditId(id()).action(action).aggregateType(type).aggregateId(aggregateId).actorAccountId(actor()).details(details).occurredAt(OffsetDateTime.now()).build()); }

    private TemplateResponse templateResponse(ShiftTemplate t) { return new TemplateResponse(t.getTemplateId(), t.getClusterId(), t.getName(), t.getStartTime(), t.getEndTime(), t.getBreakMinutes(), t.isActive()); }
    private ShiftResponse shiftResponse(EmployeeShift s) { return new ShiftResponse(s.getShiftId(), s.getRosterId(), s.getAccountId(), s.getClusterId(), s.getRoleCode(), s.getStartsAt(), s.getEndsAt(), s.getBreakMinutes(), s.getStatus(), s.getNote()); }
    private RosterResponse rosterResponse(RosterPeriod r) { return new RosterResponse(r.getRosterId(), r.getClusterId(), r.getPeriodStart(), r.getPeriodEnd(), r.getStatus(), r.getPublishedAt(), store.shiftsByRoster(r.getRosterId()).stream().map(this::shiftResponse).toList()); }
    private PunchResponse punchResponse(TimePunch p, EmployeeShift s, String sheet) { return new PunchResponse(p.getPunchId(), p.getShiftId(), p.getPunchType(), p.getOccurredAt(), s.getStatus(), sheet); }
    private ExceptionResponse exceptionResponse(AttendanceException e) { return new ExceptionResponse(e.getExceptionId(), e.getExceptionCode(), e.getVarianceMinutes(), e.getStatus(), e.getResolutionNote()); }
    private TimesheetEntryResponse entryResponse(TimesheetEntry e) { return new TimesheetEntryResponse(e.getEntryId(), e.getShiftId(), e.getActualStart(), e.getActualEnd(), e.getRegularMinutes(), e.getOvertimeMinutes(), e.getPayableMinutes(), store.exceptions(e.getEntryId()).stream().map(this::exceptionResponse).toList()); }
    private TimesheetResponse timesheetResponse(Timesheet t) { return new TimesheetResponse(t.getTimesheetId(), t.getAccountId(), t.getClusterId(), t.getPeriodStart(), t.getPeriodEnd(), t.getStatus(), t.getRegularMinutes(), t.getOvertimeMinutes(), t.getExceptionCount(), t.getSubmittedAt(), t.getReviewedBy(), t.getReviewedAt(), t.getReviewNote(), store.entries(t.getTimesheetId()).stream().map(this::entryResponse).toList()); }
    private SwapResponse swapResponse(ShiftSwapRequest r) { return new SwapResponse(r.getRequestId(), r.getSourceShiftId(), r.getRequestedBy(), r.getTargetAccountId(), r.getReason(), r.getStatus(), r.getReviewedBy(), r.getReviewedAt(), r.getReviewNote()); }
    private LeaveResponse leaveResponse(LeaveRequest r) { return new LeaveResponse(r.getRequestId(), r.getAccountId(), r.getClusterId(), r.getLeaveType(), r.getStartsAt(), r.getEndsAt(), r.getReason(), r.getStatus(), r.getReviewedBy(), r.getReviewedAt(), r.getReviewNote()); }

    public record TimesheetApprovedPayload(String timesheetId, String accountId, String clusterId, LocalDate periodStart,
                                           LocalDate periodEnd, int regularMinutes, int overtimeMinutes, long version) {}
}
