import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Check, ClipboardCheck, LockKeyhole, RefreshCw, Send, UsersRound, X } from "lucide-react";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { movieApi, type ClusterResponse } from "../../api/movieApi";
import { workforceApi, type LeaveRequest, type Roster, type SwapRequest, type Timesheet } from "../../api/workforceApi";
import { useAuth } from "../../context/AuthContext";
import "./Workforce.css";

type Tab = "rosters" | "timesheets" | "requests";
const hours = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const when = (value: string) => new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const monday = () => {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
  return d.toISOString().slice(0, 10);
};
const plusDays = (date: string, count: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + count);
  return d.toISOString().slice(0, 10);
};

export default function WorkforceOperationsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("rosters");
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [clusterId, setClusterId] = useState(user?.clusterIds[0] ?? "");
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState("");
  const [error, setError] = useState("");
  const [showRosterForm, setShowRosterForm] = useState(false);
  const initialMonday = monday();
  const [rosterForm, setRosterForm] = useState({ periodStart: initialMonday, periodEnd: plusDays(initialMonday, 6) });
  const [shiftRoster, setShiftRoster] = useState("");
  const [shiftForm, setShiftForm] = useState({ accountId: "", roleCode: "TEAM_MEMBER", startsAt: "", endsAt: "", breakMinutes: 30, note: "" });
  const clusterScope = user?.clusterIds.join(",") ?? "";
  const canSeeAllClusters = user?.roles.some((role) => role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN") ?? false;

  useEffect(() => {
    movieApi
      .getClusters()
      .then((r) => {
        const values = r.result ?? [];
        const scoped = canSeeAllClusters || !clusterScope
          ? values
          : values.filter((cluster) => user?.clusterIds.includes(String(cluster.clusterId)));
        setClusters(scoped);
        if ((!clusterId || !scoped.some((cluster) => String(cluster.clusterId) === clusterId)) && scoped[0]) {
          setClusterId(String(scoped[0].clusterId));
        }
      })
      .catch(() => {});
  }, [canSeeAllClusters, clusterId, clusterScope, user?.clusterIds]);
  const load = useCallback(async () => {
    if (!clusterId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [rosterData, sheetData, swapData, leaveData] = await Promise.all([
        workforceApi.rosters(clusterId),
        workforceApi.timesheets(clusterId),
        workforceApi.pendingSwaps(clusterId),
        workforceApi.pendingLeaves(clusterId),
      ]);
      setRosters(rosterData);
      setTimesheets(sheetData);
      setSwaps(swapData);
      setLeaves(leaveData);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Could not load workforce operations.");
    } finally {
      setLoading(false);
    }
  }, [clusterId]);
  useEffect(() => {
    void load();
  }, [load]);
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
      drafts: rosters.filter((r) => r.status === "DRAFT").length,
      published: rosters.filter((r) => r.status === "PUBLISHED").length,
      pending: timesheets.filter((t) => t.status === "SUBMITTED").length,
      exceptions: timesheets.reduce((n, t) => n + t.exceptionCount, 0),
    }),
    [rosters, timesheets]
  );

  return (
    <div className="wf-page">
      <AdminPageHeader
        eyebrow="Workforce operations"
        title="Roster & attendance"
        description="Plan cinema staffing, publish shifts and review payable time separately from raw attendance."
        actions={
          <>
            <select className="wf-select" value={clusterId} onChange={(e) => setClusterId(e.target.value)}>
              {clusters.map((c) => (
                <option key={c.clusterId} value={c.clusterId}>
                  {c.clusterName}
                </option>
              ))}
            </select>
            <button className="wf-button" onClick={() => void load()}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </>
        }
      />
      {error && <div className="wf-error">{error}</div>}
      <div className="wf-grid wf-grid--stats">
        <div className="wf-stat">
          <small>Draft rosters</small>
          <strong>{stats.drafts}</strong>
        </div>
        <div className="wf-stat">
          <small>Published rosters</small>
          <strong>{stats.published}</strong>
        </div>
        <div className="wf-stat">
          <small>Timesheets to review</small>
          <strong>{stats.pending}</strong>
        </div>
        <div className="wf-stat">
          <small>Open exceptions</small>
          <strong>{stats.exceptions}</strong>
        </div>
      </div>
      <div className="wf-toolbar">
        <div className="wf-tabs">
          {(["rosters", "timesheets", "requests"] as Tab[]).map((value) => (
            <button key={value} className={`wf-tab ${tab === value ? "active" : ""}`} onClick={() => setTab(value)}>
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        {tab === "rosters" && (
          <button className="wf-button primary" onClick={() => setShowRosterForm((v) => !v)}>
            <CalendarPlus size={14} />
            New roster
          </button>
        )}
      </div>
      {loading ? (
        <div className="wf-panel wf-empty">Loading workforce operations…</div>
      ) : tab === "rosters" ? (
        <div className="wf-grid">
          {showRosterForm && (
            <form
              className="wf-panel wf-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action("new-roster", () => workforceApi.createRoster({ clusterId, ...rosterForm }).then(() => setShowRosterForm(false)));
              }}
            >
              <div className="wf-field">
                <label>Period start</label>
                <input
                  className="wf-input"
                  required
                  type="date"
                  value={rosterForm.periodStart}
                  onChange={(e) => setRosterForm({ ...rosterForm, periodStart: e.target.value, periodEnd: plusDays(e.target.value, 6) })}
                />
              </div>
              <div className="wf-field">
                <label>Period end</label>
                <input
                  className="wf-input"
                  required
                  type="date"
                  value={rosterForm.periodEnd}
                  onChange={(e) => setRosterForm({ ...rosterForm, periodEnd: e.target.value })}
                />
              </div>
              <div className="wf-field">
                <label>Cluster</label>
                <input className="wf-input" disabled value={clusterId} />
              </div>
              <div className="wf-field">
                <label>Action</label>
                <button className="wf-button primary" disabled={!!acting}>
                  Create draft
                </button>
              </div>
            </form>
          )}
          {rosters.length === 0 ? (
            <div className="wf-panel wf-empty">No roster has been created for this period.</div>
          ) : (
            rosters.map((r) => (
              <div className="wf-panel" key={r.rosterId}>
                <div className="wf-panel__head">
                  <div>
                    <h2>
                      {r.periodStart} – {r.periodEnd}
                    </h2>
                    <div className="wf-secondary">
                      {r.shifts.length} assigned shifts · <span className={`wf-badge ${r.status === "PUBLISHED" ? "green" : ""}`}>{r.status}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {r.status === "DRAFT" && (
                      <>
                        <button className="wf-button" onClick={() => setShiftRoster(shiftRoster === r.rosterId ? "" : r.rosterId)}>
                          <UsersRound size={13} />
                          Assign shift
                        </button>
                        <button
                          className="wf-button primary"
                          disabled={!!acting || r.shifts.length === 0}
                          onClick={() => void action(`publish-${r.rosterId}`, () => workforceApi.publishRoster(r.rosterId))}
                        >
                          <Send size={13} />
                          Publish
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {shiftRoster === r.rosterId && (
                  <form
                    className="wf-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action("add-shift", () =>
                        workforceApi
                          .addShift(r.rosterId, { ...shiftForm, startsAt: new Date(shiftForm.startsAt).toISOString(), endsAt: new Date(shiftForm.endsAt).toISOString() })
                          .then(() => {
                            setShiftRoster("");
                            setShiftForm({ ...shiftForm, accountId: "", startsAt: "", endsAt: "", note: "" });
                          })
                      );
                    }}
                  >
                    <div className="wf-field">
                      <label>Employee account ID</label>
                      <input required className="wf-input" value={shiftForm.accountId} onChange={(e) => setShiftForm({ ...shiftForm, accountId: e.target.value })} />
                    </div>
                    <div className="wf-field">
                      <label>Role on shift</label>
                      <select className="wf-select" value={shiftForm.roleCode} onChange={(e) => setShiftForm({ ...shiftForm, roleCode: e.target.value })}>
                        <option>TEAM_MEMBER</option>
                        <option>SUPERVISOR</option>
                        <option>ASSISTANT_MANAGER</option>
                        <option>CINEMA_MANAGER</option>
                      </select>
                    </div>
                    <div className="wf-field">
                      <label>Starts</label>
                      <input
                        required
                        type="datetime-local"
                        className="wf-input"
                        value={shiftForm.startsAt}
                        onChange={(e) => setShiftForm({ ...shiftForm, startsAt: e.target.value })}
                      />
                    </div>
                    <div className="wf-field">
                      <label>Ends</label>
                      <input
                        required
                        type="datetime-local"
                        className="wf-input"
                        value={shiftForm.endsAt}
                        onChange={(e) => setShiftForm({ ...shiftForm, endsAt: e.target.value })}
                      />
                      <button className="wf-button primary" disabled={!!acting}>
                        Assign
                      </button>
                    </div>
                  </form>
                )}
                <div className="wf-list">
                  {r.shifts.map((s) => (
                    <div className="wf-row" key={s.shiftId}>
                      <div>
                        <div className="wf-primary">{s.accountId}</div>
                        <div className="wf-secondary">{s.roleCode.replaceAll("_", " ")}</div>
                      </div>
                      <div>
                        <div className="wf-primary">{when(s.startsAt)}</div>
                        <div className="wf-secondary">to {when(s.endsAt)}</div>
                      </div>
                      <div>{s.breakMinutes} min break</div>
                      <span className={`wf-badge ${s.status === "COMPLETED" ? "green" : ""}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : tab === "timesheets" ? (
        <div className="wf-panel">
          <div className="wf-panel__head">
            <h2>
              <ClipboardCheck size={15} style={{ display: "inline", marginRight: 7 }} />
              Timesheet review queue
            </h2>
          </div>
          <div className="wf-list">
            {timesheets.length === 0 ? (
              <div className="wf-empty">No timesheets recorded for this cluster.</div>
            ) : (
              timesheets.map((t) => (
                <div className="wf-row" key={t.timesheetId}>
                  <div>
                    <div className="wf-primary">{t.accountId}</div>
                    <div className="wf-secondary">
                      {t.periodStart} – {t.periodEnd}
                    </div>
                    {t.entries
                      .flatMap((e) => e.exceptions)
                      .filter((e) => e.status === "OPEN")
                      .map((e) => (
                        <div className="wf-exception" key={e.exceptionId}>
                          <span className="wf-badge red">
                            {e.code} · {e.varianceMinutes}m
                          </span>
                          <button
                            className="wf-button"
                            disabled={!!acting}
                            onClick={() => void action(e.exceptionId, () => workforceApi.resolveException(e.exceptionId, "RESOLVED", "Verified by branch manager"))}
                          >
                            Resolve
                          </button>
                          <button
                            className="wf-button"
                            disabled={!!acting}
                            onClick={() => void action(e.exceptionId, () => workforceApi.resolveException(e.exceptionId, "WAIVED", "Waived by branch manager"))}
                          >
                            Waive
                          </button>
                        </div>
                      ))}
                  </div>
                  <div>
                    <div className="wf-primary">{hours(t.regularMinutes)}</div>
                    <div className="wf-secondary">Regular</div>
                  </div>
                  <div>
                    <div className="wf-primary">{hours(t.overtimeMinutes)}</div>
                    <div className="wf-secondary">Overtime</div>
                  </div>
                  <span className={`wf-badge ${t.status === "APPROVED" || t.status === "LOCKED" ? "green" : t.status === "REJECTED" ? "red" : "amber"}`}>{t.status}</span>
                  <div style={{ display: "flex", gap: 7 }}>
                    {t.status === "SUBMITTED" && (
                      <>
                        <button
                          className="wf-button success"
                          disabled={!!acting || t.exceptionCount > 0}
                          onClick={() => void action(t.timesheetId, () => workforceApi.approveTimesheet(t.timesheetId, "Reviewed against scheduled shifts"))}
                        >
                          <Check size={13} />
                          Approve
                        </button>
                        <button
                          className="wf-button danger"
                          disabled={!!acting}
                          onClick={() => void action(t.timesheetId, () => workforceApi.rejectTimesheet(t.timesheetId, "Attendance correction required"))}
                        >
                          <X size={13} />
                          Reject
                        </button>
                      </>
                    )}
                    {t.status === "APPROVED" && (
                      <button
                        className="wf-button"
                        disabled={!!acting}
                        onClick={() => void action(t.timesheetId, () => workforceApi.lockTimesheet(t.timesheetId, "Locked for payroll handoff"))}
                      >
                        <LockKeyhole size={13} />
                        Lock period
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="wf-grid">
          <RequestPanel
            title="Shift swap requests"
            rows={swaps.map((r) => ({
              id: r.requestId,
              primary: r.requestedBy,
              secondary: `Shift ${r.sourceShiftId} → ${r.targetAccountId}`,
              status: r.status,
              onReview: (approve: boolean) => action(r.requestId, () => workforceApi.reviewSwap(r.requestId, approve, "Reviewed by branch manager")),
            }))}
            acting={acting}
          />
          <RequestPanel
            title="Leave requests"
            rows={leaves.map((r) => ({
              id: r.requestId,
              primary: r.accountId,
              secondary: `${r.leaveType} · ${when(r.startsAt)} – ${when(r.endsAt)}`,
              status: r.status,
              onReview: (approve: boolean) => action(r.requestId, () => workforceApi.reviewLeave(r.requestId, approve, "Reviewed by branch manager")),
            }))}
            acting={acting}
          />
        </div>
      )}
    </div>
  );
}

function RequestPanel({
  title,
  rows,
  acting,
}: {
  title: string;
  rows: { id: string; primary: string; secondary: string; status: string; onReview: (approve: boolean) => Promise<void> }[];
  acting: string;
}) {
  return (
    <div className="wf-panel">
      <div className="wf-panel__head">
        <h2>{title}</h2>
      </div>
      <div className="wf-list">
        {rows.length === 0 ? (
          <div className="wf-empty">No pending requests.</div>
        ) : (
          rows.map((r) => (
            <div className="wf-row" key={r.id}>
              <div>
                <div className="wf-primary">{r.primary}</div>
                <div className="wf-secondary">{r.secondary}</div>
              </div>
              <span className="wf-badge amber">{r.status}</span>
              <div style={{ display: "flex", gap: 7 }}>
                <button className="wf-button success" disabled={!!acting} onClick={() => void r.onReview(true)}>
                  <Check size={13} />
                  Approve
                </button>
                <button className="wf-button danger" disabled={!!acting} onClick={() => void r.onReview(false)}>
                  <X size={13} />
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
