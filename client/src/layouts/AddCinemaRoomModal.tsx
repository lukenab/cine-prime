import { useState, useEffect } from "react";
import { Building2, X, Check } from "lucide-react";
import { type CreateRoomPayload, type RoomType, ROOM_TYPE_CONFIG } from "../api/movieApi";

// ── Add Room Modal ────────────────────────────────────────────────────────────
// Used from ClusterDetailPage — room creation always happens in the context of
// a specific cluster (see docs/issues/mr-165-nest-cinema-room-under-cluster.md),
// so `clusterId` is always known ahead of time and never picked from a dropdown.
//
// Flow: pick RoomType → form pre-fills numberOfRows/seatsPerRow with that type's
// default → admin can adjust both → estimated seats (rows × seatsPerRow) is shown
// live against the type's maximum. totalSeatCapacity is never entered directly —
// the backend computes it from numberOfRows/seatsPerRow and is the source of truth;
// RoomType only supplies the default layout + the maxSeats ceiling.

export type AddRoomModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateRoomPayload) => void;
  submitting: boolean;
  clusterId: number;
  /** Room names already in this cluster — used to suggest the next "Room {N}" in sequence. */
  existingRoomNames?: string[];
};

const ROOM_TYPES = Object.keys(ROOM_TYPE_CONFIG) as RoomType[];

const roomTypeBorderActive: Record<RoomType, string> = {
  STANDARD: "#3b82f6",
  LARGE:    "#10b981",
  IMAX:     "#8b5cf6",
};

// Same bounds as SeatService.MAX_ROWS / CinemaRoomService.MIN_SEAT_CAPACITY on the
// backend — surfaced here purely so the hint can show before the round-trip, not a
// separate source of truth (backend still re-validates independently).
const MAX_ROWS = 50;
const MIN_SEATS = 10;

