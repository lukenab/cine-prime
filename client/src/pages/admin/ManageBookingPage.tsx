import { useState } from "react";
import { Search, SlidersHorizontal, RefreshCw } from "lucide-react";
import { useOutletContext } from "react-router-dom";

import { BookingStatsCards } from "../../layouts/BookingStatsCards";
import { BookingTable, type BookingData } from "../../layouts/BookingTable";
import { BookingDetailModal } from "../../layouts/BookingDetailModal";

// ── Mock data — replace with API calls when booking-service is ready ──────────
const MOCK_BOOKINGS: BookingData[] = [
  {
    id: "1",
    bookingCode: "BK240001",
    customerName: "Nguyen Van An",
    customerEmail: "an.nguyen@gmail.com",
    movieTitle: "Avengers: Doomsday",
    roomName: "Cinema 1 (IMAX)",
    showDate: "2024-06-28",
    showTime: "19:30",
    seats: ["C4", "C5", "C6"],
    totalAmount: 360000,
    status: "PENDING",
    createdAt: "2024-06-27 10:12",
    expiresAt: "2024-06-28 19:00",
  },
  {
    id: "2",
    bookingCode: "BK240002",
    customerName: "Tran Thi Bich",
    customerEmail: "bich.tran@gmail.com",
    movieTitle: "Inside Out 2",
    roomName: "Cinema 3 (Standard)",
    showDate: "2024-06-28",
    showTime: "15:00",
    seats: ["A1", "A2"],
    totalAmount: 200000,
    status: "CONFIRMED",
    createdAt: "2024-06-26 14:05",
  },
  {
    id: "3",
    bookingCode: "BK240003",
    customerName: "Le Minh Duc",
    customerEmail: "duc.le@yahoo.com",
    movieTitle: "Deadpool & Wolverine",
    roomName: "Cinema 2 (3D)",
    showDate: "2024-06-27",
    showTime: "21:00",
    seats: ["F7", "F8", "F9", "F10"],
    totalAmount: 520000,
    status: "CANCELLED",
    createdAt: "2024-06-25 09:30",
  },
  {
    id: "4",
    bookingCode: "BK240004",
    customerName: "Pham Quynh Anh",
    customerEmail: "qanhanh@gmail.com",
    movieTitle: "Avengers: Doomsday",
    roomName: "Cinema 1 (IMAX)",
    showDate: "2024-06-29",
    showTime: "10:00",
    seats: ["B2", "B3"],
    totalAmount: 240000,
    status: "PENDING",
    createdAt: "2024-06-27 16:44",
    expiresAt: "2024-06-29 09:30",
  },
  {
    id: "5",
    bookingCode: "BK240005",
    customerName: "Hoang Van Khanh",
    customerEmail: "khanh.hv@outlook.com",
    movieTitle: "Inside Out 2",
    roomName: "Cinema 3 (Standard)",
    showDate: "2024-06-30",
    showTime: "13:30",
    seats: ["D5"],
    totalAmount: 100000,
    status: "CONFIRMED",
    createdAt: "2024-06-27 08:22",
  },
];

export default function ManageBookingPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();

  const [bookings, setBookings] = useState<BookingData[]>(MOCK_BOOKINGS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleConfirm = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "CONFIRMED" as const } : b))
    );
  };

  const handleCancel = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "CANCELLED" as const } : b))
    );
  };

  const handleView = (booking: BookingData) => {
    setSelectedBooking(booking);
    setModalOpen(true);
  };

  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "PENDING").length,
    confirmed: bookings.filter((b) => b.status === "CONFIRMED").length,
    cancelled: bookings.filter((b) => b.status === "CANCELLED").length,
  };

  const accentColor = isDarkMode ? "#f59e0b" : "#d97706";

  return (
    <>
      {/* Page header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
          Ticket & Booking Management
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          View, confirm, and cancel customer bookings. Counter ticket sales for walk-in customers.
        </p>
      </div>

      {/* Stats */}
      <BookingStatsCards {...stats} />

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text"
            placeholder="Search by booking code, customer, movie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none transition-all"
            style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <SlidersHorizontal size={15} /> Filters
          {statusFilter && <span className="w-2 h-2 rounded-full ml-0.5" style={{ background: accentColor }} />}
        </button>

        {/* Refresh */}
        <button
          onClick={() => setBookings(MOCK_BOOKINGS)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
          title="Refresh bookings"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div
          className="flex items-center gap-3 flex-wrap p-4 rounded-xl border mb-6 transition-all"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Filter by Status:</p>
          <div className="flex items-center gap-1 filter-btns">
            {[
              { value: "",          label: "All",       cls: "active-all" },
              { value: "PENDING",   label: "Pending",   cls: "active-amber" },
              { value: "CONFIRMED", label: "Confirmed", cls: "active-green" },
              { value: "CANCELLED", label: "Cancelled", cls: "active-red" },
            ].map(({ value, label, cls }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${statusFilter === value ? cls : ""}`}
              >
                {label}
                {value && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.15)" }}>
                    {value === "PENDING" ? stats.pending : value === "CONFIRMED" ? stats.confirmed : stats.cancelled}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <BookingTable
        bookings={bookings}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        onView={handleView}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* Detail modal */}
      <BookingDetailModal
        open={modalOpen}
        booking={selectedBooking}
        onClose={() => { setModalOpen(false); setSelectedBooking(null); }}
        onConfirm={(id) => { handleConfirm(id); setSelectedBooking((b) => b ? { ...b, status: "CONFIRMED" } : b); }}
        onCancel={(id) => { handleCancel(id); setSelectedBooking((b) => b ? { ...b, status: "CANCELLED" } : b); }}
      />

      <style>{`
        .filter-btns button { background: transparent; color: var(--text-sub); border-color: var(--border-color); }
        .filter-btns button:hover { background: rgba(128,128,128,0.1); color: var(--text-main); }
        .filter-btns button.active-all   { background: #6b7280 !important; color: #fff !important; border-color: #6b7280 !important; }
        .filter-btns button.active-amber { background: #f59e0b !important; color: #fff !important; border-color: #f59e0b !important; }
        .filter-btns button.active-green { background: #10b981 !important; color: #fff !important; border-color: #10b981 !important; }
        .filter-btns button.active-red   { background: #ef4444 !important; color: #fff !important; border-color: #ef4444 !important; }
      `}</style>
    </>
  );
}
