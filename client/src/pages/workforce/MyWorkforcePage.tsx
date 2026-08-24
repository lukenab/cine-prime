import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Clock3, FileCheck2, Repeat2, Send, Umbrella } from "lucide-react";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { AdminMetricCard } from "../../components/admin/AdminMetricCard";
import { workforceApi, type LeaveRequest, type MonthlyTimesheetSummary, type SwapRequest, type Timesheet, type WorkforceShift } from "../../api/workforceApi";
import { useAuth } from "../../context/AuthContext";
import "./Workforce.css";

type Tab = "schedule" | "timesheets" | "requests";
const when = (value: string) => new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const hours = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const tone = (status: string) =>
  status.includes("APPROVED") || status === "COMPLETED"
    ? "green"
    : status.includes("REJECTED") || status === "CANCELLED"
      ? "red"
      : status === "SUBMITTED" || status === "IN_PROGRESS"
        ? "amber"
        : "";

export default function MyWorkforcePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("schedule");
  const [shifts, setShifts] = useState<WorkforceShift[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [monthly, setMonthly] = useState<MonthlyTimesheetSummary[]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState("");
  const [error, setError] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leave, setLeave] = useState({ clusterId: user?.clusterIds[0] ?? "", leaveType: "ANNUAL", startsAt: "", endsAt: "", reason: "" });

  useEffect(() => {
    if (!leave.clusterId && user?.clusterIds[0]) setLeave((current) => ({ ...current, clusterId: user.clusterIds[0] }));
  }, [leave.clusterId, user?.clusterIds]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [shiftData, sheetData, monthlyData, swapData, leaveData] = await Promise.all([
        workforceApi.myShifts(),
        workforceApi.myTimesheets(),
        workforceApi.myMonthlySummary(),
        workforceApi.mySwaps(),
        workforceApi.myLeaves(),
      ]);
      setShifts(shiftData);
      setTimesheets(sheetData);
      setMonthly(monthlyData);
      setSwaps(swapData);
      setLeaves(leaveData);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Could not load workforce data.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const nextShift = shifts.filter((s) => ["PUBLISHED", "IN_PROGRESS"].includes(s.status)).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const openSheet = timesheets.find((t) => t.status === "OPEN" || t.status === "REJECTED");
  const action = async (key: string, task: () => Promise<unknown>) => {
    setActing(key);
    setError("");
    try {
      await task();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Action failed.");
    } finally {
      setActing("");
    }
  };
  const stats = useMemo(
    () => ({
      upcoming: shifts.filter((s) => s.status === "PUBLISHED").length,
      worked: monthly.reduce((n, item) => n + item.payableMinutes, 0),
      exceptions: timesheets.reduce((n, t) => n + t.exceptionCount, 0),
      requests: [...swaps, ...leaves].filter((r) => r.status === "SUBMITTED").length,
    }),
    [leaves, monthly, shifts, swaps, timesheets]
  );

  return (
    <div className="wf-page">
      <AdminPageHeader
        eyebrow="Workforce"
        title="My schedule & time"
        description="View published shifts, record attendance and submit time for manager approval."
      />
      {error && <div className="wf-error">{error}</div>}
      <div className="wf-grid wf-grid--stats">
        <AdminMetricCard label="Upcoming shifts" value={stats.upcoming} description="Published shifts ahead" icon={CalendarDays} tone="blue" loading={loading} />
        <AdminMetricCard label="Approved hours" value={hours(stats.worked)} description="Current pay period" icon={Clock3} tone="emerald" loading={loading} />
        <AdminMetricCard label="Attendance exceptions" value={stats.exceptions} description="Entries needing correction" icon={AlertTriangle} tone="amber" loading={loading} />
        <AdminMetricCard label="Pending requests" value={stats.requests} description="Awaiting manager review" icon={Send} tone="violet" loading={loading} />
      </div>
      <div className="wf-toolbar">
        <div className="wf-tabs">
          {(["schedule", "timesheets", "requests"] as Tab[]).map((value) => (
            <button key={value} className={`wf-tab ${tab === value ? "active" : ""}`} onClick={() => setTab(value)}>
              {value === "schedule" ? "My schedule" : value === "timesheets" ? "Timesheets" : "Requests"}
            </button>
          ))}
        </div>
        {tab === "requests" && (
          <button className="wf-button primary" onClick={() => setLeaveOpen((v) => !v)}>
            <Umbrella size={14} />
            Request leave
          </button>
        )}
      </div>

      {loading ? (
        <div className="wf-panel wf-empty">Loading workforce data…</div>
      ) : tab === "schedule" ? (
        <div className="wf-panel">
          <div className="wf-panel__head">
            <h2>
              <CalendarDays size={15} style={{ display: "inline", marginRight: 7 }} />
              Published shifts
            </h2>
            {nextShift && <span className="wf-secondary">Next: {when(nextShift.startsAt)}</span>}
          </div>
          <div className="wf-list">
            {shifts.length === 0 ? (
              <div className="wf-empty">No shifts in this period.</div>
            ) : (
              shifts.map((s) => (
                <div className="wf-row" key={s.shiftId}>
                  <div>
                    <div className="wf-primary">{s.roleCode.replaceAll("_", " ")}</div>
                    <div className="wf-secondary">
                      Cluster {s.clusterId} · {s.breakMinutes} min break
                    </div>
                  </div>
                  <div>
                    <div className="wf-primary">{when(s.startsAt)}</div>
                    <div className="wf-secondary">to {when(s.endsAt)}</div>
                  </div>
                  <span className={`wf-badge ${tone(s.status)}`}>{s.status.replaceAll("_", " ")}</span>
                  <div className="wf-secondary">{s.note || "No note"}</div>
                  <div style={{ display: "flex", gap: 7 }}>
                    {s.status === "PUBLISHED" && (
                      <button disabled={!!acting} className="wf-button success" onClick={() => void action(s.shiftId, () => workforceApi.clockIn(s.shiftId))}>
                        <Clock3 size={13} />
                        Clock in
                      </button>
                    )}
                    {s.status === "IN_PROGRESS" && (
                      <button disabled={!!acting} className="wf-button primary" onClick={() => void action(s.shiftId, () => workforceApi.clockOut(s.shiftId))}>
                        <Clock3 size={13} />
                        Clock out
                      </button>
                    )}
                    {s.status === "PUBLISHED" && (
                      <button
                        className="wf-button"
                        onClick={() => {
                          const target = window.prompt("Target employee account ID");
                          if (target)
                            void action(`swap-${s.shiftId}`, () =>
                              workforceApi.createSwap({ sourceShiftId: s.shiftId, targetAccountId: target, reason: "Employee requested shift swap" })
                            );
                        }}
                      >
                        <Repeat2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : tab === "timesheets" ? (
        <div className="wf-panel">
          <div className="wf-panel__head">
            <h2>
              <FileCheck2 size={15} style={{ display: "inline", marginRight: 7 }} />
              Weekly timesheets
            </h2>
            {openSheet && (
              <button
                className="wf-button primary"
                disabled={!!acting}
                onClick={() => void action(openSheet.timesheetId, () => workforceApi.submitTimesheet(openSheet.timesheetId))}
              >
                <Send size={13} />
                Submit current
              </button>
            )}
          </div>
          <div className="wf-list">
            {timesheets.length === 0 ? (
              <div className="wf-empty">A timesheet is created after your first clock-out.</div>
            ) : (
              timesheets.map((t) => (
                <div className="wf-row" key={t.timesheetId}>
                  <div>
                    <div className="wf-primary">
                      {t.periodStart} – {t.periodEnd}
                    </div>
                    <div className="wf-secondary">Cluster {t.clusterId}</div>
                  </div>
                  <div>
                    <div className="wf-primary">{hours(t.regularMinutes)}</div>
                    <div className="wf-secondary">Regular time</div>
                  </div>
                  <div>
                    <div className="wf-primary">{hours(t.overtimeMinutes)}</div>
                    <div className="wf-secondary">Overtime</div>
                  </div>
                  <div>
                    <span className={`wf-badge ${tone(t.status)}`}>{t.status}</span>
                    <div className="wf-secondary">{t.exceptionCount} open exceptions</div>
                  </div>
                  <div className="wf-secondary">{t.reviewNote || "—"}</div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="wf-grid">
          {leaveOpen && (
            <form
              className="wf-panel wf-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!leave.clusterId) return setError("No assigned cinema cluster in your token.");
                void action("leave", () =>
                  workforceApi
                    .createLeave({
                      clusterId: leave.clusterId,
                      leaveType: leave.leaveType,
                      startsAt: new Date(leave.startsAt).toISOString(),
                      endsAt: new Date(leave.endsAt).toISOString(),
                      reason: leave.reason,
                    })
                    .then(() => setLeaveOpen(false))
                );
              }}
            >
              <div className="wf-field">
                <label>Cinema cluster</label>
                <select className="wf-select" required value={leave.clusterId} onChange={(e) => setLeave({ ...leave, clusterId: e.target.value })}>
                  {user?.clusterIds.map((id) => <option key={id} value={id}>Cluster {id}</option>)}
                </select>
              </div>
              <div className="wf-field">
                <label>Leave type</label>
                <select className="wf-select" value={leave.leaveType} onChange={(e) => setLeave({ ...leave, leaveType: e.target.value })}>
                  <option>ANNUAL</option>
                  <option>SICK</option>
                  <option>UNPAID</option>
                  <option>OTHER</option>
                </select>
              </div>
              <div className="wf-field">
                <label>From</label>
                <input required type="datetime-local" className="wf-input" value={leave.startsAt} onChange={(e) => setLeave({ ...leave, startsAt: e.target.value })} />
              </div>
              <div className="wf-field">
                <label>To</label>
                <input required type="datetime-local" className="wf-input" value={leave.endsAt} onChange={(e) => setLeave({ ...leave, endsAt: e.target.value })} />
              </div>
              <div className="wf-field">
                <label>Reason</label>
                <input className="wf-input" value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} />
                <button className="wf-button primary" disabled={!!acting}>
                  Submit
                </button>
              </div>
            </form>
          )}
          <div className="wf-panel">
            <div className="wf-panel__head">
              <h2>Leave and shift requests</h2>
            </div>
            <div className="wf-list">
              {[
                ...leaves.map((r) => ({ id: r.requestId, title: `${r.leaveType} leave`, detail: `${when(r.startsAt)} – ${when(r.endsAt)}`, status: r.status })),
                ...swaps.map((r) => ({ id: r.requestId, title: "Shift swap", detail: `Target employee ${r.targetAccountId}`, status: r.status })),
              ].map((r) => (
                <div className="wf-row" key={r.id}>
                  <div>
                    <div className="wf-primary">{r.title}</div>
                    <div className="wf-secondary">{r.detail}</div>
                  </div>
                  <span className={`wf-badge ${tone(r.status)}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
