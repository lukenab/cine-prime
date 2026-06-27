import { useState, useMemo } from "react";
import {
  Film, Calendar, Armchair, CreditCard, CheckCircle2,
  Search, ChevronLeft, ChevronRight, Tag, Clock,
  MapPin, Printer, Plus, Star, TicketIcon, User, Phone,
  X, AlertCircle,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Movie {
  id: string;
  title: string;
  genre: string;
  duration: number; // minutes
  rating: string;   // "PG", "T16", "T18"...
  colorHue: number; // for poster placeholder
}

interface Showtime {
  id: string;
  movieId: string;
  date: string;       // "YYYY-MM-DD"
  time: string;       // "HH:MM"
  roomName: string;
  roomType: "IMAX" | "3D" | "STANDARD";
  totalSeats: number;
  bookedSeats: number;
}

type SeatStatus = "AVAILABLE" | "BOOKED" | "SELECTED";
type SeatType   = "STANDARD" | "VIP" | "COUPLE";

interface Seat {
  code: string;
  row: string;
  col: number;
  type: SeatType;
  price: number;
  status: SeatStatus;
  coupleWith?: string; // paired seat code for COUPLE type
}

interface Promotion {
  code: string;
  title: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_MOVIES: Movie[] = [
  { id: "1", title: "Avengers: Doomsday",       genre: "Action / Sci-Fi",  duration: 150, rating: "T16", colorHue: 220 },
  { id: "2", title: "Inside Out 2",              genre: "Animation",        duration: 100, rating: "PG",  colorHue: 45  },
  { id: "3", title: "Deadpool & Wolverine",      genre: "Action / Comedy",  duration: 128, rating: "T18", colorHue: 0   },
  { id: "4", title: "Kung Fu Panda 4",           genre: "Animation",        duration: 94,  rating: "PG",  colorHue: 30  },
  { id: "5", title: "Dune: Part Two",            genre: "Sci-Fi / Drama",   duration: 166, rating: "T13", colorHue: 180 },
  { id: "6", title: "The Fall Guy",              genre: "Action",           duration: 126, rating: "T16", colorHue: 280 },
];

// Generate showtimes for next 7 days
function generateShowtimes(): Showtime[] {
  const result: Showtime[] = [];
  const today = new Date();
  const configs: { time: string; room: string; type: Showtime["roomType"]; total: number; booked: number }[] = [
    { time: "09:30", room: "Cinema 1 (IMAX)", type: "IMAX",     total: 200, booked: 148 },
    { time: "12:00", room: "Cinema 2 (3D)",   type: "3D",       total: 120, booked: 32  },
    { time: "14:30", room: "Cinema 3",        type: "STANDARD", total: 100, booked: 67  },
    { time: "17:00", room: "Cinema 1 (IMAX)", type: "IMAX",     total: 200, booked: 190 },
    { time: "19:30", room: "Cinema 2 (3D)",   type: "3D",       total: 120, booked: 0   },
    { time: "21:45", room: "Cinema 4",        type: "STANDARD", total: 100, booked: 55  },
  ];
  let id = 1;
  for (let d = 0; d < 7; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dateStr = date.toISOString().split("T")[0];
    // Each movie gets 2 showtimes per day
    MOCK_MOVIES.forEach((m) => {
      const picks = configs.slice((+m.id % 3) * 2, (+ m.id % 3) * 2 + 2);
      picks.forEach((c) => {
        result.push({ id: String(id++), movieId: m.id, date: dateStr, ...c });
      });
    });
  }
  return result;
}

const ALL_SHOWTIMES = generateShowtimes();

// ── Seat map generator ─────────────────────────────────────────────────────────

const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const COLS = 10;
const BOOKED_CODES = new Set(["A2","A5","B3","B7","C1","C6","D4","D8","E2","E9","F3","F5","G4","G7","H2","H8","I3","J5"]);

const PRICE: Record<SeatType, number> = {
  STANDARD: 90_000,
  VIP:      140_000,
  COUPLE:   220_000,
};

function getSeatType(row: string): SeatType {
  if (["I", "J"].includes(row)) return "COUPLE";
  if (["G", "H"].includes(row)) return "VIP";
  return "STANDARD";
}

function buildSeatMap(): Seat[] {
  const seats: Seat[] = [];
  ROWS.forEach((row) => {
    const type = getSeatType(row);
    for (let col = 1; col <= COLS; col++) {
      const code = `${row}${col}`;
      seats.push({
        code,
        row,
        col,
        type,
        price: PRICE[type],
        status: BOOKED_CODES.has(code) ? "BOOKED" : "AVAILABLE",
      });
    }
  });
  return seats;
}

const INITIAL_SEATS = buildSeatMap();

const MOCK_PROMOTIONS: Record<string, Promotion> = {
  "SUMMER20": { code: "SUMMER20", title: "Summer Blockbuster Sale", discountType: "PERCENTAGE",  discountValue: 20 },
  "STUDENT":  { code: "STUDENT",  title: "Student Discount",        discountType: "FIXED_AMOUNT", discountValue: 50_000 },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "₫";
}

function fmtDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function randomBookingCode() {
  return "BK" + Date.now().toString().slice(-6);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepBar({ current, total }: { current: number; total: number }) {
  const labels = ["Chọn phim", "Suất chiếu", "Chọn ghế", "Thanh toán", "Xác nhận"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "32px" }}>
      {labels.map((label, i) => {
        const step = i + 1;
        const done    = step < current;
        const active  = step === current;
        const pending = step > current;
        return (
          <div key={step} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", fontWeight: 600,
                background: done ? "#10b981" : active ? "#3b82f6" : "var(--bg-card)",
                color: done || active ? "#fff" : "var(--text-sub)",
                border: pending ? "2px solid var(--border-color)" : "none",
                transition: "all 0.2s",
              }}>
                {done ? "✓" : step}
              </div>
              <span style={{ fontSize: "11px", color: active ? "#3b82f6" : done ? "#10b981" : "var(--text-sub)", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }}>
                {label}
              </span>
            </div>
            {step < total && (
              <div style={{ flex: 1, height: "2px", background: done ? "#10b981" : "var(--border-color)", margin: "0 4px", marginBottom: "22px", transition: "background 0.2s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function RatingBadge({ rating }: { rating: string }) {
  const color = rating === "PG" ? "#10b981" : rating === "T13" ? "#3b82f6" : rating === "T16" ? "#f59e0b" : "#ef4444";
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: `${color}22`, color }}>
      {rating}
    </span>
  );
}

function RoomTypeBadge({ type }: { type: Showtime["roomType"] }) {
  const map = { IMAX: "#8b5cf6", "3D": "#3b82f6", STANDARD: "#6b7280" };
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: `${map[type]}22`, color: map[type] }}>
      {type}
    </span>
  );
}

// ── STEP 1: Movie ──────────────────────────────────────────────────────────────

function Step1Movie({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = MOCK_MOVIES.filter(m => m.title.toLowerCase().includes(query.toLowerCase()) || m.genre.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-main)", marginBottom: "16px" }}>Chọn phim</h2>
      <div style={{ position: "relative", marginBottom: "20px" }}>
        <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-sub)" }} />
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Tìm theo tên phim hoặc thể loại..."
          style={{
            width: "100%", paddingLeft: "36px", paddingRight: "12px", paddingTop: "10px", paddingBottom: "10px",
            borderRadius: "10px", border: "1px solid var(--border-color)", outline: "none",
            background: "var(--bg-card)", color: "var(--text-main)", fontSize: "14px",
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
        {filtered.map(movie => {
          const selected = movie.id === selectedId;
          return (
            <button key={movie.id} onClick={() => onSelect(movie.id)}
              style={{
                textAlign: "left", borderRadius: "14px", overflow: "hidden",
                border: selected ? "2px solid #3b82f6" : "2px solid var(--border-color)",
                background: selected ? "rgba(59,130,246,0.06)" : "var(--bg-card)",
                cursor: "pointer", transition: "all 0.15s", padding: 0,
              }}>
              {/* Poster placeholder */}
              <div style={{
                height: "120px",
                background: `linear-gradient(135deg, hsl(${movie.colorHue},60%,25%) 0%, hsl(${movie.colorHue},50%,15%) 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              }}>
                <Film size={36} style={{ color: `hsl(${movie.colorHue},60%,70%)`, opacity: 0.7 }} />
                {selected && (
                  <div style={{
                    position: "absolute", top: "8px", right: "8px",
                    width: "22px", height: "22px", borderRadius: "50%",
                    background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <CheckCircle2 size={14} color="#fff" />
                  </div>
                )}
              </div>
              <div style={{ padding: "12px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)", lineHeight: 1.3 }}>{movie.title}</span>
                  <RatingBadge rating={movie.rating} />
                </div>
                <p style={{ fontSize: "11px", color: "var(--text-sub)", marginBottom: "6px" }}>{movie.genre}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={11} style={{ color: "var(--text-sub)" }} />
                  <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>{movie.duration} phút</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── STEP 2: Showtime ───────────────────────────────────────────────────────────

function Step2Showtime({ movieId, selectedId, onSelect }: { movieId: string; selectedId: string; onSelect: (id: string) => void }) {
  const movie = MOCK_MOVIES.find(m => m.id === movieId)!;
  const showtimes = ALL_SHOWTIMES.filter(s => s.movieId === movieId);
  const dates = [...new Set(showtimes.map(s => s.date))].slice(0, 7);
  const [activeDate, setActiveDate] = useState(dates[0] ?? "");
  const dayShowtimes = showtimes.filter(s => s.date === activeDate);

  return (
    <div>
      <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>Chọn suất chiếu</h2>
      <p style={{ fontSize: "13px", color: "var(--text-sub)", marginBottom: "20px" }}>{movie.title}</p>

      {/* Date tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {dates.map(d => {
          const active = d === activeDate;
          return (
            <button key={d} onClick={() => setActiveDate(d)}
              style={{
                padding: "7px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: active ? 600 : 400, cursor: "pointer",
                background: active ? "#3b82f6" : "var(--bg-card)", color: active ? "#fff" : "var(--text-main)",
                border: active ? "1.5px solid #3b82f6" : "1.5px solid var(--border-color)", transition: "all 0.15s",
              }}>
              {fmtDate(d)}
            </button>
          );
        })}
      </div>

      {/* Showtime list */}
      <div style={{ display: "grid", gap: "10px" }}>
        {dayShowtimes.map(st => {
          const selected = st.id === selectedId;
          const avail = st.totalSeats - st.bookedSeats;
          const full = avail === 0;
          return (
            <button key={st.id} disabled={full} onClick={() => onSelect(st.id)}
              style={{
                textAlign: "left", padding: "16px 18px", borderRadius: "12px", cursor: full ? "not-allowed" : "pointer",
                border: selected ? "2px solid #3b82f6" : "2px solid var(--border-color)",
                background: selected ? "rgba(59,130,246,0.06)" : full ? "rgba(128,128,128,0.04)" : "var(--bg-card)",
                opacity: full ? 0.5 : 1, transition: "all 0.15s",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "52px", height: "52px", borderRadius: "12px",
                  background: selected ? "rgba(59,130,246,0.12)" : "rgba(128,128,128,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: selected ? "#3b82f6" : "var(--text-main)" }}>{st.time}</span>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-main)" }}>{st.roomName}</span>
                    <RoomTypeBadge type={st.roomType} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <MapPin size={11} style={{ color: "var(--text-sub)" }} />
                    <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>
                      {full ? "Hết chỗ" : `${avail} ghế trống`}
                    </span>
                  </div>
                </div>
              </div>
              {selected && <CheckCircle2 size={20} color="#3b82f6" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── STEP 3: Seat map ────────────────────────────────────────────────────────────

const SEAT_STYLE: Record<SeatType, { bg: string; border: string; color: string }> = {
  STANDARD: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.4)", color: "#3b82f6" },
  VIP:      { bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.5)", color: "#d97706" },
  COUPLE:   { bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.4)", color: "#9333ea" },
};
const SELECTED_STYLE = { bg: "rgba(16,185,129,0.15)", border: "#10b981", color: "#10b981" };
const BOOKED_STYLE   = { bg: "rgba(128,128,128,0.07)", border: "rgba(128,128,128,0.2)", color: "#9ca3af" };

function Step3Seats({ seats, onToggle }: {
  seats: Seat[];
  onToggle: (code: string) => void;
}) {
  const selected = seats.filter(s => s.status === "SELECTED");

  return (
    <div>
      <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>Chọn ghế</h2>
      <p style={{ fontSize: "13px", color: "var(--text-sub)", marginBottom: "20px" }}>Click để chọn / bỏ chọn ghế</p>

      {/* Screen */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{
          display: "inline-block", width: "70%", height: "8px", borderRadius: "4px 4px 0 0",
          background: "linear-gradient(90deg, rgba(59,130,246,0.1), rgba(59,130,246,0.4), rgba(59,130,246,0.1))",
          border: "1px solid rgba(59,130,246,0.3)", borderBottom: "none",
        }} />
        <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "4px", letterSpacing: "0.1em" }}>MÀN HÌNH</p>
      </div>

      {/* Seat grid */}
      <div style={{ overflowX: "auto", paddingBottom: "8px" }}>
        <div style={{ minWidth: "400px" }}>
          {ROWS.map(row => (
            <div key={row} style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "5px", justifyContent: "center" }}>
              <span style={{ width: "16px", fontSize: "11px", color: "var(--text-sub)", fontWeight: 600, textAlign: "center", flexShrink: 0 }}>{row}</span>
              {Array.from({ length: COLS }, (_, i) => i + 1).map(col => {
                const seat = seats.find(s => s.row === row && s.col === col);
                if (!seat) return null;
                const isSelected = seat.status === "SELECTED";
                const isBooked   = seat.status === "BOOKED";
                const style = isBooked ? BOOKED_STYLE : isSelected ? SELECTED_STYLE : SEAT_STYLE[seat.type];
                return (
                  <button
                    key={seat.code}
                    disabled={isBooked}
                    onClick={() => onToggle(seat.code)}
                    title={isBooked ? `${seat.code} — Đã đặt` : `${seat.code} — ${seat.type} — ${fmtPrice(seat.price)}`}
                    style={{
                      width: "30px", height: "26px", borderRadius: "5px 5px 3px 3px",
                      fontSize: "9px", fontWeight: 600,
                      background: style.bg, border: `1.5px solid ${style.border}`, color: style.color,
                      cursor: isBooked ? "not-allowed" : "pointer",
                      transition: "all 0.12s",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    {seat.col}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "20px", flexWrap: "wrap" }}>
        {[
          { label: "Standard",  style: SEAT_STYLE.STANDARD },
          { label: "VIP",       style: SEAT_STYLE.VIP },
          { label: "Couple",    style: SEAT_STYLE.COUPLE },
          { label: "Đã chọn",  style: SELECTED_STYLE },
          { label: "Đã đặt",   style: BOOKED_STYLE },
        ].map(({ label, style }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "18px", height: "16px", borderRadius: "3px", background: style.bg, border: `1.5px solid ${style.border}` }} />
            <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Price guide */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "14px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>Standard: {fmtPrice(PRICE.STANDARD)}</span>
        <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>•</span>
        <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>VIP: {fmtPrice(PRICE.VIP)}</span>
        <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>•</span>
        <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>Couple: {fmtPrice(PRICE.COUPLE)}</span>
      </div>

      {/* Selected summary */}
      {selected.length > 0 && (
        <div style={{
          marginTop: "20px", padding: "14px 18px", borderRadius: "12px",
          background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <Armchair size={14} color="#10b981" />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#10b981" }}>Đã chọn {selected.length} ghế</span>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {selected.map(s => (
              <span key={s.code} style={{
                fontSize: "12px", padding: "2px 8px", borderRadius: "6px",
                background: "rgba(16,185,129,0.12)", color: "#10b981", fontWeight: 500,
              }}>{s.code}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── STEP 4: Payment ─────────────────────────────────────────────────────────────

function Step4Payment({
  seats, movie, showtime, promoCode, setPromoCode, appliedPromo, setAppliedPromo, customerName, setCustomerName, customerPhone, setCustomerPhone,
}: {
  seats: Seat[]; movie: Movie; showtime: Showtime;
  promoCode: string; setPromoCode: (v: string) => void;
  appliedPromo: Promotion | null; setAppliedPromo: (p: Promotion | null) => void;
  customerName: string; setCustomerName: (v: string) => void;
  customerPhone: string; setCustomerPhone: (v: string) => void;
}) {
  const [promoError, setPromoError] = useState("");
  const selected = seats.filter(s => s.status === "SELECTED");
  const subtotal  = selected.reduce((sum, s) => sum + s.price, 0);
  const discount  = appliedPromo
    ? appliedPromo.discountType === "PERCENTAGE"
      ? Math.round(subtotal * appliedPromo.discountValue / 100)
      : Math.min(appliedPromo.discountValue, subtotal)
    : 0;
  const total = subtotal - discount;

  function applyPromo() {
    setPromoError("");
    const p = MOCK_PROMOTIONS[promoCode.trim().toUpperCase()];
    if (!p) { setPromoError("Mã khuyến mãi không hợp lệ hoặc đã hết hạn."); return; }
    setAppliedPromo(p);
  }

  const labelStyle: React.CSSProperties = { fontSize: "12px", color: "var(--text-sub)", marginBottom: "6px", display: "block" };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 13px", borderRadius: "10px",
    border: "1px solid var(--border-color)", outline: "none",
    background: "var(--bg-main)", color: "var(--text-main)", fontSize: "14px",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>
      {/* Left — customer + promo */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Customer */}
        <div style={{ padding: "20px", borderRadius: "14px", border: "1px solid var(--border-color)", background: "var(--bg-card)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <User size={14} style={{ color: "var(--text-sub)" }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>Thông tin khách hàng</span>
            <span style={{ fontSize: "11px", color: "var(--text-sub)", marginLeft: "4px" }}>(tùy chọn)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={labelStyle}><User size={10} style={{ display: "inline", marginRight: "4px" }} />Họ tên</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                placeholder="Nguyễn Văn A" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}><Phone size={10} style={{ display: "inline", marginRight: "4px" }} />Số điện thoại</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                placeholder="0901 234 567" style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Promo */}
        <div style={{ padding: "20px", borderRadius: "14px", border: "1px solid var(--border-color)", background: "var(--bg-card)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <Tag size={14} style={{ color: "var(--text-sub)" }} />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>Mã khuyến mãi</span>
          </div>
          {appliedPromo ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderRadius: "10px",
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
            }}>
              <div>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#10b981" }}>{appliedPromo.code}</span>
                <span style={{ fontSize: "12px", color: "var(--text-sub)", marginLeft: "8px" }}>{appliedPromo.title}</span>
              </div>
              <button onClick={() => { setAppliedPromo(null); setPromoCode(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input value={promoCode} onChange={e => { setPromoCode(e.target.value); setPromoError(""); }}
                  placeholder="Nhập mã khuyến mãi (VD: SUMMER20)"
                  style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={e => e.key === "Enter" && applyPromo()}
                />
                <button onClick={applyPromo}
                  style={{
                    padding: "10px 18px", borderRadius: "10px", fontWeight: 600, fontSize: "13px",
                    background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer", whiteSpace: "nowrap",
                  }}>
                  Áp dụng
                </button>
              </div>
              {promoError && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
                  <AlertCircle size={12} color="#ef4444" />
                  <span style={{ fontSize: "12px", color: "#ef4444" }}>{promoError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right — order summary */}
      <div style={{ padding: "20px", borderRadius: "14px", border: "1px solid var(--border-color)", background: "var(--bg-card)", position: "sticky", top: "0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
          <CreditCard size={14} style={{ color: "var(--text-sub)" }} />
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>Tóm tắt đơn hàng</span>
        </div>

        {/* Movie + showtime */}
        <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)", marginBottom: "16px" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)", marginBottom: "6px" }}>{movie.title}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "3px" }}>
            <Calendar size={11} style={{ color: "var(--text-sub)" }} />
            <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>{fmtDate(showtime.date)} — {showtime.time}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <MapPin size={11} style={{ color: "var(--text-sub)" }} />
            <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>{showtime.roomName}</span>
          </div>
        </div>

        {/* Seats */}
        <div style={{ marginBottom: "16px" }}>
          {selected.map(s => (
            <div key={s.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "8px", marginBottom: "8px", borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <span style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: 500 }}>Ghế {s.code}</span>
                <span style={{ fontSize: "11px", color: "var(--text-sub)", marginLeft: "6px" }}>{s.type}</span>
              </div>
              <span style={{ fontSize: "13px", color: "var(--text-main)" }}>{fmtPrice(s.price)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>Tạm tính</span>
            <span style={{ fontSize: "13px", color: "var(--text-main)" }}>{fmtPrice(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#10b981" }}>Khuyến mãi ({appliedPromo?.code})</span>
              <span style={{ fontSize: "13px", color: "#10b981" }}>− {fmtPrice(discount)}</span>
            </div>
          )}
          <div style={{ height: "1px", background: "var(--border-color)", margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-main)" }}>Tổng cộng</span>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#3b82f6" }}>{fmtPrice(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STEP 5: Confirmation ───────────────────────────────────────────────────────

function Step5Confirm({
  bookingCode, movie, showtime, seats, customerName, customerPhone, total, onReset,
}: {
  bookingCode: string; movie: Movie; showtime: Showtime;
  seats: Seat[]; customerName: string; customerPhone: string;
  total: number; onReset: () => void;
}) {
  const selected = seats.filter(s => s.status === "SELECTED");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "12px" }}>
      {/* Success icon */}
      <div style={{
        width: "72px", height: "72px", borderRadius: "50%",
        background: "rgba(16,185,129,0.12)", border: "2px solid rgba(16,185,129,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px",
      }}>
        <CheckCircle2 size={36} color="#10b981" />
      </div>
      <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-main)", marginBottom: "6px" }}>Bán vé thành công!</h2>
      <p style={{ fontSize: "14px", color: "var(--text-sub)", marginBottom: "28px" }}>Vui lòng in vé và giao cho khách hàng</p>

      {/* Ticket card */}
      <div style={{
        width: "100%", maxWidth: "480px", borderRadius: "18px", overflow: "hidden",
        border: "1px solid var(--border-color)", background: "var(--bg-card)", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 22px",
          background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <TicketIcon size={20} color="rgba(255,255,255,0.8)" />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>CinePrime — Vé xem phim</span>
          </div>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.8)", letterSpacing: "0.05em" }}>{bookingCode}</span>
        </div>

        {/* Dashed separator */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 22px" }}>
          <div style={{ flex: 1, borderTop: "2px dashed var(--border-color)" }} />
        </div>

        {/* Body */}
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <p style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-main)" }}>{movie.title}</p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
              <RatingBadge rating={movie.rating} />
              <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>{movie.duration} phút</span>
            </div>
          </div>
          <div style={{ height: "1px", background: "var(--border-color)" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[
              { label: "Ngày chiếu", value: fmtDate(showtime.date) },
              { label: "Giờ chiếu",  value: showtime.time },
              { label: "Phòng",      value: showtime.roomName },
              { label: "Loại phòng", value: showtime.roomType },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: "11px", color: "var(--text-sub)", marginBottom: "2px" }}>{label}</p>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{value}</p>
              </div>
            ))}
          </div>
          <div style={{ height: "1px", background: "var(--border-color)" }} />
          <div>
            <p style={{ fontSize: "11px", color: "var(--text-sub)", marginBottom: "6px" }}>Ghế</p>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {selected.map(s => (
                <span key={s.code} style={{
                  fontSize: "13px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px",
                  background: "rgba(59,130,246,0.1)", color: "#3b82f6",
                }}>{s.code}</span>
              ))}
            </div>
          </div>
          {(customerName || customerPhone) && (
            <>
              <div style={{ height: "1px", background: "var(--border-color)" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {customerName  && <div><p style={{ fontSize: "11px", color: "var(--text-sub)", marginBottom: "2px" }}>Khách hàng</p><p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{customerName}</p></div>}
                {customerPhone && <div><p style={{ fontSize: "11px", color: "var(--text-sub)", marginBottom: "2px" }}>Điện thoại</p><p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>{customerPhone}</p></div>}
              </div>
            </>
          )}
          <div style={{ height: "1px", background: "var(--border-color)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>Tổng tiền</span>
            <span style={{ fontSize: "18px", fontWeight: 700, color: "#3b82f6" }}>{fmtPrice(total)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
        <button
          onClick={() => window.print()}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "11px 22px", borderRadius: "12px",
            border: "1.5px solid var(--border-color)", background: "var(--bg-card)",
            fontSize: "14px", fontWeight: 500, color: "var(--text-main)", cursor: "pointer",
          }}>
          <Printer size={15} /> In vé
        </button>
        <button
          onClick={onReset}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "11px 22px", borderRadius: "12px",
            border: "none", background: "#3b82f6",
            fontSize: "14px", fontWeight: 600, color: "#fff", cursor: "pointer",
          }}>
          <Plus size={15} /> Bán vé mới
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TicketSalePage() {
  useOutletContext<{ isDarkMode: boolean }>();

  const [step, setStep] = useState(1);

  // Step 1
  const [selectedMovieId,    setSelectedMovieId]    = useState("");
  // Step 2
  const [selectedShowtimeId, setSelectedShowtimeId] = useState("");
  // Step 3
  const [seats, setSeats] = useState<Seat[]>(INITIAL_SEATS);
  // Step 4
  const [promoCode,     setPromoCode]     = useState("");
  const [appliedPromo,  setAppliedPromo]  = useState<Promotion | null>(null);
  const [customerName,  setCustomerName]  = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  // Step 5
  const [bookingCode,   setBookingCode]   = useState("");

  const movie    = MOCK_MOVIES.find(m => m.id === selectedMovieId)   ?? null;
  const showtime = ALL_SHOWTIMES.find(s => s.id === selectedShowtimeId) ?? null;
  const selectedSeats = seats.filter(s => s.status === "SELECTED");

  const total = useMemo(() => {
    const sub = selectedSeats.reduce((sum, s) => sum + s.price, 0);
    const dis = appliedPromo
      ? appliedPromo.discountType === "PERCENTAGE"
        ? Math.round(sub * appliedPromo.discountValue / 100)
        : Math.min(appliedPromo.discountValue, sub)
      : 0;
    return sub - dis;
  }, [selectedSeats, appliedPromo]);

  function toggleSeat(code: string) {
    setSeats(prev => prev.map(s => {
      if (s.code !== code || s.status === "BOOKED") return s;
      return { ...s, status: s.status === "SELECTED" ? "AVAILABLE" : "SELECTED" };
    }));
  }

  function canNext(): boolean {
    if (step === 1) return !!selectedMovieId;
    if (step === 2) return !!selectedShowtimeId;
    if (step === 3) return selectedSeats.length > 0;
    return true;
  }

  function handleNext() {
    if (step === 4) {
      // Confirm & pay
      setBookingCode(randomBookingCode());
      setStep(5);
      return;
    }
    if (step === 2) {
      // Reset seats when changing showtime
      setSeats(INITIAL_SEATS);
    }
    setStep(s => s + 1);
  }

  function handleBack() {
    setStep(s => s - 1);
  }

  function handleReset() {
    setStep(1);
    setSelectedMovieId("");
    setSelectedShowtimeId("");
    setSeats(INITIAL_SEATS);
    setPromoCode(""); setAppliedPromo(null);
    setCustomerName(""); setCustomerPhone("");
    setBookingCode("");
  }

  const nextLabel = step === 4 ? "Xác nhận & Thanh toán" : "Tiếp theo";
  const nextColor = step === 4 ? "#10b981" : "#3b82f6";

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
        <div style={{
          width: "40px", height: "40px", borderRadius: "12px",
          background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <TicketIcon size={20} color="#3b82f6" />
        </div>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-main)", letterSpacing: "-0.01em" }}>Bán vé tại quầy</h1>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Tạo đơn bán vé cho khách hàng walk-in</p>
        </div>
      </div>

      {/* Card wrapper */}
      <div style={{ borderRadius: "18px", border: "1px solid var(--border-color)", background: "var(--bg-card)", padding: "28px" }}>
        {/* Step bar — hidden on step 5 */}
        {step < 5 && <StepBar current={step} total={5} />}

        {/* Step content */}
        {step === 1 && (
          <Step1Movie selectedId={selectedMovieId} onSelect={id => { setSelectedMovieId(id); setSelectedShowtimeId(""); }} />
        )}
        {step === 2 && movie && (
          <Step2Showtime movieId={movie.id} selectedId={selectedShowtimeId} onSelect={setSelectedShowtimeId} />
        )}
        {step === 3 && (
          <Step3Seats seats={seats} onToggle={toggleSeat} />
        )}
        {step === 4 && movie && showtime && (
          <Step4Payment
            seats={seats} movie={movie} showtime={showtime}
            promoCode={promoCode} setPromoCode={setPromoCode}
            appliedPromo={appliedPromo} setAppliedPromo={setAppliedPromo}
            customerName={customerName} setCustomerName={setCustomerName}
            customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
          />
        )}
        {step === 5 && movie && showtime && (
          <Step5Confirm
            bookingCode={bookingCode} movie={movie} showtime={showtime}
            seats={seats} customerName={customerName} customerPhone={customerPhone}
            total={total} onReset={handleReset}
          />
        )}

        {/* Navigation buttons */}
        {step < 5 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "32px", paddingTop: "20px", borderTop: "1px solid var(--border-color)" }}>
            <button
              onClick={handleBack} disabled={step === 1}
              style={{
                display: "flex", alignItems: "center", gap: "6px", padding: "10px 20px",
                borderRadius: "12px", border: "1.5px solid var(--border-color)",
                background: step === 1 ? "rgba(128,128,128,0.05)" : "var(--bg-card)",
                fontSize: "14px", fontWeight: 500, color: step === 1 ? "var(--text-sub)" : "var(--text-main)",
                cursor: step === 1 ? "not-allowed" : "pointer", opacity: step === 1 ? 0.5 : 1,
              }}>
              <ChevronLeft size={16} /> Quay lại
            </button>

            {/* Mini summary pill */}
            {step > 1 && movie && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {movie && (
                  <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "8px", background: "rgba(59,130,246,0.08)", color: "#3b82f6", fontWeight: 500 }}>
                    <Film size={10} style={{ display: "inline", marginRight: "4px" }} />{movie.title}
                  </span>
                )}
                {showtime && (
                  <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "8px", background: "rgba(59,130,246,0.08)", color: "#3b82f6", fontWeight: 500 }}>
                    <Clock size={10} style={{ display: "inline", marginRight: "4px" }} />{showtime.time}
                  </span>
                )}
                {selectedSeats.length > 0 && (
                  <span style={{ fontSize: "12px", padding: "4px 10px", borderRadius: "8px", background: "rgba(16,185,129,0.08)", color: "#10b981", fontWeight: 500 }}>
                    <Armchair size={10} style={{ display: "inline", marginRight: "4px" }} />{selectedSeats.length} ghế
                  </span>
                )}
              </div>
            )}

            <button
              onClick={handleNext} disabled={!canNext()}
              style={{
                display: "flex", alignItems: "center", gap: "6px", padding: "10px 24px",
                borderRadius: "12px", border: "none",
                background: canNext() ? nextColor : "rgba(128,128,128,0.15)",
                fontSize: "14px", fontWeight: 600, color: canNext() ? "#fff" : "var(--text-sub)",
                cursor: canNext() ? "pointer" : "not-allowed", transition: "all 0.15s",
              }}>
              {nextLabel} <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
