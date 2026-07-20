import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Film,
  MapPin,
  Pause,
  Play,
  Plus,
  Square,
  Ticket,
  X,
} from "lucide-react";
import {
  movieApi,
  type AvailabilityStatus,
  type ClusterResponse,
  type CreateMovieAvailabilityPayload,
  type MovieAvailabilityResponse,
} from "../api/movieApi";
import { useRole } from "../hooks/useRole";

type Props = {
  movieId: number;
};

type StatusMeta = {
  label: string;
  description: string;
  color: string;
  background: string;
  border: string;
};

const STATUS_META: Record<AvailabilityStatus, StatusMeta> = {
  PLANNED: {
    label: "Planned",
    description: "Release window prepared",
    color: "#2563eb",
    background: "rgba(37,99,235,0.09)",
    border: "rgba(37,99,235,0.22)",
  },
  OPEN: {
    label: "Open",
    description: "Exhibition is enabled",
    color: "#059669",
    background: "rgba(5,150,105,0.09)",
    border: "rgba(5,150,105,0.22)",
  },
  SUSPENDED: {
    label: "Suspended",
    description: "Temporarily unavailable",
    color: "#d97706",
    background: "rgba(217,119,6,0.09)",
    border: "rgba(217,119,6,0.24)",
  },
  CLOSED: {
    label: "Closed",
    description: "Release window ended",
    color: "#64748b",
    background: "rgba(100,116,139,0.09)",
    border: "rgba(100,116,139,0.22)",
  },
};

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(value?: string) {
  if (!value) return "Open-ended";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function SuspendPrompt({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-md rounded-2xl border p-5 shadow-2xl"
        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Pause size={17} />
          </div>
          <div>
            <h3 style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 700 }}>
              Suspend this release plan?
            </h3>
            <p className="mt-1" style={{ color: "var(--text-sub)", fontSize: "12px" }}>
              New sales and scheduling should be stopped until the plan is resumed.
            </p>
          </div>
        </div>

        <label className="mb-1.5 block" style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 600 }}>
          Operational reason <span className="text-rose-500">*</span>
        </label>
        <textarea
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="For example: distribution hold or auditorium maintenance"
          rows={3}
          className="w-full resize-none rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-amber-500/20"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-color)",
            color: "var(--text-main)",
            fontSize: "13px",
          }}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border px-4 py-2 text-sm"
            style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Suspend plan
          </button>
        </div>
      </div>
    </div>
  );
}

/** Unlike SuspendPrompt, the reason here is optional - closing needs no justification, but
 *  capturing one (e.g. "cancelled before playing" vs "run completed") lets reporting later
 *  tell the two apart in movie_availability_history. */
function ClosePrompt({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-md rounded-2xl border p-5 shadow-2xl"
        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600">
            <Square size={17} />
          </div>
          <div>
            <h3 style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 700 }}>
              Close this release window?
            </h3>
            <p className="mt-1" style={{ color: "var(--text-sub)", fontSize: "12px" }}>
              This is terminal - a closed window can't be reopened; a new release plan would be needed instead.
            </p>
          </div>
        </div>

        <label className="mb-1.5 block" style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 600 }}>
          Reason <span style={{ color: "var(--text-sub)", fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          autoFocus
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="For example: cancelled before playing, or run completed as planned"
          rows={3}
          className="w-full resize-none rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-500/20"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-color)",
            color: "var(--text-main)",
            fontSize: "13px",
          }}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border px-4 py-2 text-sm"
            style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim() || undefined)}
            className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Close window
          </button>
        </div>
      </div>
    </div>
  );
}

