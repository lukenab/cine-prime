import axiosClient from "./api";

export type ShiftStatus = "ASSIGNED" | "PUBLISHED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TimesheetStatus = "OPEN" | "SUBMITTED" | "APPROVED" | "REJECTED" | "LOCKED";
export type RequestStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface WorkforceShift {
  shiftId: string;
  rosterId: string;
  accountId: string;
  clusterId: string;
  roleCode: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  status: ShiftStatus;
  note?: string;
}
export interface Roster {
  rosterId: string;
  clusterId: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "PUBLISHED" | "IN_OPERATION" | "CLOSED";
  publishedAt?: string;
  shifts: WorkforceShift[];
}
export interface AttendanceException {
  exceptionId: string;
  code: string;
  varianceMinutes: number;
  status: "OPEN" | "RESOLVED" | "WAIVED";
  resolutionNote?: string;
}
export interface TimesheetEntry {
  entryId: string;
  shiftId: string;
  actualStart?: string;
  actualEnd?: string;
  regularMinutes: number;
  overtimeMinutes: number;
  payableMinutes: number;
  exceptions: AttendanceException[];
}
export interface Timesheet {
  timesheetId: string;
  accountId: string;
  clusterId: string;
  periodStart: string;
  periodEnd: string;
  status: TimesheetStatus;
  regularMinutes: number;
  overtimeMinutes: number;
  exceptionCount: number;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  entries: TimesheetEntry[];
}
export interface MonthlyTimesheetSummary {
  accountId: string;
  clusterId: string;
  month: string;
  regularMinutes: number;
  overtimeMinutes: number;
  payableMinutes: number;
  openExceptionCount: number;
}
export interface SwapRequest {
  requestId: string;
  sourceShiftId: string;
  requestedBy: string;
  targetAccountId: string;
  reason?: string;
  status: RequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}
export interface LeaveRequest {
  requestId: string;
  accountId: string;
  clusterId: string;
  leaveType: string;
  startsAt: string;
  endsAt: string;
  reason?: string;
  status: RequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

type ApiResponse<T> = { result: T; message?: string };
const result = <T>(response: ApiResponse<T>) => response.result;

export const workforceApi = {
  myShifts: (from?: string, to?: string) => axiosClient.get("/api/workforce/me/shifts", { params: { from, to } }).then(result<WorkforceShift[]>),
  clockIn: (shiftId: string) => axiosClient.post(`/api/workforce/me/shifts/${shiftId}/clock-in`, {}, { headers: { "Idempotency-Key": crypto.randomUUID() } }),
  clockOut: (shiftId: string) => axiosClient.post(`/api/workforce/me/shifts/${shiftId}/clock-out`, {}, { headers: { "Idempotency-Key": crypto.randomUUID() } }),
  myTimesheets: () => axiosClient.get("/api/workforce/me/timesheets").then(result<Timesheet[]>),
  myMonthlySummary: (month?: string) => axiosClient.get("/api/workforce/me/timesheets/monthly", { params: { month } }).then(result<MonthlyTimesheetSummary[]>),
  submitTimesheet: (id: string) => axiosClient.post(`/api/workforce/me/timesheets/${id}/submit`).then(result<Timesheet>),
  mySwaps: () => axiosClient.get("/api/workforce/me/shift-swaps").then(result<SwapRequest[]>),
  createSwap: (body: { sourceShiftId: string; targetAccountId: string; reason?: string }) =>
    axiosClient.post("/api/workforce/me/shift-swaps", body).then(result<SwapRequest>),
  myLeaves: () => axiosClient.get("/api/workforce/me/leave-requests").then(result<LeaveRequest[]>),
  createLeave: (body: { clusterId: string; leaveType: string; startsAt: string; endsAt: string; reason?: string }) =>
    axiosClient.post("/api/workforce/me/leave-requests", body).then(result<LeaveRequest>),
  rosters: (clusterId: string) => axiosClient.get("/api/workforce/admin/rosters", { params: { clusterId } }).then(result<Roster[]>),
  createRoster: (body: { clusterId: string; periodStart: string; periodEnd: string }) => axiosClient.post("/api/workforce/admin/rosters", body).then(result<Roster>),
  addShift: (rosterId: string, body: { accountId: string; roleCode: string; startsAt: string; endsAt: string; breakMinutes: number; note?: string }) =>
    axiosClient.post(`/api/workforce/admin/rosters/${rosterId}/shifts`, body).then(result<WorkforceShift>),
  publishRoster: (id: string) => axiosClient.post(`/api/workforce/admin/rosters/${id}/publish`).then(result<Roster>),
  timesheets: (clusterId: string, status?: TimesheetStatus) =>
    axiosClient.get("/api/workforce/admin/timesheets", { params: { clusterId, status } }).then(result<Timesheet[]>),
  monthlySummary: (clusterId: string, month?: string) =>
    axiosClient.get("/api/workforce/admin/timesheets/monthly", { params: { clusterId, month } }).then(result<MonthlyTimesheetSummary[]>),
  approveTimesheet: (id: string, note?: string) => axiosClient.post(`/api/workforce/admin/timesheets/${id}/approve`, { note }).then(result<Timesheet>),
  rejectTimesheet: (id: string, note?: string) => axiosClient.post(`/api/workforce/admin/timesheets/${id}/reject`, { note }).then(result<Timesheet>),
  lockTimesheet: (id: string, note?: string) => axiosClient.post(`/api/workforce/admin/timesheets/${id}/lock`, { note }).then(result<Timesheet>),
  resolveException: (id: string, status: "RESOLVED" | "WAIVED", note: string) =>
    axiosClient.post(`/api/workforce/admin/attendance-exceptions/${id}/resolve`, { status, note }),
  pendingSwaps: (clusterId: string) => axiosClient.get("/api/workforce/admin/shift-swaps", { params: { clusterId } }).then(result<SwapRequest[]>),
  reviewSwap: (id: string, approve: boolean, note?: string) => axiosClient.post(`/api/workforce/admin/shift-swaps/${id}/${approve ? "approve" : "reject"}`, { note }),
  pendingLeaves: (clusterId: string) => axiosClient.get("/api/workforce/admin/leave-requests", { params: { clusterId } }).then(result<LeaveRequest[]>),
  reviewLeave: (id: string, approve: boolean, note?: string) => axiosClient.post(`/api/workforce/admin/leave-requests/${id}/${approve ? "approve" : "reject"}`, { note }),
};
