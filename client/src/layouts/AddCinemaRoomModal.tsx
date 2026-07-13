import { useState, useEffect } from "react";
import { Building2, X, Check } from "lucide-react";
import { type CreateRoomPayload, type RoomType, ROOM_TYPE_CONFIG, type ClusterResponse } from "../api/movieApi";

// ── Add Room Modal ────────────────────────────────────────────────────────────
// Shared by ManageCinemaRoomsPage (global "all rooms" view, cluster picked from
// a dropdown) and ClusterDetailPage (nested view — pass `fixedClusterId` to
// skip the picker entirely since the cluster is already known from context).

export type AddRoomModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateRoomPayload) => void;
  submitting: boolean;
  /** Rooms page (flat view): full list, user picks one via dropdown. */
  clusters?: ClusterResponse[];
  /** Cluster detail page (nested view): cluster already known — hides the picker. */
  fixedClusterId?: number;
};

const ROOM_TYPES = Object.keys(ROOM_TYPE_CONFIG) as RoomType[];

const roomTypeBorderActive: Record<RoomType, string> = {
  STANDARD: "#3b82f6",
  LARGE:    "#10b981",
  IMAX:     "#8b5cf6",
};

export function AddCinemaRoomModal({ open, onClose, onSave, submitting, clusters = [], fixedClusterId }: AddRoomModalProps) {
  const initialClusterId = fixedClusterId ?? clusters[0]?.clusterId ?? 0;

  const [form, setForm] = useState<CreateRoomPayload>({
    cinemaRoomName: "", roomType: "STANDARD", seatQuantity: 50, defaultPrice: 90000, clusterId: initialClusterId,
  });

  useEffect(() => {
    if (open) {
      setForm({
        cinemaRoomName: "", roomType: "STANDARD", seatQuantity: 50, defaultPrice: 90000,
        clusterId: fixedClusterId ?? clusters[0]?.clusterId ?? 0,
      });
    }
  }, [open, clusters, fixedClusterId]);

  if (!open) return null;

  const showPicker = fixedClusterId == null;
  const noClusters = showPicker && clusters.length === 0;

  const cfg = ROOM_TYPE_CONFIG[form.roomType];
  const seatsPerRow = cfg.seatsPerRow;
  const numRows = Math.ceil(form.seatQuantity / seatsPerRow);
  const lastCol = form.seatQuantity % seatsPerRow || seatsPerRow;
  const lastRowChar = String.fromCharCode(64 + numRows);
  const overLimit = form.seatQuantity > cfg.maxSeats;

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
        className="relative w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--bg-main)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-blue-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>Add Cinema Room</h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors" style={{ color: "var(--text-sub)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); if (!overLimit && form.clusterId) onSave(form); }}
          className="px-6 py-5 space-y-4"
        >
          {showPicker && (
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Cinema Cluster <span className="text-rose-500">*</span>
              </label>
              {noClusters ? (
                <p style={{ fontSize: "12px", color: "#ef4444" }}>
                  No cinema clusters found — create a cluster first before adding rooms.
                </p>
              ) : (
                <select
                  required
                  value={form.clusterId || ""}
                  onChange={(e) => setForm({ ...form, clusterId: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
                  style={inputStyle}
                >
                  <option value="" disabled>Select a cluster…</option>
                  {clusters.map((c) => (
                    <option key={c.clusterId} value={c.clusterId}>{c.clusterName}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Room Name <span className="text-rose-500">*</span>
            </label>
            <input
              required type="text" placeholder="e.g. Room A, IMAX Hall 1"
              minLength={2} maxLength={100}
              value={form.cinemaRoomName}
              onChange={(e) => setForm({ ...form, cinemaRoomName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={inputStyle}
            />
          </div>

          {/* Room Type Selector */}
          <div>
            <label className="block mb-2" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Room Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROOM_TYPES.map((type) => {
                const c = ROOM_TYPE_CONFIG[type];
                const active = form.roomType === type;
                const color = roomTypeBorderActive[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, roomType: type, seatQuantity: Math.min(form.seatQuantity, c.maxSeats) })}
                    style={{
                      padding: "10px 8px",
                      borderRadius: "10px",
                      border: `1.5px solid ${active ? color : "var(--border-color)"}`,
                      background: active ? `${color}12` : "var(--bg-main)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease",
                      position: "relative",
                    }}
                  >
                    {active && (
                      <span style={{ position: "absolute", top: "6px", right: "6px", color }}>
                        <Check size={11} />
                      </span>
                    )}
                    <p style={{ fontSize: "13px", fontWeight: 700, color: active ? color : "var(--text-main)", marginBottom: "2px" }}>
                      {c.label}
                    </p>
                    <p style={{ fontSize: "10px", color: "var(--text-sub)", lineHeight: 1.4 }}>
                      Max {c.maxSeats}<br />{c.seatsPerRow}/row
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Seat Quantity <span className="text-rose-500">*</span>
            </label>
            <input
              required type="number" min={10} max={cfg.maxSeats} placeholder={`10 – ${cfg.maxSeats}`}
              value={form.seatQuantity}
              onChange={(e) => setForm({ ...form, seatQuantity: parseInt(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none transition-colors"
              style={{ ...inputStyle, borderColor: overLimit ? "#ef4444" : "var(--border-color)" }}
            />
            {overLimit ? (
              <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>
                Exceeds {cfg.label} limit of {cfg.maxSeats} seats.
              </p>
            ) : (
              <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "4px" }}>
                Auto-generated: A1–{lastRowChar}{lastCol} · {numRows} rows × {seatsPerRow} cols
              </p>
            )}
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Default Seat Price (VND) <span className="text-rose-500">*</span>
            </label>
            <input
              required type="number" min={1000} step={1000} placeholder="e.g. 90000"
              value={form.defaultPrice}
              onChange={(e) => setForm({ ...form, defaultPrice: parseInt(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={inputStyle}
            />
            <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "4px" }}>
              Applied to all seats. Individual seats can be updated later.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={submitting || !form.clusterId || noClusters}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              {submitting ? "Creating…" : "Create Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