function CreatePlanDialog({
  movieId,
  clusters,
  onCreated,
  onClose,
}: {
  movieId: number;
  clusters: ClusterResponse[];
  onCreated: () => Promise<void>;
  onClose: () => void;
}) {
  const [clusterId, setClusterId] = useState<number | "">("");
  const [showingStartDate, setShowingStartDate] = useState("");
  const [showingEndDate, setShowingEndDate] = useState("");
  const [salesStartAt, setSalesStartAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidDateRange = Boolean(
    showingStartDate && showingEndDate && showingEndDate < showingStartDate,
  );
  const canSubmit = Boolean(clusterId && showingStartDate && !invalidDateRange && !submitting);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const payload: CreateMovieAvailabilityPayload = {
      movieId,
      clusterId: Number(clusterId),
      showingStartDate,
      showingEndDate: showingEndDate || undefined,
      salesStartAt: salesStartAt || undefined,
    };

    try {
      await movieApi.createAvailability(payload);
      await onCreated();
      onClose();
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? "The release plan could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl"
        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b px-6 py-5" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
              <CalendarClock size={19} />
            </div>
            <div>
              <h2 style={{ color: "var(--text-main)", fontSize: "17px", fontWeight: 700 }}>
                Create a release plan
              </h2>
              <p className="mt-1" style={{ color: "var(--text-sub)", fontSize: "12px" }}>
                Decide where and when this approved movie may be exhibited. Showtimes are scheduled afterward.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-500/10"
            style={{ color: "var(--text-sub)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-rose-600">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              <p style={{ fontSize: "12px" }}>{error}</p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block" style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 600 }}>
              Cinema cluster <span className="text-rose-500">*</span>
            </label>
            <select
              value={clusterId}
              onChange={(event) => setClusterId(event.target.value ? Number(event.target.value) : "")}
              className="w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }}
            >
              <option value="">Select an active cinema cluster</option>
              {clusters.map((cluster) => (
                <option key={cluster.clusterId} value={cluster.clusterId}>
                  {cluster.clusterName}
                </option>
              ))}
            </select>
            {clusters.length === 0 && (
              <p className="mt-1.5 text-amber-600" style={{ fontSize: "11px" }}>
                No active cinema cluster is available. Approve and activate a cluster first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block" style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 600 }}>
                Showing starts <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                min={today()}
                value={showingStartDate}
                onChange={(event) => setShowingStartDate(event.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20"
                style={{ colorScheme: "var(--color-scheme)" as string, background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }}
              />
            </div>
            <div>
              <label className="mb-1.5 block" style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 600 }}>
                Showing ends <span style={{ color: "var(--text-sub)", fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="date"
                min={showingStartDate || today()}
                value={showingEndDate}
                onChange={(event) => setShowingEndDate(event.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20"
                style={{ colorScheme: "var(--color-scheme)" as string, background: "var(--bg-card)", borderColor: invalidDateRange ? "#e11d48" : "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }}
              />
              {invalidDateRange && <p className="mt-1 text-rose-500" style={{ fontSize: "11px" }}>End date cannot be before start date.</p>}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block" style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 600 }}>
              Sales start <span style={{ color: "var(--text-sub)", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={salesStartAt}
              onChange={(event) => setSalesStartAt(event.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20"
              style={{ colorScheme: "var(--color-scheme)" as string, background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }}
            />
            <p className="mt-1.5" style={{ color: "var(--text-sub)", fontSize: "11px" }}>
              This is the planned presale time. Opening individual showtimes remains a separate operational action.
            </p>
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: "rgba(37,99,235,0.18)", background: "rgba(37,99,235,0.05)" }}>
            <div className="flex items-center gap-2 text-blue-600">
              <CheckCircle2 size={14} />
              <p style={{ fontSize: "12px", fontWeight: 600 }}>The new plan starts as PLANNED</p>
            </div>
            <p className="mt-1 pl-[22px]" style={{ color: "var(--text-sub)", fontSize: "11px" }}>
              It will not open ticket sales or publish a showtime automatically.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4" style={{ borderColor: "var(--border-color)" }}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2.5 text-sm"
            style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creating..." : "Create release plan"}
            {!submitting && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkflowStep({
  icon,
  label,
  state,
}: {
  icon: React.ReactNode;
  label: string;
  state: "complete" | "current" | "upcoming";
}) {
  const palette = state === "complete"
    ? { color: "#059669", background: "rgba(5,150,105,0.1)", border: "rgba(5,150,105,0.2)" }
    : state === "current"
      ? { color: "#2563eb", background: "rgba(37,99,235,0.1)", border: "rgba(37,99,235,0.24)" }
      : { color: "var(--text-sub)", background: "var(--bg-card)", border: "var(--border-color)" };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border" style={palette}>
        {state === "complete" ? <Check size={13} /> : icon}
      </div>
      <p className="truncate" style={{ color: palette.color, fontSize: "11px", fontWeight: state === "upcoming" ? 500 : 650 }}>
        {label}
      </p>
    </div>
  );
}

export function MovieAvailabilityPanel({ movieId }: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const [availabilities, setAvailabilities] = useState<MovieAvailabilityResponse[]>([]);
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<number | null>(null);
  const [closeTarget, setCloseTarget] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [availabilityResponse, clusterResponse] = await Promise.all([
        movieApi.searchAvailabilities({ movieId }),
        movieApi.getClusters(),
      ]);
      setAvailabilities(availabilityResponse.result ?? []);
      setClusters((clusterResponse.result ?? []).filter((cluster) => cluster.status === "ACTIVE"));
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? "Release plans could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [movieId]);

  const counts = useMemo(() => ({
    total: availabilities.length,
    planned: availabilities.filter((item) => item.status === "PLANNED").length,
    open: availabilities.filter((item) => item.status === "OPEN").length,
    suspended: availabilities.filter((item) => item.status === "SUSPENDED").length,
  }), [availabilities]);

  const runCommand = async (id: number, command: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await command();
      await load();
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? "The release plan action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const goToScheduling = (availability: MovieAvailabilityResponse) => {
    const query = new URLSearchParams({
      movieId: String(movieId),
      clusterId: String(availability.clusterId),
      availabilityId: String(availability.availabilityId),
    });
    navigate(`/admin/showtimes?${query.toString()}`);
  };

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
              <CalendarClock size={16} />
            </div>
            <div>
              <h3 style={{ color: "var(--text-main)", fontSize: "14px", fontWeight: 700 }}>Release plans</h3>
              <p style={{ color: "var(--text-sub)", fontSize: "11px" }}>Control exhibition separately for each cinema cluster.</p>
            </div>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={13} /> New release plan
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
        <WorkflowStep icon={<Film size={13} />} label="Content approved" state="complete" />
        <ArrowRight size={12} style={{ color: "var(--text-sub)", flexShrink: 0 }} />
        <WorkflowStep icon={<CalendarDays size={13} />} label="Release plan" state={counts.total > 0 ? "complete" : "current"} />
        <ArrowRight size={12} style={{ color: "var(--text-sub)", flexShrink: 0 }} />
        <WorkflowStep icon={<Clock3 size={13} />} label="Schedule shows" state={counts.total > 0 ? "current" : "upcoming"} />
        <ArrowRight size={12} style={{ color: "var(--text-sub)", flexShrink: 0 }} />
        <WorkflowStep icon={<Ticket size={13} />} label="Open sales" state="upcoming" />
      </div>

      {counts.total > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Clusters", counts.total, "var(--text-main)"],
            ["Planned", counts.planned, "#2563eb"],
            ["Open", counts.open, "#059669"],
            ["Suspended", counts.suspended, "#d97706"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
              <p style={{ color: "var(--text-sub)", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
              <p className="mt-0.5" style={{ color: String(color), fontSize: "17px", fontWeight: 750 }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-rose-600">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <p style={{ fontSize: "12px" }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }} />
          ))}
        </div>
      ) : availabilities.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed px-5 py-7 text-center" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600">
            <MapPin size={20} />
          </div>
          <h4 className="mt-3" style={{ color: "var(--text-main)", fontSize: "13px", fontWeight: 700 }}>No cinema release has been planned</h4>
          <p className="mx-auto mt-1 max-w-md" style={{ color: "var(--text-sub)", fontSize: "11px" }}>
            Add a cinema cluster and exhibition window first. This does not publish showtimes or open ticket sales.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold text-blue-600"
              style={{ borderColor: "rgba(37,99,235,0.25)", background: "rgba(37,99,235,0.06)" }}
            >
              <Plus size={13} /> Create the first release plan
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {availabilities.map((availability) => {
            const meta = STATUS_META[availability.status];
            const busy = busyId === availability.availabilityId;

            return (
              <article
                key={availability.availabilityId}
                className="rounded-2xl border p-3.5"
                style={{ borderColor: availability.status === "OPEN" ? meta.border : "var(--border-color)", background: "var(--bg-main)" }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <MapPin size={14} className="flex-shrink-0" style={{ color: "#2563eb" }} />
                        <h4 className="truncate" style={{ color: "var(--text-main)", fontSize: "13px", fontWeight: 700 }}>
                          {availability.clusterName ?? `Cluster #${availability.clusterId}`}
                        </h4>
                      </div>
                      <span className="rounded-lg border px-2 py-0.5" style={{ color: meta.color, background: meta.background, borderColor: meta.border, fontSize: "10px", fontWeight: 700 }}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1" style={{ color: "var(--text-sub)", fontSize: "10.5px" }}>{meta.description}</p>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="flex items-start gap-2 rounded-xl border px-2.5 py-2" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                        <CalendarDays size={13} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-sub)" }} />
                        <div>
                          <p style={{ color: "var(--text-sub)", fontSize: "9.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Showing window</p>
                          <p className="mt-0.5" style={{ color: "var(--text-main)", fontSize: "11px", fontWeight: 600 }}>
                            {formatDate(availability.showingStartDate)} → {formatDate(availability.showingEndDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 rounded-xl border px-2.5 py-2" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                        <Ticket size={13} className="mt-0.5 flex-shrink-0" style={{ color: "var(--text-sub)" }} />
                        <div>
                          <p style={{ color: "var(--text-sub)", fontSize: "9.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Planned sales start</p>
                          <p className="mt-0.5" style={{ color: "var(--text-main)", fontSize: "11px", fontWeight: 600 }}>
                            {formatDateTime(availability.salesStartAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {availability.status === "SUSPENDED" && availability.suspensionReason && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-amber-700">
                        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                        <p style={{ fontSize: "10.5px" }}>{availability.suspensionReason}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 sm:max-w-[210px] sm:justify-end">
                    {availability.status !== "CLOSED" && (
                      <button
                        type="button"
                        onClick={() => goToScheduling(availability)}
                        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-500/5"
                        style={{ borderColor: "rgba(37,99,235,0.24)" }}
                      >
                        <Clock3 size={12} /> Schedule shows
                      </button>
                    )}

                    {isAdmin && !busy && availability.status === "PLANNED" && (
                      <button
                        type="button"
                        title="Enable exhibition for this cluster"
                        onClick={() => runCommand(availability.availabilityId, () => movieApi.openAvailability(availability.availabilityId))}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        <Play size={11} /> Open
                      </button>
                    )}

                    {isAdmin && !busy && (availability.status === "PLANNED" || availability.status === "OPEN") && (
                      <button
                        type="button"
                        title="Temporarily suspend"
                        onClick={() => setSuspendTarget(availability.availabilityId)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border text-amber-600 hover:bg-amber-500/10"
                        style={{ borderColor: "var(--border-color)" }}
                      >
                        <Pause size={12} />
                      </button>
                    )}

                    {isAdmin && !busy && availability.status === "SUSPENDED" && (
                      <button
                        type="button"
                        title="Resume exhibition"
                        onClick={() => runCommand(availability.availabilityId, () => movieApi.resumeAvailability(availability.availabilityId))}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        <Play size={11} /> Resume
                      </button>
                    )}

                    {isAdmin && !busy && availability.status !== "CLOSED" && (
                      <button
                        type="button"
                        title="Close this release window"
                        onClick={() => setCloseTarget(availability.availabilityId)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border hover:bg-slate-500/10"
                        style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}
                      >
                        <Square size={11} />
                      </button>
                    )}

                    {busy && <span style={{ color: "var(--text-sub)", fontSize: "11px" }}>Updating...</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showCreateDialog && (
        <CreatePlanDialog
          movieId={movieId}
          clusters={clusters}
          onCreated={load}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {suspendTarget !== null && (
        <SuspendPrompt
          onConfirm={(reason) => {
            const id = suspendTarget;
            setSuspendTarget(null);
            void runCommand(id, () => movieApi.suspendAvailability(id, reason));
          }}
          onCancel={() => setSuspendTarget(null)}
        />
      )}

      {closeTarget !== null && (
        <ClosePrompt
          onConfirm={(reason) => {
            const id = closeTarget;
            setCloseTarget(null);
            void runCommand(id, () => movieApi.closeAvailability(id, reason));
          }}
          onCancel={() => setCloseTarget(null)}
        />
      )}
    </section>
  );
}
