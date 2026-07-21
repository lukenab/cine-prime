import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation, useOutletContext } from "react-router-dom";
import { Armchair, RefreshCw, AlertCircle, X, Check, SendHorizonal, CheckCircle, XCircle, Rocket, Clock } from "lucide-react";
import { movieApi, type SeatResponse, type RoomResponse, type CinemaRoomDetail, type SeatTypeValue, type RoomLayoutDetail } from "../../api/movieApi";
import { useRole } from "../../hooks/useRole";
import { Toast } from "../../components/shared/Toast";
import { CinemaRoomHeader } from "./cinemaRoomEditor/CinemaRoomHeader";
import { AudioCoverageFrame, ProjectionBeamOverlay, ProjectionScreenVisualization } from "./cinemaRoomEditor/AuditoriumVisualization";
import { ProjectorLegendMarker, SpeakerLegendMarker } from "./cinemaRoomEditor/SeatLegend";
import { SeatGrid } from "./cinemaRoomEditor/SeatGrid";
import type { AuditoriumVisualizationConfig } from "./cinemaRoomEditor/cinemaRoomEditor.types";

// ── Layout workflow status config ───────────────────────────────────────────

export const LAYOUT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:             { label: "Draft",             color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
  PENDING_APPROVAL:  { label: "Pending Approval",   color: "#d97706", bg: "rgba(245,158,11,0.10)"  },
  APPROVED:          { label: "Approved",           color: "#2563eb", bg: "rgba(37,99,235,0.10)"   },
  ACTIVE:            { label: "Active",             color: "#10b981", bg: "rgba(16,185,129,0.10)"  },
  REJECTED:          { label: "Rejected",           color: "#ef4444", bg: "rgba(239,68,68,0.10)"   },
  SUPERSEDED:        { label: "Superseded",         color: "#9ca3af", bg: "rgba(156,163,175,0.10)" },
};