// Rạp thật (CGV/Lotte/Galaxy...) đánh số phòng liên tục trong 1 cụm rạp bất kể loại phòng
// (Room 1, 2, 3... không tách dãy số riêng theo Standard/IMAX) — loại phòng chỉ là nhãn
// gắn thêm, không phải một chuỗi đánh số khác. Suggest số tiếp theo, không ép buộc.
function nextRoomName(existingNames: string[]): string {
  const usedNumbers = existingNames
    .map((name) => name.match(/^Room\s+(\d+)$/i)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  const next = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
  return `Room ${next}`;
}

// Nhan hang kieu Excel (khop rowLabel() ben backend): 0->A, 1->B, ..., 25->Z, 26->AA...
// Chi dung de PREVIEW chu khong sinh ghe that (backend moi la nguon du lieu that).
function excelRowLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

// Default so hang goi y cho 1 RoomType = maxSeats / seatsPerRow (VD IMAX: 300/15 = 20 hang) —
// khong phai gia tri co dinh bat buoc, chi la diem khoi dau de admin dieu chinh.
function defaultRowsFor(type: RoomType): number {
  const cfg = ROOM_TYPE_CONFIG[type];
  return Math.max(1, Math.round(cfg.maxSeats / cfg.seatsPerRow));
}

// Neutral starting template for every room type: approximately 60% Standard,
// 30% VIP and 10% Couple. Couple rows are omitted when a row has odd width;
// admins can override every value before submitting.
function defaultRowAllocation(numberOfRows: number, seatsPerRow: number) {
  if (numberOfRows <= 0) {
    return { standardRowCount: 0, vipRowCount: 0, coupleRowCount: 0 };
  }

  const coupleRowCount = numberOfRows >= 3 && seatsPerRow % 2 === 0
    ? Math.max(1, Math.round(numberOfRows * 0.1))
    : 0;
  const vipRowCount = Math.min(
    Math.round(numberOfRows * 0.3),
    Math.max(0, numberOfRows - coupleRowCount - 1),
  );
  const standardRowCount = numberOfRows - vipRowCount - coupleRowCount;
  return { standardRowCount, vipRowCount, coupleRowCount };
}

type FormState = CreateRoomPayload;

function makeInitialForm(clusterId: number, roomName: string): FormState {
  const roomType: RoomType = "STANDARD";
  const numberOfRows = defaultRowsFor(roomType);
  const seatsPerRow = ROOM_TYPE_CONFIG[roomType].seatsPerRow;
  return {
    cinemaRoomName: roomName,
    roomType,
    numberOfRows,
    seatsPerRow,
    ...defaultRowAllocation(numberOfRows, seatsPerRow),
    defaultPrice: 90000,
    clusterId,
  };
}

export function AddCinemaRoomModal({ open, onClose, onSave, submitting, clusterId, existingRoomNames = [] }: AddRoomModalProps) {
  const [form, setForm] = useState<FormState>(() => makeInitialForm(clusterId, ""));

  useEffect(() => {
    if (open) {
      setForm(makeInitialForm(clusterId, nextRoomName(existingRoomNames)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clusterId]);

  if (!open) return null;

  const cfg = ROOM_TYPE_CONFIG[form.roomType];
  const estimatedSeats = form.numberOfRows * form.seatsPerRow;
  const lastRowChar = excelRowLabel(form.numberOfRows - 1); // A, B, ..., Z, AA, AB... (khop backend rowLabel())
  const overLimit = estimatedSeats > cfg.maxSeats;
  const underLimit = estimatedSeats < MIN_SEATS;
  const overRowLimit = form.numberOfRows > MAX_ROWS;
  const allocatedRows = form.standardRowCount + form.vipRowCount + form.coupleRowCount;
  const allocationTotalMismatch = allocatedRows !== form.numberOfRows;
  const missingSingleSeatRow = form.standardRowCount + form.vipRowCount === 0;
  const coupleWidthInvalid = form.coupleRowCount > 0 && form.seatsPerRow % 2 !== 0;
  const allocationInvalid = allocationTotalMismatch || missingSingleSeatRow || coupleWidthInvalid;
  const formInvalid = overLimit || underLimit || overRowLimit || allocationInvalid || form.defaultPrice <= 0;

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-main)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };

  const selectRoomType = (type: RoomType) => {
    const numberOfRows = defaultRowsFor(type);
    const seatsPerRow = ROOM_TYPE_CONFIG[type].seatsPerRow;
    setForm({
      ...form,
      roomType: type,
      numberOfRows,
      seatsPerRow,
      ...defaultRowAllocation(numberOfRows, seatsPerRow),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative w-full max-w-md max-h-[90vh] mx-4 rounded-2xl shadow-2xl overflow-y-auto"
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
          onSubmit={(e) => { e.preventDefault(); if (!formInvalid) onSave(form); }}
          className="px-6 py-5 space-y-4"
        >
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Room Name <span className="text-rose-500">*</span>
            </label>
            <input
              required type="text" placeholder="e.g. Room 1"
              minLength={2} maxLength={100}
              value={form.cinemaRoomName}
              onChange={(e) => setForm({ ...form, cinemaRoomName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={inputStyle}
            />
            <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "4px" }}>
              Suggested next number in this cluster — edit if you need a custom name.
            </p>
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
                    onClick={() => selectRoomType(type)}
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
                      Max {c.maxSeats}<br />default {c.seatsPerRow}/row
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layout: number of rows + seats per row — admin-adjustable, RoomType just seeds the defaults */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Number of Rows <span className="text-rose-500">*</span>
              </label>
              <input
                required type="number" min={1} max={MAX_ROWS}
                value={form.numberOfRows}
                onChange={(e) => {
                  const numberOfRows = parseInt(e.target.value) || 0;
                  setForm({
                    ...form,
                    numberOfRows,
                    ...defaultRowAllocation(numberOfRows, form.seatsPerRow),
                  });
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none transition-colors"
                style={{ ...inputStyle, borderColor: overRowLimit || underLimit ? "#ef4444" : "var(--border-color)" }}
              />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Seats per Row <span className="text-rose-500">*</span>
              </label>
              <input
                required type="number" min={1}
                value={form.seatsPerRow}
                onChange={(e) => setForm({ ...form, seatsPerRow: parseInt(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none transition-colors"
                style={{ ...inputStyle, borderColor: overLimit || underLimit ? "#ef4444" : "var(--border-color)" }}
              />
            </div>
          </div>

          {/* Estimated capacity — computed client-side for preview only; backend recomputes
              totalSeatCapacity itself and is the authoritative value. */}
          <div
            className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
            style={{ background: "var(--bg-card)", border: `1px solid ${overLimit || underLimit || overRowLimit ? "#ef4444" : "var(--border-color)"}` }}
          >
            <div>
              <p style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: 600 }}>
                Estimated seats: {estimatedSeats}
              </p>
              <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                Maximum allowed: {cfg.maxSeats}
              </p>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-sub)", textAlign: "right" }}>
              A1–{lastRowChar}{form.seatsPerRow}<br />{form.numberOfRows} rows × {form.seatsPerRow} cols
            </p>
          </div>
          {overLimit && (
            <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "-8px" }}>
              Exceeds {cfg.label} limit of {cfg.maxSeats} seats — reduce rows or seats/row.
            </p>
          )}
          {underLimit && (
            <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "-8px" }}>
              Below the minimum room capacity of {MIN_SEATS} seats — increase rows or seats/row.
            </p>
          )}
          {overRowLimit && (
            <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "-8px" }}>
              Too many rows to lay out safely — max {MAX_ROWS}.
            </p>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Seat Zone Allocation <span className="text-rose-500">*</span>
              </label>
              <span style={{ fontSize: "11px", color: allocationTotalMismatch ? "#ef4444" : "var(--text-sub)" }}>
                {allocatedRows}/{form.numberOfRows} rows
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["standardRowCount", "Standard", "#3b82f6"],
                ["vipRowCount", "VIP", "#8b5cf6"],
                ["coupleRowCount", "Couple", "#ec4899"],
              ] as const).map(([field, label, color]) => {
                const value = form[field];
                const percentage = form.numberOfRows > 0 ? Math.round((value / form.numberOfRows) * 100) : 0;
                return (
                  <div key={field}>
                    <label className="block mb-1" style={{ fontSize: "11px", color }}>
                      {label} · {percentage}%
                    </label>
                    <input
                      required
                      type="number"
                      min={0}
                      max={form.numberOfRows}
                      value={value}
                      onChange={(e) => setForm({ ...form, [field]: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-xl border outline-none transition-colors"
                      style={{ ...inputStyle, borderColor: allocationInvalid ? "#ef4444" : "var(--border-color)" }}
                    />
                  </div>
                );
              })}
            </div>
            {allocationTotalMismatch && (
              <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "5px" }}>
                Standard + VIP + Couple must equal Number of Rows ({form.numberOfRows}).
              </p>
            )}
            {missingSingleSeatRow && (
              <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "5px" }}>
                Keep at least one Standard or VIP row for accessible seating.
              </p>
            )}
            {coupleWidthInvalid && (
              <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "5px" }}>
                Couple rows require an even Seats per Row value.
              </p>
            )}
            <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "5px" }}>
              Rows are generated from front to back: Standard → VIP → Couple.
            </p>
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
              type="submit" disabled={submitting || formInvalid}
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
