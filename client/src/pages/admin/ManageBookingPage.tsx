import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  TicketCheck,
  X,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { RowActions } from "../../components/admin/RowActions";

import {
  bookingApi,
  type BookingDetail,
  type BookingPage,
  type BookingStatus,
} from "../../api/bookingApi";
import { movieApi, type ClusterResponse } from "../../api/movieApi";
import {
  bookingStatusMeta,
  formatBookingDate,
  formatBookingDateTime,
  formatBookingMoney,
  getApiErrorMessage,
  paymentStatusLabel,
} from "../../components/booking/bookingUi";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import "./ManageBookingPage.css";

const STATUS_OPTIONS: Array<{ value: "" | BookingStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PENDING_PAYMENT", label: "Pending payment" },
  { value: "CONFIRM_PENDING", label: "Confirm pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CANCEL_REQUESTED", label: "Cancel requested" },
  { value: "REFUND_PENDING", label: "Refund pending" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EXPIRED", label: "Expired" },
];

const OPERATIONAL_ATTENTION = new Set<BookingStatus>([
  "PENDING_PAYMENT",
  "CONFIRM_PENDING",
  "CANCEL_REQUESTED",
  "REFUND_PENDING",
]);

export default function ManageBookingPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [clusterId, setClusterId] = useState<number | null>(null);
  const [result, setResult] = useState<BookingPage | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | BookingStatus>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<BookingDetail | null>(null);

  useEffect(() => {
    let active = true;
    movieApi.getClusters()
      .then((response) => {
        if (!active) return;
        const available = (response.result ?? []).filter((cluster) => cluster.status === "ACTIVE");
        setClusters(available);
        setClusterId((current) => current ?? available[0]?.clusterId ?? null);
      })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, "Cinema clusters could not be loaded."));
      });
    return () => { active = false; };
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (clusterId == null) {
      setLoading(false);
      return;
    }
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setResult(await bookingApi.getClusterBookings(clusterId, {
        page,
        size: 20,
        sort: "createdAt,desc",
      }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Bookings could not be loaded for this cinema."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clusterId, page]);

  useEffect(() => { void load(); }, [load]);

  const bookings = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return (result?.content ?? []).filter((booking) => {
      if (status && booking.status !== status) return false;
      if (!normalizedSearch) return true;
      return [
        booking.bookingCode,
        booking.movieName,
        booking.cinemaClusterName,
        booking.cinemaRoomName,
        booking.seats.map((seat) => seat.seatCode).join(" "),
      ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [result, search, status]);

  const loaded = result?.content ?? [];
  const attentionCount = loaded.filter((booking) => OPERATIONAL_ATTENTION.has(booking.status)).length;
  const confirmedCount = loaded.filter((booking) => booking.status === "CONFIRMED").length;
  const closedCount = loaded.filter((booking) =>
    ["CANCELLED", "EXPIRED", "REFUNDED"].includes(booking.status),
  ).length;

  return (
    <div className={`booking-admin ${isDarkMode ? "is-dark" : ""}`}>
      <AdminPageHeader
        eyebrow="Booking operations"
        title="Ticket & Booking Management"
        description="Monitor booking, payment and cancellation states within an authorized cinema cluster."
      />

      <section className="booking-admin__stats" aria-label="Booking summary">
        <AdminStat label="Total bookings" value={result?.totalElements ?? 0} helper="Across the selected cinema" tone="blue" />
        <AdminStat label="Needs attention" value={attentionCount} helper="On the loaded page" tone="amber" />
        <AdminStat label="Confirmed" value={confirmedCount} helper="Tickets issued on this page" tone="green" />
        <AdminStat label="Closed" value={closedCount} helper="Cancelled, expired or refunded" tone="neutral" />
      </section>

      <section className="mb-[18px] flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search bookings</span>
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-sub)" }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search booking code, movie, room or seat..."
            className="h-[42px] w-full rounded-xl border pl-10 pr-4 text-sm outline-none transition-colors focus:border-blue-500"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
          />
        </label>
        <div
          className="flex min-w-0 items-center overflow-hidden rounded-xl border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <span className="flex h-[42px] shrink-0 items-center px-3" style={{ color: "var(--text-sub)" }}>
            <MapPin size={15} />
          </span>
          <select
            value={clusterId ?? ""}
            onChange={(event) => {
              setClusterId(event.target.value ? Number(event.target.value) : null);
              setPage(0);
            }}
            className="h-[42px] min-w-0 flex-1 border-0 border-l px-3 text-sm outline-none sm:min-w-[190px]"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            aria-label="Filter by cinema"
          >
            {clusters.length === 0 && <option value="">No active cinema</option>}
            {clusters.map((cluster) => (
              <option key={cluster.clusterId} value={cluster.clusterId}>{cluster.clusterName}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "" | BookingStatus)}
            className="h-[42px] min-w-[135px] border-0 border-l px-3 text-sm outline-none"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "ALL"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
          title="Refresh"
        >
          <RefreshCw size={16} className={refreshing ? "booking-admin__spin" : ""} />
          Refresh
        </button>
      </section>

      {error && (
        <div className="booking-admin__error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => void load()}>Try again</button>
        </div>
      )}

      <section className="booking-admin__table-card">
        {loading ? (
          <div className="booking-admin__state"><LoaderCircle className="booking-admin__spin" size={30} /> Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="booking-admin__state">
            <TicketCheck size={34} />
            <strong>No bookings match this view</strong>
            <span>Change the cinema, status or search query.</span>
          </div>
        ) : (
          <div className="booking-admin__table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Movie & showtime</th>
                  <th>Seats</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th className="w-[72px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const meta = bookingStatusMeta[booking.status];
                  return (
                    <tr key={booking.bookingId}>
                      <td>
                        <strong>{booking.bookingCode}</strong>
                        <small>#{booking.bookingId}</small>
                      </td>
                      <td>
                        <strong>{booking.movieName}</strong>
                        <small>{formatBookingDate(booking.showDate)} · {booking.startTime?.slice(0, 5)} · {booking.cinemaRoomName}</small>
                      </td>
                      <td>
                        <strong>{booking.seats.map((seat) => seat.seatCode).join(", ") || "—"}</strong>
                        <small>{booking.seats.length} seat{booking.seats.length === 1 ? "" : "s"}</small>
                      </td>
                      <td><span className="booking-admin__payment">{paymentStatusLabel[booking.paymentStatus]}</span></td>
                      <td><strong>{formatBookingMoney(booking.total, booking.currency)}</strong></td>
                      <td>
                        <span className="booking-admin__status" style={{ color: meta.color, background: meta.background }}>
                          {meta.label}
                        </span>
                      </td>
                      <td><span>{formatBookingDateTime(booking.createdAt)}</span></td>
                      <td className="text-right">
                        <RowActions ariaLabel={`Actions for booking ${booking.bookingCode}`} actions={[{ key: "view", label: "View details", icon: Eye, onSelect: () => setSelected(booking) }]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(result?.totalPages ?? 0) > 1 && (
          <footer className="booking-admin__pagination">
            <span>Page {page + 1} of {result?.totalPages} · {result?.totalElements} bookings</span>
            <div>
              <button onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}><ChevronLeft size={17} /></button>
              <button onClick={() => setPage((value) => value + 1)} disabled={result?.last}><ChevronRight size={17} /></button>
            </div>
          </footer>
        )}
      </section>

      {selected && <AdminBookingModal booking={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AdminStat({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  tone: "blue" | "amber" | "green" | "neutral";
}) {
  return (
    <article className={`booking-admin__stat booking-admin__stat--${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <small>{helper}</small>
    </article>
  );
}

function AdminBookingModal({ booking, onClose }: { booking: BookingDetail; onClose: () => void }) {
  const meta = bookingStatusMeta[booking.status];
  return (
    <div className="booking-admin-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="booking-admin-modal-title">
        <header>
          <div>
            <span>BOOKING · {booking.bookingCode}</span>
            <h2 id="booking-admin-modal-title">{booking.movieName}</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="booking-admin-modal__body">
          <div className="booking-admin-modal__summary">
            <div><CalendarDays size={15} /><span>Date</span><strong>{formatBookingDate(booking.showDate)}</strong></div>
            <div><Clock3 size={15} /><span>Time</span><strong>{booking.startTime?.slice(0, 5)}</strong></div>
            <div><MapPin size={15} /><span>Cinema</span><strong>{booking.cinemaClusterName}</strong></div>
            <div><TicketCheck size={15} /><span>Room</span><strong>{booking.cinemaRoomName}</strong></div>
          </div>

          <div className="booking-admin-modal__section">
            <div>
              <h3>Seat & price snapshot</h3>
              <p>Values are retained from the booking transaction and are not recalculated here.</p>
            </div>
            {booking.seats.map((seat) => (
              <div className="booking-admin-modal__seat" key={seat.showtimeSeatId}>
                <span><strong>{seat.seatCode}</strong> · {seat.seatType}</span>
                <strong>{formatBookingMoney(seat.finalPrice, booking.currency)}</strong>
              </div>
            ))}
            <div className="booking-admin-modal__total">
              <span>Total</span>
              <strong>{formatBookingMoney(booking.total, booking.currency)}</strong>
            </div>
          </div>

          <div className="booking-admin-modal__state">
            <div><span>Booking</span><strong style={{ color: meta.color }}>{meta.label}</strong></div>
            <div><span>Payment</span><strong>{paymentStatusLabel[booking.paymentStatus]}</strong></div>
            <div><span>Inventory</span><strong>{booking.inventoryStatus}</strong></div>
            <div><span>Expires</span><strong>{formatBookingDateTime(booking.expiresAt)}</strong></div>
          </div>

          <div className="booking-admin-modal__note">
            This screen is read-only. Confirmation, cancellation and refund transitions must be executed
            through their authoritative payment or cancellation workflow.
          </div>
        </div>
      </section>
    </div>
  );
}
