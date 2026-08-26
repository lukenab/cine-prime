import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleStop,
  Clock3,
  MapPin,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react";
import { subscribeLifecycleEvents } from "../api/lifecycleSocket";
import {
  movieApi,
  type AvailabilityStatus,
  type BulkCreateMovieAvailabilityResponse,
  type ClusterResponse,
  type MovieAvailabilityResponse,
} from "../api/movieApi";
import { useRole } from "../hooks/useRole";

type Props = {
  movieId: number;
};

type PlanFilter = "CURRENT" | "AWAITING" | "CHANGES" | "APPROVED" | "HISTORY";
type TerminalPlanAction = "DISCARD" | "CANCEL" | "END_RUN";

function SelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}) {
  const selected = checked || indeterminate;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={onChange}
      className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-2 ${selected ? "shadow-sm" : "hover:brightness-95"}`}
      style={{
        borderColor: selected ? "#2563eb" : "var(--border-color)",
        background: selected ? "#2563eb" : "var(--bg-card)",
        color: selected ? "#ffffff" : "transparent",
      }}
    >
      {indeterminate
        ? <span className="h-0.5 w-2 rounded-full bg-current" />
        : <Check size={12} strokeWidth={3} />}
    </button>
  );
}

function getTerminalPlanAction(status: AvailabilityStatus): TerminalPlanAction {
  if (status === "OPEN" || status === "SUSPENDED") return "END_RUN";
  if (status === "APPROVED") return "CANCEL";
  return "DISCARD";
}

function getTerminalPlanActionLabel(status: AvailabilityStatus) {
  const action = getTerminalPlanAction(status);
  if (action === "END_RUN") return "End run";
  if (action === "CANCEL") return "Cancel plan";
  return "Discard plan";
}

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
  IN_REVIEW: {
    label: "Awaiting decision",
    description: "Submitted for independent review",
    color: "#b45309",
    background: "rgba(245,158,11,0.12)",
    border: "rgba(217,119,6,0.28)",
  },
  CHANGES_REQUESTED: {
    label: "Changes requested",
    description: "Update and resubmit the release plan",
    color: "#dc2626",
    background: "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.22)",
  },
  APPROVED: {
    label: "Approved",
    description: "Public as Coming Soon; sales remain closed",
    color: "#047857",
    background: "rgba(5,150,105,0.10)",
    border: "rgba(5,150,105,0.24)",
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
  if (!value) return "Not set";
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
  action,
  onConfirm,
  onCancel,
}: {
  action: TerminalPlanAction;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const copy = action === "END_RUN"
    ? {
        title: "End this theatrical run?",
        description: "This stops the film's run at this cinema cluster. The operational history will be retained and the plan cannot be reopened.",
        placeholder: "For example: theatrical run completed as planned",
        confirmLabel: "End run",
      }
    : action === "CANCEL"
      ? {
          title: "Cancel this release plan?",
          description: "This cancels the approved plan before activation. The decision will remain available in release-plan history.",
          placeholder: "For example: release cancelled before ticket sales opened",
          confirmLabel: "Cancel plan",
        }
      : {
          title: "Discard this release plan?",
          description: "This removes the unfinished plan from the active workflow while retaining its audit history.",
          placeholder: "For example: plan replaced by a revised booking",
          confirmLabel: "Discard plan",
        };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6" onClick={onCancel}>
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-[520px] overflow-hidden rounded-2xl border shadow-2xl"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-6 pb-4 pt-6">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
            <CircleStop size={19} />
          </div>
          <div className="min-w-0">
            <h3 style={{ color: "var(--text-main)", fontSize: "16px", fontWeight: 750 }}>
              {copy.title}
            </h3>
            <p className="mt-1.5 leading-5" style={{ color: "var(--text-sub)", fontSize: "12.5px" }}>
              {copy.description}
            </p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <label className="mb-1.5 block" style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 600 }}>
            Reason <span style={{ color: "var(--text-sub)", fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={copy.placeholder}
            rows={3}
            className="w-full resize-none rounded-xl border px-3 py-2.5 outline-none transition focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/15"
            style={{
              background: "var(--bg-main)",
              borderColor: "var(--border-color)",
              color: "var(--text-main)",
              fontSize: "13px",
            }}
          />
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-[10px] px-4 text-sm font-semibold transition-colors hover:bg-slate-500/10"
            style={{ color: "var(--text-main)" }}
          >
            Keep plan
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim() || undefined)}
            className="h-10 rounded-[10px] bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
          >
            {copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReleaseReviewPrompt({
  onConfirm,
  onCancel,
}: {
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-md rounded-2xl border p-5 shadow-2xl"
        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 style={{ color: "var(--text-main)", fontSize: "15px", fontWeight: 700 }}>
          Request changes
        </h3>
        <p className="mt-1" style={{ color: "var(--text-sub)", fontSize: "12px" }}>
          Explain what the programming operator must update before resubmitting.
        </p>
        <textarea
          autoFocus
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="For example: move the sales start before the premiere date."
          rows={3}
          className="mt-4 w-full resize-none rounded-xl border px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}>
            Cancel
          </button>
          <button type="button" disabled={!note.trim()} onClick={() => onConfirm(note.trim())} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-40">
            Request changes
          </button>
        </div>
      </div>
    </div>
  );
}

function ReleasePlanReviewModal({
  availability,
  busy,
  onClose,
  onRequestChanges,
  onApprove,
}: {
  availability: MovieAvailabilityResponse;
  busy: boolean;
  onClose: () => void;
  onRequestChanges: () => void;
  onApprove: () => void;
}) {
  const meta = STATUS_META[availability.status];

  return (
    <div className="fixed inset-0 z-[68] flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true" aria-label="Review release plan">
      <button type="button" aria-label="Close review" className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-[1px]" onClick={onClose} />
      <section className="relative flex max-h-[min(760px,calc(100vh-3rem))] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border shadow-2xl" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
        <header className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.11em] text-blue-600">Release plan review</p>
            <h2 className="mt-1 truncate text-xl font-bold" style={{ color: "var(--text-main)" }}>{availability.clusterName ?? `Cluster #${availability.clusterId}`}</h2>
            <span className="mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold" style={{ color: meta.color, background: meta.background, borderColor: meta.border }}>{meta.label}</span>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-[10px] transition-colors hover:bg-slate-500/10" style={{ color: "var(--text-sub)" }}>
            <X size={17} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            {[
              ["Exhibition starts", formatDate(availability.showingStartDate)],
              ["Exhibition ends", availability.showingEndDate ? formatDate(availability.showingEndDate) : "Until further notice"],
              ["Sales activation", availability.salesStartAt ? formatDateTime(availability.salesStartAt) : "Manual activation"],
              ["Submitted", availability.submittedAt ? formatDateTime(availability.submittedAt) : "Not recorded"],
              ["Submitted by", availability.submittedBy || "Not recorded"],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[140px_1fr] gap-4 border-b px-4 py-3 last:border-b-0" style={{ borderColor: "var(--border-color)" }}>
                <span className="text-xs" style={{ color: "var(--text-sub)" }}>{label}</span>
                <strong className="text-right text-xs font-semibold" style={{ color: "var(--text-main)" }}>{value}</strong>
              </div>
            ))}
          </section>

          {availability.reviewNote && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-[0.06em]" style={{ color: "var(--text-sub)" }}>Review note</h3>
              <p className="mt-2 rounded-xl border px-4 py-3 text-sm leading-6" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", color: "var(--text-main)" }}>{availability.reviewNote}</p>
            </section>
          )}

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-3">
            <p className="text-xs font-semibold text-blue-700">Approval does not open ticket sales.</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>The plan must be activated separately before customers can purchase tickets.</p>
          </div>

          <p className="text-[11px]" style={{ color: "var(--text-sub)" }}>Internal reference: RP-{availability.availabilityId}</p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t px-6 py-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <button type="button" disabled={busy} onClick={onRequestChanges} className="h-10 rounded-[10px] border px-4 text-sm font-semibold transition-colors hover:bg-rose-500/10 disabled:opacity-50" style={{ borderColor: "rgba(225,29,72,0.34)", color: "#e11d48" }}>
            Request changes
          </button>
          <button type="button" disabled={busy} onClick={onApprove} className="h-10 rounded-[10px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Approving…" : "Approve plan"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function BulkApprovalModal({
  plans,
  busy,
  onClose,
  onConfirm,
}: {
  plans: MovieAvailabilityResponse[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (note?: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true" aria-label="Approve selected release plans">
      <button type="button" aria-label="Close approval" className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-[1px]" onClick={onClose} />
      <section className="relative w-full max-w-[620px] overflow-hidden rounded-2xl border shadow-2xl" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
        <header className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.11em] text-emerald-600">Bulk approval</p>
            <h2 className="mt-1 text-xl font-bold" style={{ color: "var(--text-main)" }}>Approve {plans.length} release plans?</h2>
            <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-sub)" }}>Each selected cinema plan is checked again before approval. Plans changed by another user will be skipped and reported.</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-[10px] transition-colors hover:bg-slate-500/10" style={{ color: "var(--text-sub)" }}><X size={17} /></button>
        </header>

        <div className="space-y-4 px-6 py-5">
          <div className="max-h-48 overflow-y-auto rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
            {plans.map((plan) => (
              <div key={plan.availabilityId} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0" style={{ borderColor: "var(--border-color)" }}>
                <span className="truncate text-sm font-semibold" style={{ color: "var(--text-main)" }}>{plan.clusterName ?? `Cluster ${plan.clusterId}`}</span>
                <span className="shrink-0 text-xs" style={{ color: "var(--text-sub)" }}>Starts {formatDate(plan.showingStartDate)}</span>
              </div>
            ))}
          </div>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--text-main)" }}>Decision note <span className="font-normal" style={{ color: "var(--text-sub)" }}>(optional)</span></span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} placeholder="Add context for the programming operator…" className="mt-2 w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)" }} />
          </label>
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-xs leading-5" style={{ color: "var(--text-sub)" }}>
            Approval makes these plans eligible for scheduling. It does not start ticket sales.
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t px-6 py-4" style={{ borderColor: "var(--border-color)" }}>
          <button type="button" disabled={busy} onClick={onClose} className="h-10 rounded-[10px] px-4 text-sm font-semibold transition-colors hover:bg-slate-500/10 disabled:opacity-50" style={{ color: "var(--text-main)" }}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => onConfirm(note.trim() || undefined)} className="h-10 rounded-[10px] bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50">
            {busy ? "Approving…" : `Approve ${plans.length} plans`}
          </button>
        </footer>
      </section>
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
  const [allActive, setAllActive] = useState(false);
  const [selectedClusterIds, setSelectedClusterIds] = useState<Set<number>>(new Set());
  const [clusterSearch, setClusterSearch] = useState("");
  const [showingStartDate, setShowingStartDate] = useState("");
  const [showingEndDate, setShowingEndDate] = useState("");
  const [continuesUntilFurtherNotice, setContinuesUntilFurtherNotice] = useState(false);
  const [salesStartAt, setSalesStartAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkCreateMovieAvailabilityResponse | null>(null);

  const toggleCluster = (id: number) => {
    setSelectedClusterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const visibleClusters = useMemo(() => {
    const q = clusterSearch.trim().toLowerCase();
    if (!q) return clusters;
    return clusters.filter((cluster) =>
      cluster.clusterName.toLowerCase().includes(q)
      || cluster.province?.toLowerCase().includes(q)
      || cluster.address?.toLowerCase().includes(q),
    );
  }, [clusters, clusterSearch]);

  const invalidDateRange = Boolean(
    showingStartDate && showingEndDate && showingEndDate < showingStartDate,
  );
  const invalidSalesStart = Boolean(
    salesStartAt && showingStartDate && salesStartAt.slice(0, 10) > showingStartDate,
  );
  const hasTarget = allActive || selectedClusterIds.size > 0;
  const hasEndDateIntent = Boolean(showingEndDate || continuesUntilFurtherNotice);
  const canSubmit = Boolean(hasTarget && showingStartDate && hasEndDateIntent && !invalidDateRange && !invalidSalesStart && !submitting);
  const targetCount = allActive ? clusters.length : selectedClusterIds.size;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await movieApi.bulkCreateAvailability({
        movieId,
        allActiveClusters: allActive || undefined,
        clusterIds: allActive ? undefined : Array.from(selectedClusterIds),
        showingStartDate,
        showingEndDate: continuesUntilFurtherNotice ? undefined : showingEndDate,
        salesStartAt: salesStartAt || undefined,
      });
      await onCreated();
      if (res.result.skipped.length === 0) {
        onClose();
      } else {
        // Partial success (e.g. one cluster already had a window for this date) - show what
        // actually happened instead of silently closing, so the admin isn't left assuming
        // every selected cluster got a plan when some didn't.
        setResult(res.result);
      }
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? "The release plan could not be created.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="fixed inset-0 z-[65] flex items-center justify-center px-4" onClick={onClose}>
        <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />
        <div
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl"
          style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b px-6 py-5" style={{ borderColor: "var(--border-color)" }}>
            <h2 style={{ color: "var(--text-main)", fontSize: "17px", fontWeight: 700 }}>Release plan results</h2>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(5,150,105,0.24)", background: "rgba(5,150,105,0.08)" }}>
              <CheckCircle2 size={15} style={{ color: "#059669" }} />
              <p style={{ fontSize: "12.5px", color: "#059669" }}>
                Created for {result.created.length} cluster{result.created.length === 1 ? "" : "s"}.
              </p>
            </div>
            <div>
              <p className="mb-2" style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>
                Skipped ({result.skipped.length})
              </p>
              <ul className="space-y-1.5">
                {result.skipped.map((s) => (
                  <li key={s.clusterId} className="flex items-start gap-2 rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                    <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#d97706" }} />
                    <div>
                      <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)" }}>{s.clusterName ?? `Cluster #${s.clusterId}`}</p>
                      <p style={{ fontSize: "11.5px", color: "var(--text-sub)" }}>{s.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex justify-end border-t px-6 py-4" style={{ borderColor: "var(--border-color)" }}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center px-4 py-6" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />
      <div
        className="relative flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b px-7 py-5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
              <CalendarClock size={19} />
            </div>
            <div>
              <h2 style={{ color: "var(--text-main)", fontSize: "17px", fontWeight: 700 }}>
                Create release plan(s)
              </h2>
              <p className="mt-1" style={{ color: "var(--text-sub)", fontSize: "12px" }}>
                Decide where and when this approved movie may be exhibited — pick one or more clusters, or release wide to every active cluster at once. Showtimes are scheduled afterward.
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-7 py-6" style={{ background: "var(--bg-main)" }}>
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-rose-600">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              <p style={{ fontSize: "12px" }}>{error}</p>
            </div>
          )}

          {/* 2-column layout — cluster picker left, schedule fields right. The modal already
              has the width (max-w-2xl) to spare; stacking everything vertically was the main
              reason this felt so tall. */}
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
            <div>
              {/* Header + toggle — mirrors the "Cinema scope" picker used in auto-schedule
                  showtime creation, so cluster-picking reads the same way across the admin. */}
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 600 }}>
                    Cinema cluster(s) <span className="text-rose-500">*</span>
                  </p>
                  <p style={{ color: "var(--text-sub)", fontSize: "11px" }}>
                    {allActive ? clusters.length : selectedClusterIds.size} selected
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setAllActive(!allActive); setSelectedClusterIds(new Set()); }}
                  className="flex-shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                  style={{ borderColor: allActive ? "rgba(37,99,235,0.35)" : "var(--border-color)", background: allActive ? "rgba(37,99,235,0.1)" : "var(--bg-card)", color: allActive ? "#2563eb" : "var(--text-main)" }}
                >
                  {allActive ? "Clear all" : `All active (${clusters.length})`}
                </button>
              </div>

              <div className="relative mb-2">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
                <input
                  type="text"
                  value={clusterSearch}
                  onChange={(event) => setClusterSearch(event.target.value)}
                  placeholder="Search cinema or city…"
                  className="w-full rounded-xl border py-2 pl-8 pr-3 outline-none focus:ring-2 focus:ring-blue-500/20"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }}
                />
              </div>

              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
                {visibleClusters.map((cluster) => {
                  const selected = allActive || selectedClusterIds.has(cluster.clusterId);
                  return (
                    <label
                      key={cluster.clusterId}
                      className="relative flex cursor-pointer items-center gap-3 rounded-xl border p-2.5"
                      style={{
                        borderColor: selected ? "rgba(37,99,235,0.4)" : "var(--border-color)",
                        background: selected ? "rgba(37,99,235,0.06)" : "var(--bg-card)",
                        cursor: allActive ? "not-allowed" : "pointer",
                      }}
                    >
                      <input
                        className="sr-only"
                        type="checkbox"
                        disabled={allActive}
                        checked={selected}
                        onChange={() => toggleCluster(cluster.clusterId)}
                      />
                      <div className="h-11 w-14 flex-shrink-0 overflow-hidden rounded-lg" style={{ background: "var(--bg-hover)" }}>
                        {cluster.coverImageUrl
                          ? <img src={cluster.coverImageUrl} alt="" className="h-full w-full object-cover" />
                          : <div className="flex h-full w-full items-center justify-center" style={{ color: "var(--text-sub)" }}><Building2 size={16} /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate" style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{cluster.clusterName}</p>
                        <p className="flex items-center gap-1 truncate" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                          <MapPin size={10} />{cluster.province || cluster.address}
                        </p>
                        <p style={{ fontSize: "11px", color: "#059669" }}>
                          {cluster.totalRooms ?? "—"} rooms · {(cluster.totalSeats ?? 0).toLocaleString()} seats
                        </p>
                      </div>
                      <span
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border"
                        style={{ borderColor: selected ? "#2563eb" : "var(--border-color)", background: selected ? "#2563eb" : "transparent" }}
                      >
                        {selected && <Check size={12} color="#fff" />}
                      </span>
                    </label>
                  );
                })}
                {visibleClusters.length === 0 && clusters.length > 0 && (
                  <p className="py-4 text-center" style={{ fontSize: "12px", color: "var(--text-sub)" }}>
                    No cluster matches "{clusterSearch}".
                  </p>
                )}
              </div>
              {clusters.length === 0 && (
                <p className="mt-1.5 text-amber-600" style={{ fontSize: "11px" }}>
                  No active cinema cluster is available. Approve and activate a cluster first.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block" style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 600 }}>
                    Starts <span className="text-rose-500">*</span>
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
                    Ends {!continuesUntilFurtherNotice && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="date"
                    min={showingStartDate || today()}
                    value={showingEndDate}
                    disabled={continuesUntilFurtherNotice}
                    onChange={(event) => setShowingEndDate(event.target.value)}
                    className="w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ colorScheme: "var(--color-scheme)" as string, background: "var(--bg-card)", borderColor: invalidDateRange ? "#e11d48" : "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }}
                  />
                </div>
              </div>
              {invalidDateRange && <p style={{ fontSize: "11px", color: "#f43f5e", marginTop: "-8px" }}>End date cannot be before start date.</p>}

              <label
                className="flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5"
                style={{
                  borderColor: continuesUntilFurtherNotice ? "rgba(37,99,235,0.3)" : "var(--border-color)",
                  background: continuesUntilFurtherNotice ? "rgba(37,99,235,0.06)" : "var(--bg-card)",
                }}
              >
                <input
                  type="checkbox"
                  checked={continuesUntilFurtherNotice}
                  onChange={(event) => {
                    setContinuesUntilFurtherNotice(event.target.checked);
                    if (event.target.checked) setShowingEndDate("");
                  }}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <span>
                  <strong className="block text-xs" style={{ color: "var(--text-main)" }}>Continue until further notice</strong>
                  <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-sub)" }}>Use when the cinema has intentionally not scheduled an end date.</span>
                </span>
              </label>

              <div>
                <label className="mb-1.5 block" style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 600 }}>
                  Sales start <span style={{ color: "var(--text-sub)", fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={salesStartAt}
                  onChange={(event) => setSalesStartAt(event.target.value)}
                  className="w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/20"
                  style={{ colorScheme: "var(--color-scheme)" as string, background: "var(--bg-card)", borderColor: invalidSalesStart ? "#e11d48" : "var(--border-color)", color: "var(--text-main)", fontSize: "13px" }}
                />
                <p className="mt-1.5" style={{ color: "var(--text-sub)", fontSize: "11px" }}>
                  Once approved, this plan will open automatically at this local cinema time. Leave blank for manual opening.
                </p>
                {invalidSalesStart && <p className="mt-1 text-rose-500" style={{ fontSize: "11px" }}>Sales must open on or before the first showing date.</p>}
              </div>

              <div className="rounded-xl border p-3" style={{ borderColor: "rgba(37,99,235,0.18)", background: "rgba(37,99,235,0.05)" }}>
                <div className="flex items-center gap-2 text-blue-600">
                  <CheckCircle2 size={14} />
                  <p style={{ fontSize: "12px", fontWeight: 600 }}>New plan starts as PLANNED</p>
                </div>
                <p className="mt-1 pl-[22px]" style={{ color: "var(--text-sub)", fontSize: "11px" }}>
                  Submit it for administrator review. Only an approved plan is visible to customers.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-7 py-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
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
            {submitting
              ? "Creating..."
              : targetCount > 1
                ? `Create ${targetCount} release plans`
                : "Create release plan"}
            {!submitting && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MovieAvailabilityPanel({ movieId }: Props) {
  const navigate = useNavigate();
  const { isAdmin, hasPermission } = useRole();
  const canPrepareReleasePlan = isAdmin || hasPermission("RELEASE_PLAN_EDIT");
  const canSubmitReleasePlan = isAdmin || hasPermission("RELEASE_PLAN_SUBMIT");
  const canReviewReleasePlan = isAdmin || hasPermission("RELEASE_PLAN_APPROVE");
  const canActivateReleasePlan = isAdmin || hasPermission("RELEASE_PLAN_ACTIVATE");
  const [availabilities, setAvailabilities] = useState<MovieAvailabilityResponse[]>([]);
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<number>>(new Set());
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<Set<number>>(new Set());
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkApprovalOpen, setBulkApprovalOpen] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<number | null>(null);
  const [closeTarget, setCloseTarget] = useState<number | null>(null);
  const [changesTarget, setChangesTarget] = useState<number | null>(null);
  const [reviewTarget, setReviewTarget] = useState<number | null>(null);
  const [planFilter, setPlanFilter] = useState<PlanFilter>(canReviewReleasePlan ? "AWAITING" : "CURRENT");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [availabilityResponse, clusterResponse] = await Promise.all([
        movieApi.searchAvailabilities({ movieId }),
        movieApi.getClusters(),
      ]);
      const nextAvailabilities = availabilityResponse.result ?? [];
      setAvailabilities(nextAvailabilities);
      setSelectedReviewIds((current) => new Set(
        Array.from(current).filter((id) => nextAvailabilities.some((item) =>
          item.availabilityId === id
          && (item.status === "PLANNED" || item.status === "CHANGES_REQUESTED"),
        )),
      ));
      setSelectedApprovalIds((current) => new Set(
        Array.from(current).filter((id) => nextAvailabilities.some((item) =>
          item.availabilityId === id && item.status === "IN_REVIEW",
        )),
      ));
      setClusters((clusterResponse.result ?? []).filter((cluster) => cluster.status === "ACTIVE"));
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? "Release plans could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [movieId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribeLifecycleEvents((event) => {
    if (event.aggregateType === "RELEASE_PLAN" && event.movieId === movieId) {
      void load();
    }
  }), [load, movieId]);

  const counts = useMemo(() => ({
    total: availabilities.length,
    current: availabilities.filter((item) => item.status !== "CLOSED").length,
    history: availabilities.filter((item) => item.status === "CLOSED").length,
    changes: availabilities.filter((item) => item.status === "CHANGES_REQUESTED").length,
    review: availabilities.filter((item) => item.status === "IN_REVIEW").length,
    approvedReady: availabilities.filter((item) => item.status === "APPROVED" || item.status === "OPEN").length,
  }), [availabilities]);

  const filteredAvailabilities = useMemo(() => availabilities.filter((item) => {
    if (planFilter === "CURRENT") return item.status !== "CLOSED";
    if (planFilter === "AWAITING") return item.status === "IN_REVIEW";
    if (planFilter === "CHANGES") return item.status === "CHANGES_REQUESTED";
    if (planFilter === "APPROVED") return item.status === "APPROVED" || item.status === "OPEN";
    return item.status === "CLOSED";
  }), [availabilities, planFilter]);

  const selectedReviewPlan = reviewTarget === null
    ? null
    : availabilities.find((item) => item.availabilityId === reviewTarget) ?? null;

  const reviewEligiblePlans = useMemo(
    () => availabilities.filter((item) => item.status === "PLANNED" || item.status === "CHANGES_REQUESTED"),
    [availabilities],
  );
  const allReviewEligibleSelected = reviewEligiblePlans.length > 0
    && reviewEligiblePlans.every((item) => selectedReviewIds.has(item.availabilityId));
  const approvalEligiblePlans = useMemo(
    () => availabilities.filter((item) => item.status === "IN_REVIEW"),
    [availabilities],
  );
  const selectedApprovalPlans = useMemo(
    () => approvalEligiblePlans.filter((item) => selectedApprovalIds.has(item.availabilityId)),
    [approvalEligiblePlans, selectedApprovalIds],
  );
  const allApprovalEligibleSelected = approvalEligiblePlans.length > 0
    && approvalEligiblePlans.every((item) => selectedApprovalIds.has(item.availabilityId));

  const toggleReviewSelection = (id: number) => {
    setSelectedReviewIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllReviewEligible = () => {
    setSelectedReviewIds(allReviewEligibleSelected
      ? new Set()
      : new Set(reviewEligiblePlans.map((item) => item.availabilityId)));
  };

  const toggleApprovalSelection = (id: number) => {
    setSelectedApprovalIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllApprovalEligible = () => {
    setSelectedApprovalIds(allApprovalEligibleSelected
      ? new Set()
      : new Set(approvalEligiblePlans.map((item) => item.availabilityId)));
  };

  const approveSelectedPlans = async (note?: string) => {
    if (selectedApprovalPlans.length === 0 || bulkApproving) return;
    setBulkApproving(true);
    setError(null);
    try {
      const response = await movieApi.bulkDecideAvailabilities({
        decision: "APPROVE",
        plans: selectedApprovalPlans.map((plan) => ({
          availabilityId: plan.availabilityId,
          expectedVersion: plan.version ?? 0,
        })),
        note,
      }, crypto.randomUUID());
      const failedIds = new Set(response.result.failed.map((failure) => failure.availabilityId));
      setSelectedApprovalIds(failedIds);
      setBulkApprovalOpen(false);
      await load();
      if (response.result.failed.length > 0) {
        setError(`${response.result.succeeded.length} plan${response.result.succeeded.length === 1 ? " was" : "s were"} approved. ${response.result.failed.length} changed or could not be approved and remain selected.`);
      }
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? "The selected release plans could not be approved.");
    } finally {
      setBulkApproving(false);
    }
  };

  const submitSelectedForReview = async () => {
    const ids = Array.from(selectedReviewIds);
    if (ids.length === 0 || bulkSubmitting) return;

    setBulkSubmitting(true);
    setError(null);
    const results = await Promise.allSettled(ids.map((id) => movieApi.submitAvailabilityReview(id)));
    const failedIds = ids.filter((_, index) => results[index].status === "rejected");
    await load();
    setSelectedReviewIds(new Set(failedIds));
    if (failedIds.length > 0) {
      const succeeded = ids.length - failedIds.length;
      setError(`${succeeded} release plan${succeeded === 1 ? " was" : "s were"} submitted. ${failedIds.length} could not be submitted and remain selected.`);
    }
    setBulkSubmitting(false);
  };

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

  const renderReleasePlanActions = (availability: MovieAvailabilityResponse, busy: boolean) => (
    <div className="flex min-h-9 items-center justify-end gap-2">
      {(availability.status === "APPROVED" || availability.status === "OPEN") && (
        <button
          type="button"
          onClick={() => goToScheduling(availability)}
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-500/5"
          style={{ borderColor: "rgba(37,99,235,0.25)" }}
        >
          <Clock3 size={14} /> Schedule
        </button>
      )}

      {canSubmitReleasePlan && !busy && !bulkSubmitting && (availability.status === "PLANNED" || availability.status === "CHANGES_REQUESTED") && (
        <button
          type="button"
          onClick={() => void runCommand(availability.availabilityId, () => movieApi.submitAvailabilityReview(availability.availabilityId))}
          className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Send size={14} /> Submit
        </button>
      )}

      {canReviewReleasePlan && !busy && availability.status === "IN_REVIEW" && (
        <button
          type="button"
          onClick={() => setReviewTarget(availability.availabilityId)}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-[10px] border px-3.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-500/[0.08]"
          style={{ borderColor: "rgba(37,99,235,0.28)", background: "rgba(37,99,235,0.05)" }}
        >
          Review plan
        </button>
      )}

      {canActivateReleasePlan && !busy && availability.status === "APPROVED" && (
        <button
          type="button"
          onClick={() => void runCommand(availability.availabilityId, () => movieApi.openAvailability(availability.availabilityId))}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          <Play size={14} /> Activate
        </button>
      )}

      {canActivateReleasePlan && !busy && availability.status === "OPEN" && (
        <button
          type="button"
          onClick={() => setSuspendTarget(availability.availabilityId)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/10"
          style={{ borderColor: "rgba(217,119,6,0.3)" }}
        >
          <Pause size={14} /> Suspend
        </button>
      )}

      {canActivateReleasePlan && !busy && availability.status === "SUSPENDED" && (
        <button
          type="button"
          onClick={() => void runCommand(availability.availabilityId, () => movieApi.resumeAvailability(availability.availabilityId))}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          <Play size={14} /> Resume
        </button>
      )}

      {canActivateReleasePlan
        && !busy
        && availability.status !== "CLOSED"
        && availability.status !== "IN_REVIEW"
        && (
        <button
          type="button"
          onClick={() => setCloseTarget(availability.availabilityId)}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-[10px] bg-rose-500/10 px-3.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-500/[0.16]"
        >
          {getTerminalPlanActionLabel(availability.status)}
        </button>
      )}

      {busy && <span className="whitespace-nowrap text-xs" style={{ color: "var(--text-sub)" }}>Updating…</span>}
    </div>
  );

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border p-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          {([
            ["CURRENT", "Current plans", counts.current],
            ["AWAITING", "Awaiting decision", counts.review],
            ["CHANGES", "Changes requested", counts.changes],
            ["APPROVED", "Approved", counts.approvedReady],
            ["HISTORY", "History", counts.history],
          ] as Array<[PlanFilter, string, number]>).map(([key, label, count]) => {
            const active = planFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPlanFilter(key)}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[9px] px-3 text-xs font-semibold transition-colors"
                style={{ color: active ? "#2563eb" : "var(--text-sub)", background: active ? "rgba(37,99,235,0.10)" : "transparent" }}
              >
                {label}
                <span className="min-w-5 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ color: active ? "#2563eb" : "var(--text-sub)", background: active ? "rgba(37,99,235,0.12)" : "var(--bg-hover)" }}>{count}</span>
              </button>
            );
          })}
        </div>
        {canPrepareReleasePlan && (
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={13} /> New release plan
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-rose-600">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <p style={{ fontSize: "12px" }}>{error}</p>
        </div>
      )}

      {!loading && canSubmitReleasePlan && reviewEligiblePlans.length > 0 && (
        <div
          className="mt-4 flex flex-col gap-3 rounded-xl border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "rgba(37,99,235,0.28)", background: "rgba(37,99,235,0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <SelectionCheckbox
              checked={allReviewEligibleSelected}
              indeterminate={selectedReviewIds.size > 0 && !allReviewEligibleSelected}
              label={allReviewEligibleSelected ? "Clear all selected release plans" : "Select all release plans ready for review"}
              onChange={toggleAllReviewEligible}
            />
            <span style={{ color: "var(--text-main)", fontSize: "12px", fontWeight: 650 }}>
              {selectedReviewIds.size > 0
                ? `${selectedReviewIds.size} of ${reviewEligiblePlans.length} ready plans selected`
                : `Select all ${reviewEligiblePlans.length} plans ready for review`}
            </span>
          </div>
          <button
            type="button"
            disabled={selectedReviewIds.size === 0 || bulkSubmitting}
            onClick={() => void submitSelectedForReview()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={12} />
            {bulkSubmitting ? "Submitting..." : `Submit ${selectedReviewIds.size || "selected"} for review`}
          </button>
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
          {canPrepareReleasePlan && (
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
      ) : filteredAvailabilities.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed px-5 py-10 text-center" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <h4 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>No plans in this view</h4>
          <p className="mt-1 text-xs" style={{ color: "var(--text-sub)" }}>Choose another status filter to continue.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", boxShadow: "0 4px 14px rgba(15,23,42,0.06)" }}>
          <div
            className="hidden min-h-12 items-center gap-4 border-b px-4 xl:grid"
            style={{
              gridTemplateColumns: "minmax(220px,1.2fr) minmax(180px,.9fr) minmax(150px,.75fr) minmax(145px,.65fr) minmax(180px,.8fr)",
              borderColor: "var(--border-color)",
              background: "var(--bg-main)",
              color: "var(--text-sub)",
              fontSize: "10.5px",
              fontWeight: 700,
              letterSpacing: ".07em",
              textTransform: "uppercase",
            }}
          >
            <span className="flex items-center gap-3">
              {canReviewReleasePlan && approvalEligiblePlans.length > 0 && (
                <SelectionCheckbox
                  checked={allApprovalEligibleSelected}
                  indeterminate={selectedApprovalIds.size > 0 && !allApprovalEligibleSelected}
                  label={allApprovalEligibleSelected ? "Clear all selected release plans" : "Select all release plans awaiting a decision"}
                  onChange={toggleAllApprovalEligible}
                />
              )}
              <span>Cinema cluster</span>
            </span>
            <span>Exhibition window</span>
            <span>Sales start</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {filteredAvailabilities.map((availability) => {
            const meta = STATUS_META[availability.status];
            const busy = busyId === availability.availabilityId;
            const submitSelectable = canSubmitReleasePlan && (availability.status === "PLANNED" || availability.status === "CHANGES_REQUESTED");
            const approvalSelectable = canReviewReleasePlan && availability.status === "IN_REVIEW";
            const selectable = submitSelectable || approvalSelectable;
            const selected = approvalSelectable
              ? selectedApprovalIds.has(availability.availabilityId)
              : selectedReviewIds.has(availability.availabilityId);

            return (
              <div
                key={availability.availabilityId}
                className="grid grid-cols-1 gap-4 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-blue-500/[0.035] xl:grid-cols-[minmax(220px,1.2fr)_minmax(180px,.9fr)_minmax(150px,.75fr)_minmax(145px,.65fr)_minmax(180px,.8fr)] xl:items-center"
                style={{
                  borderColor: "var(--border-color)",
                  background: selected ? "rgba(37,99,235,0.055)" : undefined,
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {selectable ? (
                    <SelectionCheckbox
                      checked={selected}
                      onChange={() => approvalSelectable
                        ? toggleApprovalSelection(availability.availabilityId)
                        : toggleReviewSelection(availability.availabilityId)}
                      label={`${selected ? "Clear" : "Select"} release plan for ${availability.clusterName ?? `cluster ${availability.clusterId}`}`}
                    />
                  ) : <span className="hidden h-4 w-4 shrink-0 xl:block" />}
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600/10 text-blue-600"><MapPin size={16} /></span>
                  <div className="min-w-0">
                    <strong className="block truncate text-[13.5px]" style={{ color: "var(--text-main)" }}>{availability.clusterName ?? `Cluster #${availability.clusterId}`}</strong>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.06em] xl:hidden" style={{ color: "var(--text-sub)" }}>Exhibition window</span>
                  <strong className="block text-[13px]" style={{ color: "var(--text-main)" }}>Starts {formatDate(availability.showingStartDate)}</strong>
                  <span className="mt-1 block text-xs" style={{ color: availability.showingEndDate ? "var(--text-sub)" : "#b45309" }}>
                    {availability.showingEndDate ? `Ends ${formatDate(availability.showingEndDate)}` : "Until further notice"}
                  </span>
                </div>

                <div>
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.06em] xl:hidden" style={{ color: "var(--text-sub)" }}>Sales start</span>
                  <strong className="block text-[13px]" style={{ color: "var(--text-main)" }}>{formatDateTime(availability.salesStartAt)}</strong>
                </div>

                <div className="min-w-0">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.06em] xl:hidden" style={{ color: "var(--text-sub)" }}>Status</span>
                  <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-bold" style={{ color: meta.color, background: meta.background, borderColor: meta.border }}>{meta.label}</span>
                  {availability.reviewNote && (
                    <span className="mt-1.5 block truncate text-[11px]" title={availability.reviewNote} style={{ color: "var(--text-sub)" }}>{availability.reviewNote}</span>
                  )}
                  {availability.suspensionReason && (
                    <span className="mt-1.5 block truncate text-[11px] text-amber-600" title={availability.suspensionReason}>{availability.suspensionReason}</span>
                  )}
                </div>

                <div className="xl:justify-self-end">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.06em] xl:hidden" style={{ color: "var(--text-sub)" }}>Actions</span>
                  {renderReleasePlanActions(availability, busy)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedApprovalIds.size > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto mt-4 flex w-fit max-w-[calc(100%-1rem)] items-center gap-3 rounded-xl border px-4 py-3 shadow-xl backdrop-blur" style={{ borderColor: "rgba(37,99,235,0.3)", background: "color-mix(in srgb, var(--bg-card) 94%, transparent)" }}>
          <span className="whitespace-nowrap text-sm font-semibold" style={{ color: "var(--text-main)" }}>{selectedApprovalIds.size} selected</span>
          <button type="button" onClick={() => setSelectedApprovalIds(new Set())} className="h-9 rounded-[9px] px-3 text-xs font-semibold transition-colors hover:bg-slate-500/10" style={{ color: "var(--text-sub)" }}>Clear</button>
          <button type="button" onClick={() => setBulkApprovalOpen(true)} className="h-9 rounded-[9px] bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700">Approve selected</button>
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
          action={getTerminalPlanAction(
            availabilities.find((item) => item.availabilityId === closeTarget)?.status ?? "PLANNED",
          )}
          onConfirm={(reason) => {
            const id = closeTarget;
            setCloseTarget(null);
            void runCommand(id, () => movieApi.closeAvailability(id, reason));
          }}
          onCancel={() => setCloseTarget(null)}
        />
      )}

      {selectedReviewPlan && (
        <ReleasePlanReviewModal
          availability={selectedReviewPlan}
          busy={busyId === selectedReviewPlan.availabilityId}
          onClose={() => setReviewTarget(null)}
          onRequestChanges={() => {
            setReviewTarget(null);
            setChangesTarget(selectedReviewPlan.availabilityId);
          }}
          onApprove={() => {
            const id = selectedReviewPlan.availabilityId;
            setReviewTarget(null);
            void runCommand(id, () => movieApi.approveAvailability(id));
          }}
        />
      )}

      {bulkApprovalOpen && selectedApprovalPlans.length > 0 && (
        <BulkApprovalModal
          plans={selectedApprovalPlans}
          busy={bulkApproving}
          onClose={() => { if (!bulkApproving) setBulkApprovalOpen(false); }}
          onConfirm={(note) => void approveSelectedPlans(note)}
        />
      )}

      {changesTarget !== null && (
        <ReleaseReviewPrompt
          onConfirm={(note) => {
            const id = changesTarget;
            setChangesTarget(null);
            void runCommand(id, () => movieApi.requestAvailabilityChanges(id, note));
          }}
          onCancel={() => setChangesTarget(null)}
        />
      )}
    </section>
  );
}