function RejectLayoutModal({ onConfirm, onCancel }: { onConfirm: (note: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} onClick={onCancel}>
      <div className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-4" style={{ background: "#dc262618" }}>
          <XCircle size={22} style={{ color: "#dc2626" }} />
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", textAlign: "center", marginBottom: "16px" }}>Reject Layout</h3>
        <div className="mb-4">
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-sub)", display: "block", marginBottom: "6px" }}>Rejection reason</label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Mô tả vấn đề cụ thể: sai số ghế, thiếu lối thoát hiểm, couple bị lỗi…"
            rows={3}
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border outline-none focus:ring-2 resize-none"
            style={{ fontSize: "13px", background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80" style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
            Cancel
          </button>
          <button
            onClick={() => value.trim() ? onConfirm(value.trim()) : null}
            disabled={!value.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#dc2626" }}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Seat type config ─────────────────────────────────────────────────────────

const SEAT_TYPES = ["STANDARD", "VIP", "COUPLE", "ACCESSIBLE"] as const;

/** Stable empty selection for the read-only pre-activation layout preview -
 *  SeatGrid always needs a Set, but nothing is ever selectable there. */
const EMPTY_SELECTION = new Set<string>();

const seatTypeStyle: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  STANDARD: {
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.35)",
    text: "#3b82f6",
    badge: "bg-blue-100 text-blue-700",
  },
  VIP: {
    bg: "rgba(251,191,36,0.14)",
    border: "rgba(251,191,36,0.45)",
    text: "#d97706",
    badge: "bg-amber-100 text-amber-700",
  },
  COUPLE: {
    bg: "rgba(168,85,247,0.12)",
    border: "rgba(168,85,247,0.35)",
    text: "#9333ea",
    badge: "bg-purple-100 text-purple-700",
  },
  ACCESSIBLE: {
    bg: "rgba(20,184,166,0.12)",
    border: "rgba(20,184,166,0.4)",
    text: "#0d9488",
    badge: "bg-teal-100 text-teal-700",
  },
};

const unavailableStyle = {
  bg: "rgba(128,128,128,0.08)",
  border: "rgba(128,128,128,0.2)",
  text: "#9ca3af",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
}

// ── Edit Seat Modal ───────────────────────────────────────────────────────────

type EditModalProps = {
  seat: SeatResponse;
  onClose: () => void;
  onSave: (seatType: SeatTypeValue, price: number) => Promise<void>;
  saving: boolean;
  isDarkMode: boolean;
};

function EditSeatModal({ seat, onClose, onSave, saving, isDarkMode }: EditModalProps) {
  const [form, setForm] = useState<{ seatType: SeatTypeValue; price: number }>({
    seatType: seat.seatType as SeatTypeValue,
    price: seat.price,
  });

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-main)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-card)" }}
      >
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{
                background: seatTypeStyle[form.seatType]?.bg ?? "rgba(128,128,128,0.1)",
                color: seatTypeStyle[form.seatType]?.text ?? "#9ca3af",
              }}
            >
              {seat.seatCode}
            </div>
            <h2 style={{ fontSize: "15px", color: "var(--text-main)", fontWeight: 600 }}>
              Edit Seat
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            style={{ color: "var(--text-sub)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Seat Type
            </label>
            <select
              value={form.seatType}
              onChange={(e) => setForm({ ...form, seatType: e.target.value as SeatTypeValue })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={inputStyle}
            >
              {SEAT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Price (VND)
            </label>
            <input
              type="number"
              min={1000}
              step={1000}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={inputStyle}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl border hover:opacity-80 disabled:opacity-50 transition-colors"
              style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => onSave(form.seatType, form.price)}
              className="flex-1 px-4 py-2.5 rounded-xl text-white hover:opacity-90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              style={{ fontSize: "14px", fontWeight: 500, background: isDarkMode ? "#3b82f6" : "#2563eb" }}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const { isAdmin, can } = useRole();

  const passedRoom = (location.state as any)?.room as RoomResponse | undefined;

  const [seats, setSeats] = useState<SeatResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSeat, setEditingSeat] = useState<SeatResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const [room, setRoom] = useState<CinemaRoomDetail | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const roomName =
    room?.cinemaRoomName ??
    passedRoom?.cinemaRoomName ??
    seats[0]?.cinemaRoomName ??
    `Room #${id}`;

  const backTarget = (room?.clusterId ?? passedRoom?.clusterId)
    ? `/admin/clusters/${room?.clusterId ?? passedRoom?.clusterId}`
    : "/admin/clusters";

  const clusterName = room?.clusterName ?? passedRoom?.clusterName;

  const loadSeats = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await movieApi.getSeatsByRoom(Number(id));
      setSeats(res.result ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load seats.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadRoom = useCallback(async () => {
    if (!id) return;
    try {
      const res = await movieApi.getRoomDetail(Number(id));
      setRoom(res.result);
    } catch {
      // Non-fatal — legacy rooms created via the old quick-create flow have no
      // wizard/layout data; the seat grid below still works without it.
    }
  }, [id]);

  useEffect(() => { loadSeats(); loadRoom(); }, [loadSeats, loadRoom]);

  const layout = room?.activeLayout;
  const layoutCfg = layout ? LAYOUT_STATUS_CONFIG[layout.status] : null;

  // PENDING_APPROVAL/APPROVED layouts have no Seat rows yet (those are only
  // created on Activate - see RoomLayoutService.activate()), so the seat grid
  // below would otherwise render nothing for an admin trying to review what
  // they're about to approve/activate. The layout's own positions already
  // carry the full seat map design - fetch it once we know which layout is
  // active so we can preview from that instead of from real seats.
  const [layoutDetail, setLayoutDetail] = useState<RoomLayoutDetail | null>(null);
  useEffect(() => {
    if (!id || !layout || layout.status === "ACTIVE") { setLayoutDetail(null); return; }
    let cancelled = false;
    movieApi.getRoomLayout(Number(id), layout.roomLayoutId)
      .then((res) => { if (!cancelled) setLayoutDetail(res.result); })
      .catch(() => { if (!cancelled) setLayoutDetail(null); });
    return () => { cancelled = true; };
  }, [id, layout?.roomLayoutId, layout?.status]);

  const doLayoutWorkflow = async (fn: () => Promise<unknown>, successMessage: string) => {
    if (!room || !layout) return;
    setWorkflowBusy(true);
    try {
      await fn();
      showToast("success", successMessage);
      await Promise.all([loadRoom(), loadSeats()]);
    } catch (err: any) {
      showToast("error", err?.response?.data?.message ?? "Action failed.");
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleSave = async (seatType: SeatTypeValue, price: number) => {
    if (!editingSeat) return;
    setSaving(true);
    try {
      const res = await movieApi.updateSeat(editingSeat.seatId, { seatType, price });
      setSeats((prev) =>
        prev.map((s) => (s.seatId === editingSeat.seatId ? res.result : s))
      );
      setEditingSeat(null);
    } catch (err: any) {
      showToast("error", err?.response?.data?.message ?? "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  // Group seats by row letter, sort within each row by column number
  const seatsByRow = seats.reduce<Record<string, SeatResponse[]>>((acc, seat) => {
    const row = seat.seatCode[0];
    (acc[row] ??= []).push(seat);
    return acc;
  }, {});

  const rows = Object.keys(seatsByRow).sort();
  rows.forEach((r) =>
    seatsByRow[r].sort((a, b) => {
      const colA = parseInt(a.seatCode.slice(1));
      const colB = parseInt(b.seatCode.slice(1));
      return colA - colB;
    })
  );

  const typeCount = seats.reduce<Record<string, number>>((acc, s) => {
    acc[s.seatType] = (acc[s.seatType] ?? 0) + 1;
    return acc;
  }, {});

  // Mirrors the create page's visualization exactly — same config shape, same
  // graceful fallback to a plain Standard screen when a legacy room has no
  // projection/audio tech recorded.
  const visualizationConfig: AuditoriumVisualizationConfig = {
    presentationSystem: room?.presentationSystem ?? "STANDARD",
    projectionTechnologyCode: room?.projectionTechnologyCode,
    projectionTechnologyName: room?.projectionTechnologyName,
    resolutionCode: room?.resolutionCode,
    audioFormatCode: room?.audioFormatCode,
  };
  const showProjector = visualizationConfig.projectionTechnologyCode === "LASER" || visualizationConfig.projectionTechnologyCode === "XENON";
  const showSpeakers = Boolean(visualizationConfig.audioFormatCode);

  return (
    <>
      <CinemaRoomHeader
        mode="view"
        roomName={roomName}
        clusterName={clusterName}
        onBack={() => navigate(backTarget)}
        subtitle={
          <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
            {clusterName && <>{clusterName} · </>}
            {seats.length} seats · {rows.length} rows
          </p>
        }
      />

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Wizard layout workflow — only shown for rooms created via the wizard (have a
          room_layout). Legacy quick-create rooms are already ACTIVE with real seats and
          have no `activeLayout`, so this section stays hidden for them. */}
      {layout && layoutCfg && (
        <div className="rounded-2xl border p-4 mb-6 flex items-center gap-4 flex-wrap" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0"
            style={{ background: layoutCfg.bg, color: layoutCfg.color }}
          >
            <Clock size={12} /> Layout v{layout.version} · {layoutCfg.label}
          </span>
          <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>
            {layout.personCapacity} people capacity · {layout.sellableUnitCount} sellable units
          </span>

          <div className="flex items-center gap-2 ml-auto">
            {layout.status === "DRAFT" && can.edit && (
              <button
                onClick={() => navigate(`/admin/clusters/${room?.clusterId}/rooms/${id}/edit`)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border hover:opacity-80"
                style={{ fontSize: "13px", color: "var(--text-main)", borderColor: "var(--border-color)", background: "var(--bg-main)" }}
              >
                Continue Editing
              </button>
            )}
            {layout.status === "PENDING_APPROVAL" && isAdmin && (
              <>
                <button
                  disabled={workflowBusy}
                  onClick={() => doLayoutWorkflow(
                    () => movieApi.approveRoomLayout(Number(id), layout.roomLayoutId),
                    "Layout approved."
                  )}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border hover:opacity-80 disabled:opacity-50"
                  style={{ fontSize: "13px", color: "#059669", borderColor: "var(--border-color)", background: "var(--bg-main)" }}
                >
                  <CheckCircle size={14} /> Approve
                </button>
                <button
                  disabled={workflowBusy}
                  onClick={() => setRejecting(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border hover:opacity-80 disabled:opacity-50"
                  style={{ fontSize: "13px", color: "#dc2626", borderColor: "var(--border-color)", background: "var(--bg-main)" }}
                >
                  <XCircle size={14} /> Reject
                </button>
              </>
            )}
            {layout.status === "PENDING_APPROVAL" && !isAdmin && (
              <span className="flex items-center gap-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                <SendHorizonal size={14} /> Waiting for admin approval
              </span>
            )}
            {layout.status === "APPROVED" && isAdmin && (
              <button
                disabled={workflowBusy}
                onClick={() => doLayoutWorkflow(
                  () => movieApi.activateRoomLayout(Number(id), layout.roomLayoutId),
                  "Layout activated — seats are now live."
                )}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white hover:opacity-90 disabled:opacity-50"
                style={{ fontSize: "13px", fontWeight: 600, background: "#059669" }}
              >
                <Rocket size={14} /> {workflowBusy ? "Activating…" : "Activate"}
              </button>
            )}
            {layout.status === "APPROVED" && !isAdmin && (
              <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>Approved — waiting for admin to activate</span>
            )}
          </div>
        </div>
      )}

      {rejecting && layout && (
        <RejectLayoutModal
          onConfirm={(note) => {
            setRejecting(false);
            doLayoutWorkflow(
              () => movieApi.rejectRoomLayout(Number(id), layout.roomLayoutId, note),
              "Layout rejected."
            );
          }}
          onCancel={() => setRejecting(false)}
        />
      )}

      {/* Type summary chips */}
      {!loading && seats.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(typeCount).map(([type, count]) => (
            <span
              key={type}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${seatTypeStyle[type]?.badge ?? "bg-gray-100 text-gray-600"}`}
            >
              <Armchair size={11} />
              {type} · {count}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
            <Armchair size={11} />
            Total · {seats.length}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border border-rose-200 bg-rose-50">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
          <p style={{ fontSize: "14px", color: "#e11d48" }}>{error}</p>
          <button
            onClick={loadSeats}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors text-rose-600"
            style={{ fontSize: "13px" }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Seat grid */}
      <div
        className="rounded-2xl border"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", padding: "28px 24px" }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw size={20} className="animate-spin" style={{ color: "var(--text-sub)" }} />
            <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading seats…</p>
          </div>
        ) : seats.length === 0 && layoutDetail && layoutDetail.positions.length > 0 ? (
          <div>
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl" style={{ background: "rgba(37,99,235,0.08)", color: "#2563eb" }}>
              <AlertCircle size={14} className="flex-shrink-0" />
              <p style={{ fontSize: "12.5px" }}>
                Preview of the submitted layout — no real seats exist yet. Real, bookable seats are created once this layout is Activated.
              </p>
            </div>
            <div className="w-full min-w-0" style={{ overflow: "auto", maxHeight: "70vh", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "16px" }}>
              <div style={{ width: "fit-content", margin: "0 auto" }}>
                <SeatGrid
                  positions={layoutDetail.positions}
                  mode="SELECT"
                  selected={EMPTY_SELECTION}
                  onSelectionChange={() => {}}
                  onCommit={() => {}}
                  readOnly
                />
              </div>
            </div>
          </div>
        ) : seats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Armchair size={32} style={{ color: "var(--text-sub)" }} />
            <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>
              {layout && layout.status !== "ACTIVE"
                ? `No seats yet — this room's layout is still ${LAYOUT_STATUS_CONFIG[layout.status]?.label.toLowerCase() ?? layout.status}. Seats are only created once the layout is Activated (see the banner above).`
                : "No seats found for this room."}
            </p>
          </div>
        ) : (
          <>
            {/* Screen + projector booth — same visualization as the create page,
                driven by the room's recorded projection/audio tech. */}
            <div className={`relative${showProjector ? " pb-7" : ""}`}>
              <ProjectionScreenVisualization config={visualizationConfig} />
              <ProjectionBeamOverlay technologyCode={visualizationConfig.projectionTechnologyCode} />

              <AudioCoverageFrame config={visualizationConfig}>
                {/* Scrollable seat map — centred horizontally */}
                <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "fit-content", margin: "0 auto" }}>

                    {/* Rows */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {rows.map((row) => (
                    <div key={row} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {/* Row label */}
                      <span
                        style={{
                          width: "20px",
                          flexShrink: 0,
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "var(--text-sub)",
                          textAlign: "center",
                        }}
                      >
                        {row}
                      </span>

                      {/* Seats — no wrap, one line per row. flex:1 + justifyContent:center lam
                          hang ngan (VD Couple) tu can giua trong khoang trong giua 2 nhan hang,
                          thay vi dinh sat ben trai gay lech khoang trong ve 1 phia. */}
                      <div style={{ display: "flex", gap: "6px", flex: "1 1 auto", justifyContent: "center" }}>
                        {seatsByRow[row].map((seat) => {
                          const available = seat.status === "ACTIVE";
                          const s = available
                            ? seatTypeStyle[seat.seatType] ?? seatTypeStyle.STANDARD
                            : unavailableStyle;
                          // Ghe Couple chiem 2 cot vat ly (colSpan=2) — render rong gap doi
                          // thay vi 1 o vuong nho nhu ghe don, dung the hien dung ban chat ghe doi.
                          const isDoubleSeat = (seat.colSpan ?? 1) > 1;

                          return (
                            <div key={seat.seatId} style={{ display: "flex", gap: "6px" }}>
                              <button
                                onClick={() => available && setEditingSeat(seat)}
                                title={`${seat.seatCode} · ${seat.seatType} · ${formatPrice(seat.price)}`}
                                style={{
                                  width: isDoubleSeat ? "78px" : "36px",
                                  height: "32px",
                                  borderRadius: "6px",
                                  border: `1.5px solid ${s.border}`,
                                  background: s.bg,
                                  color: s.text,
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  cursor: available ? "pointer" : "default",
                                  transition: "transform 0.12s ease, box-shadow 0.12s ease",
                                  letterSpacing: "0.02em",
                                  flexShrink: 0,
                                }}
                                onMouseEnter={(e) => {
                                  if (available) {
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = `0 4px 10px ${s.border}`;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = "";
                                  e.currentTarget.style.boxShadow = "";
                                }}
                              >
                                {seat.seatCode.slice(1)}
                              </button>
                              {/* Loi di — chia hang thanh khoi trai/giua/phai, khop bo tri thuc te rap phim */}
                              {seat.aisleAfter && <div style={{ width: "18px", flexShrink: 0 }} />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Mirrored row label (right side) */}
                      <span
                        style={{
                          width: "20px",
                          flexShrink: 0,
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "var(--text-sub)",
                          textAlign: "center",
                        }}
                      >
                        {row}
                      </span>
                    </div>
                  ))}
                    </div>
                  </div>
                </div>
              </AudioCoverageFrame>
            </div>

            {/* Legend */}
            {(showProjector || showSpeakers) && (
              <div
                className="mb-3 inline-flex flex-wrap items-center gap-4 rounded-lg border px-2.5 py-1.5 mt-8"
                style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
                aria-label="Room equipment"
              >
                {showProjector && (
                  <div className="flex items-center gap-1.5">
                    <ProjectorLegendMarker />
                    <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-main)" }}>Projector</span>
                  </div>
                )}
                {showSpeakers && (
                  <div className="flex items-center gap-1.5">
                    <SpeakerLegendMarker />
                    <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-main)" }}>Speaker</span>
                  </div>
                )}
              </div>
            )}
            <div className={`flex flex-wrap items-center gap-4 pt-5 ${showProjector || showSpeakers ? "" : "mt-8"}`} style={{ borderTop: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: "11px", color: "var(--text-sub)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Legend
              </span>
              {Object.entries(seatTypeStyle).map(([type, s]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div style={{ width: "14px", height: "14px", borderRadius: "3px", background: s.bg, border: `1.5px solid ${s.border}` }} />
                  <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>{type}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div style={{ width: "14px", height: "14px", borderRadius: "3px", background: unavailableStyle.bg, border: `1.5px solid ${unavailableStyle.border}` }} />
                <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>Unavailable</span>
              </div>
            </div>
          </>
        )}
      </div>

      {editingSeat && (
        <EditSeatModal
          seat={editingSeat}
          onClose={() => setEditingSeat(null)}
          onSave={handleSave}
          saving={saving}
          isDarkMode={isDarkMode}
        />
      )}
    </>
  );
}
