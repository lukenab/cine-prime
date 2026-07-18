import { useState } from "react";
import { X, CheckCircle, XCircle, Loader2, MapPin, Clock, Building2, User, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import type { ClusterOperatingHour, ClusterResponse } from "../api/movieApi";

type Props = {
  open: boolean;
  cluster: ClusterResponse | null;
  onClose: () => void;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number, note: string) => Promise<void>;
};

const MIN_NOTE_LENGTH = 10;

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu",
  FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

const FL: React.CSSProperties = {
  fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.07em",
  textTransform: "uppercase", color: "var(--text-sub)", marginBottom: "4px",
};

const shortTime = (t?: string) => (t ? t.slice(0, 5) : "—");

function scheduleLabel(h: ClusterOperatingHour): string {
  if (h.closed) return "Closed";
  return `${shortTime(h.opensAt)}–${shortTime(h.closesAt)}${h.closesNextDay ? " (+1d)" : ""}`;
}

/** Collapses consecutive days that share the same schedule into one range, e.g. "Mon–Sun". */
function groupOperatingHours(hours: ClusterOperatingHour[]) {
  const groups: { firstDay: ClusterOperatingHour["dayOfWeek"]; lastDay: ClusterOperatingHour["dayOfWeek"]; label: string }[] = [];
  for (const h of hours) {
    const label = scheduleLabel(h);
    const current = groups[groups.length - 1];
    if (current && current.label === label) {
      current.lastDay = h.dayOfWeek;
    } else {
      groups.push({ firstDay: h.dayOfWeek, lastDay: h.dayOfWeek, label });
    }
  }
  return groups;
}

/**
 * Full-detail confirmation step before an admin approves/rejects a cluster —
 * mirrors PendingReviewModal (movies) so the reviewer sees the actual submitted
 * data (address, coordinates, contact, operating hours, submitter) instead of
 * approving off a bare table row.
 */
export function ClusterReviewModal({ open, cluster, onClose, onApprove, onReject }: Props) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);

  if (!open || !cluster) return null;

  const resetAndClose = () => {
    if (submitting) return;
    setShowRejectForm(false);
    setNote("");
    onClose();
  };

  const handleApprove = async () => {
    setSubmitting("approve");
    try {
      await onApprove(cluster.clusterId);
      toast.success(`"${cluster.clusterName}" approved.`);
      setShowRejectForm(false);
      setNote("");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Approve failed.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (note.trim().length < MIN_NOTE_LENGTH) return;
    setSubmitting("reject");
    try {
      await onReject(cluster.clusterId, note.trim());
      toast.success(`Changes requested for "${cluster.clusterName}".`);
      setShowRejectForm(false);
      setNote("");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Reject failed.");
    } finally {
      setSubmitting(null);
    }
  };

  const noteTooShort = note.trim().length > 0 && note.trim().length < MIN_NOTE_LENGTH;
  // cluster.address is already the full formatted address (street, ward, city, postal, country);
  // ward/province/postalCode/countryCode are just its normalized parts for search/filtering, not extra detail.
  const addressLines = [cluster.buildingName, cluster.floorLocation, cluster.address].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={resetAndClose} />

      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-main)", maxHeight: "88vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock size={15} className="text-amber-600" />
            </div>
            <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)" }}>Review Cinema Cluster</p>
          </div>
          <button
            type="button" onClick={resetAndClose} disabled={!!submitting}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40"
            style={{ color: "var(--text-sub)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <MapPin size={15} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)" }}>{cluster.clusterName}</h3>
              <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>
                {cluster.clusterCode} · {cluster.venueType.replace(/_/g, " ")}
              </p>
            </div>
          </div>

          <div>
            <p style={FL}>Address</p>
            <p style={{ fontSize: "13px", color: "var(--text-main)", lineHeight: 1.5 }}>
              {addressLines.join(", ")}
            </p>
            {cluster.latitude != null && cluster.longitude != null && (
              <p style={{ fontSize: "11.5px", color: "#10b981", marginTop: "2px" }}>
                {cluster.latitude.toFixed(4)}, {cluster.longitude.toFixed(4)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap" style={{ fontSize: "12.5px", color: "var(--text-sub)" }}>
            <span className="flex items-center gap-1"><Building2 size={12} /> {cluster.timezone}</span>
            {cluster.openingDate && <span>Opening: {cluster.openingDate}</span>}
            {cluster.createdBy && (
              <span className="flex items-center gap-1"><User size={12} /> Created by {cluster.createdBy}</span>
            )}
          </div>

          <div>
            <p style={FL}>Operating Hours</p>
            <div className="space-y-1">
              {groupOperatingHours(cluster.operatingHours).map((g) => (
                <div key={g.firstDay} className="flex items-center justify-between" style={{ fontSize: "12.5px" }}>
                  <span style={{ color: "var(--text-sub)" }}>
                    {g.firstDay === g.lastDay
                      ? DAY_LABELS[g.firstDay] ?? g.firstDay
                      : `${DAY_LABELS[g.firstDay] ?? g.firstDay}–${DAY_LABELS[g.lastDay] ?? g.lastDay}`}
                  </span>
                  <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{g.label}</span>
                </div>
              ))}
            </div>
          </div>

          {cluster.rejectionNote && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50">
              <AlertCircle size={13} className="text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "#dc2626" }}>Previous rejection note</p>
                <p style={{ fontSize: "12px", color: "#b91c1c" }}>{cluster.rejectionNote}</p>
              </div>
            </div>
          )}

          {/* Rejection note - hidden until Reject is clicked */}
          {showRejectForm && (
            <div className="pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-sub)", display: "block", marginBottom: "6px" }}>
                Rejection note (required, min {MIN_NOTE_LENGTH} characters)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Mô tả vấn đề cụ thể: địa chỉ không đúng, tên trùng, tọa độ sai…"
                rows={3}
                autoFocus
                disabled={submitting === "reject"}
                className="w-full px-3 py-2.5 rounded-xl border outline-none focus:ring-2 resize-none disabled:opacity-60"
                style={{
                  fontSize: "13px", background: "var(--bg-card)", color: "var(--text-main)",
                  borderColor: noteTooShort ? "#dc2626" : "var(--border-color)",
                }}
              />
              <p style={{ fontSize: "11px", color: noteTooShort ? "#dc2626" : "var(--text-sub)", marginTop: "4px" }}>
                {note.trim().length}/{MIN_NOTE_LENGTH} characters minimum
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center gap-3 flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
          {!showRejectForm ? (
            <>
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={!!submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-40"
                style={{ color: "#dc2626", borderColor: "#dc2626", background: "transparent" }}
              >
                <XCircle size={15} /> Reject
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={!!submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ background: "#059669" }}
              >
                {submitting === "approve" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                Approve
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setShowRejectForm(false); setNote(""); }}
                disabled={submitting === "reject"}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 disabled:opacity-40"
                style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting === "reject" || note.trim().length < MIN_NOTE_LENGTH}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
                style={{ background: "#dc2626" }}
              >
                {submitting === "reject" ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                Confirm Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
