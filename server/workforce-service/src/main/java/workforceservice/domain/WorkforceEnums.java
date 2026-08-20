package workforceservice.domain;

public final class WorkforceEnums {
    private WorkforceEnums() {}

    public enum RosterStatus { DRAFT, PUBLISHED, IN_OPERATION, CLOSED }
    public enum ShiftStatus { ASSIGNED, PUBLISHED, IN_PROGRESS, COMPLETED, CANCELLED }
    public enum PunchType { CLOCK_IN, CLOCK_OUT }
    public enum TimesheetStatus { OPEN, SUBMITTED, APPROVED, REJECTED, LOCKED }
    public enum ExceptionCode { LATE_CLOCK_IN, EARLY_CLOCK_OUT, OVERTIME, UNSCHEDULED_TIME, MISSING_CLOCK_IN, MISSING_CLOCK_OUT }
    public enum ExceptionStatus { OPEN, RESOLVED, WAIVED }
    public enum RequestStatus { SUBMITTED, APPROVED, REJECTED, CANCELLED }
    public enum LeaveType { ANNUAL, SICK, UNPAID, OTHER }
}
