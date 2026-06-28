import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation, useOutletContext } from "react-router-dom";
import { ArrowLeft, Building2, Armchair, RefreshCw, AlertCircle, X, Check } from "lucide-react";
import { movieApi, type SeatResponse, type RoomResponse, type SeatTypeValue, ROOM_TYPE_CONFIG } from "../../api/movieApi";

// ── Seat type config ─────────────────────────────────────────────────────────

const SEAT_TYPES = ["STANDARD", "VIP", "COUPLE"] as const;

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

  const passedRoom = (location.state as any)?.room as RoomResponse | undefined;

  const [seats, setSeats] = useState<SeatResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSeat, setEditingSeat] = useState<SeatResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const roomName =
    passedRoom?.cinemaRoomName ??
    seats[0]?.cinemaRoomName ??
    `Room #${id}`;

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

  useEffect(() => { loadSeats(); }, [loadSeats]);

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
      alert(err?.response?.data?.message ?? "Update failed.");
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

  return (
    <>
      {/* Back header */}
      <div className="flex items-center gap-4 mb-7">
        <button
          onClick={() => navigate("/admin/rooms")}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "13px", color: "var(--text-sub)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={18} className="text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 style={{ color: "var(--text-main)", fontWeight: 700, fontSize: "20px", lineHeight: 1.2 }}>
                {roomName}
              </h1>
              {passedRoom?.roomType && (() => {
                const cfg = ROOM_TYPE_CONFIG[passedRoom.roomType];
                const colors: Record<string, { bg: string; text: string }> = {
                  STANDARD: { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
                  LARGE:    { bg: "rgba(16,185,129,0.12)",  text: "#059669" },
                  IMAX:     { bg: "rgba(139,92,246,0.12)",  text: "#7c3aed" },
                };
                const c = colors[passedRoom.roomType] ?? { bg: "rgba(128,128,128,0.1)", text: "#6b7280" };
                return (
                  <span style={{ padding: "2px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, background: c.bg, color: c.text, letterSpacing: "0.04em" }}>
                    {cfg?.label ?? passedRoom.roomType}
                  </span>
                );
              })()}
            </div>
            <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
              {seats.length} seats · {rows.length} rows
            </p>
          </div>
        </div>
      </div>

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
        ) : seats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Armchair size={32} style={{ color: "var(--text-sub)" }} />
            <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>No seats found for this room.</p>
          </div>
        ) : (
          <>
            {/* Scrollable seat map — centred horizontally */}
            <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "fit-content", margin: "0 auto" }}>

                {/* Screen */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginBottom: "32px" }}>
                  <div
                    style={{
                      width: "70%",
                      height: "6px",
                      borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
                      background: isDarkMode
                        ? "linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)"
                        : "linear-gradient(to right, transparent, rgba(0,0,0,0.12), transparent)",
                      marginBottom: "8px",
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-sub)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>
                    Screen
                  </span>
                </div>

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

                      {/* Seats — no wrap, one line per row */}
                      <div style={{ display: "flex", gap: "6px" }}>
                        {seatsByRow[row].map((seat) => {
                          const available = seat.seatStatus === 1;
                          const s = available
                            ? seatTypeStyle[seat.seatType] ?? seatTypeStyle.STANDARD
                            : unavailableStyle;

                          return (
                            <button
                              key={seat.seatId}
                              onClick={() => available && setEditingSeat(seat)}
                              title={`${seat.seatCode} · ${seat.seatType} · ${formatPrice(seat.price)}`}
                              style={{
                                width: "36px",
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

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-8 pt-5" style={{ borderTop: "1px solid var(--border-color)" }}>
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
