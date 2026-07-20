import { useEffect, useState } from "react";
import { CalendarClock, MapPin, Pause, Play, Plus, Square, X } from "lucide-react";
import {
  movieApi,
  type ClusterResponse,
  type MovieAvailabilityResponse,
  type AvailabilityStatus,
} from "../api/movieApi";
import { useRole } from "../hooks/useRole";

type Props = {
  movieId: number;
};

const STATUS_META: Record<AvailabilityStatus, { label: string; bg: string; text: string }> = {
  PLANNED:   { label: "Planned",   bg: "rgba(59,130,246,0.12)",  text: "#2563eb" },
  OPEN:      { label: "Open",      bg: "rgba(16,185,129,0.12)",  text: "#059669" },
  SUSPENDED: { label: "Suspended", bg: "rgba(245,158,11,0.12)",  text: "#d97706" },
  CLOSED:    { label: "Closed",    bg: "rgba(156,163,175,0.12)", text: "#6b7280" },
};

function SuspendPrompt({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl p-5"
        style={{ background: "var(--bg-main)", border: "1px solid var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)", marginBottom: "10px" }}>Suspend availability</h3>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required) — e.g. projector maintenance"
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border outline-none resize-none"
          style={{ fontSize: "13px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        />
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-xl border text-sm" style={{ color: "var(--text-main)", borderColor: "var(--border-color)" }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "#d97706" }}
          >
            Suspend
          </button>
        </div>
      </div>
    </div>
  );
}

export function MovieAvailabilityPanel({ movieId }: Props) {
  const { isAdmin } = useRole();
  const [availabilities, setAvailabilities] = useState<MovieAvailabilityResponse[]>([]);
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<number | null>(null);

  const [newClusterId, setNewClusterId] = useState<number | "">("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [availRes, clusterRes] = await Promise.all([
        movieApi.searchAvailabilities({ movieId }),
        movieApi.getClusters(),
      ]);
      setAvailabilities(availRes.result ?? []);
      setClusters((clusterRes.result ?? []).filter((c) => c.status === "ACTIVE"));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load availability plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [movieId]);

  const runCommand = async (id: number, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async () => {
    if (!newClusterId || !newStartDate) return;
    setError(null);
    try {
      await movieApi.createAvailability({
        movieId,
        clusterId: Number(newClusterId),
        showingStartDate: newStartDate,
        showingEndDate: newEndDate || undefined,
      });
      setShowAddForm(false);
      setNewClusterId("");
      setNewStartDate("");
      setNewEndDate("");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to create availability plan.");
    }
  };

  const inputStyle: React.CSSProperties = {
    fontSize: "13px", background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-color)",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <CalendarClock size={12} style={{ color: "var(--text-sub)" }} />
          <p style={{ fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-sub)" }}>
            Availability by cluster
          </p>
        </div>
        {isAdmin && !showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium hover:opacity-80"
            style={{ color: "#2563eb", borderColor: "rgba(37,99,235,0.3)", background: "rgba(37,99,235,0.06)" }}
          >
            <Plus size={12} /> Add plan
          </button>
        )}
      </div>

      {error && (
        <p className="mb-2" style={{ fontSize: "12px", color: "#dc2626" }}>{error}</p>
      )}

      {showAddForm && (
        <div className="mb-3 p-3 rounded-xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <select
              value={newClusterId}
              onChange={(e) => setNewClusterId(e.target.value ? Number(e.target.value) : "")}
              className="px-2.5 py-2 rounded-lg"
              style={inputStyle}
            >
              <option value="">Select cluster…</option>
              {clusters.map((c) => (
                <option key={c.clusterId} value={c.clusterId}>{c.clusterName}</option>
              ))}
            </select>
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="px-2.5 py-2 rounded-lg"
              style={inputStyle}
            />
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              placeholder="End (optional)"
              className="px-2.5 py-2 rounded-lg"
              style={inputStyle}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 rounded-lg border text-xs" style={{ color: "var(--text-main)", borderColor: "var(--border-color)" }}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!newClusterId || !newStartDate}
              onClick={handleAdd}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40"
              style={{ background: "#2563eb" }}
            >
              Create plan
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>Loading…</p>
      ) : availabilities.length === 0 ? (
        <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>No availability plan yet at any cluster.</p>
      ) : (
        <div className="space-y-2">
          {availabilities.map((a) => {
            const meta = STATUS_META[a.status];
            const busy = busyId === a.availabilityId;
            return (
              <div key={a.availabilityId} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin size={12} style={{ color: "var(--text-sub)", flexShrink: 0 }} />
                  <div className="min-w-0">
                    <p style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.clusterName ?? `Cluster #${a.clusterId}`}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                      {a.showingStartDate}{a.showingEndDate ? ` → ${a.showingEndDate}` : ""}
                      {a.status === "SUSPENDED" && a.suspensionReason ? ` · ${a.suspensionReason}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ color: meta.text, background: meta.bg }}>
                    {meta.label}
                  </span>
                  {isAdmin && !busy && (
                    <>
                      {a.status === "PLANNED" && (
                        <button type="button" title="Open" onClick={() => runCommand(a.availabilityId, () => movieApi.openAvailability(a.availabilityId))}
                          className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-emerald-50" style={{ color: "#059669" }}>
                          <Play size={12} />
                        </button>
                      )}
                      {(a.status === "PLANNED" || a.status === "OPEN") && (
                        <button type="button" title="Suspend" onClick={() => setSuspendTarget(a.availabilityId)}
                          className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-amber-50" style={{ color: "#d97706" }}>
                          <Pause size={12} />
                        </button>
                      )}
                      {a.status === "SUSPENDED" && (
                        <button type="button" title="Resume" onClick={() => runCommand(a.availabilityId, () => movieApi.resumeAvailability(a.availabilityId))}
                          className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-emerald-50" style={{ color: "#059669" }}>
                          <Play size={12} />
                        </button>
                      )}
                      {a.status !== "CLOSED" && (
                        <button type="button" title="Close" onClick={() => runCommand(a.availabilityId, () => movieApi.closeAvailability(a.availabilityId))}
                          className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100" style={{ color: "#6b7280" }}>
                          <Square size={11} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {suspendTarget !== null && (
        <SuspendPrompt
          onConfirm={(reason) => {
            const id = suspendTarget;
            setSuspendTarget(null);
            runCommand(id, () => movieApi.suspendAvailability(id, reason));
          }}
          onCancel={() => setSuspendTarget(null)}
        />
      )}
    </div>
  );
}
