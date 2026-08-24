import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, CreditCard, LoaderCircle, MapPin, Printer, RefreshCw, Ticket } from "lucide-react";
import { bookingApi, type CounterSaleResponse, type Seat } from "../../api/bookingApi";
import { movieApi, type ClusterResponse } from "../../api/movieApi";
import { showtimeApi, type ShowtimeResponse } from "../../api/showtimeApi";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { useAuth } from "../../context/AuthContext";
import { clustersForSession } from "../../utils/clusterScope";

const money = (value: number, currency = "VND") =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(value);
const apiMessage = (error: any, fallback: string) => error?.response?.data?.message || error?.message || fallback;
const operationKey = () => crypto.randomUUID();
const receiptReference = () => `POS-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

export default function TicketSalePage() {
  const { user } = useAuth();
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [clusterId, setClusterId] = useState<number | null>(null);
  const [showtimeId, setShowtimeId] = useState<number | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
  const [terminalId, setTerminalId] = useState(() => localStorage.getItem("cineprime:pos-terminal") || "COUNTER-01");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [receiptRef, setReceiptRef] = useState(receiptReference);
  const [idempotencyKey, setIdempotencyKey] = useState(operationKey);
  const [loading, setLoading] = useState(true);
  const [seatLoading, setSeatLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CounterSaleResponse | null>(null);
  const clusterScope = user?.clusterIds.join(",") ?? "";
  const roleScope = user?.roles.join(",") ?? "";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([movieApi.getClusters(), showtimeApi.getShowtimes()])
      .then(([clusterResponse, showtimeResponse]) => {
        if (!active) return;
        const scoped = clustersForSession(
          (clusterResponse.result ?? []).filter((cluster) => cluster.status === "ACTIVE"),
          user?.roles,
          user?.clusterIds,
        );
        setClusters(scoped);
        setShowtimes((showtimeResponse.result ?? []).filter((item) => item.status === "ON_SALE"));
        setClusterId(scoped[0]?.clusterId ?? null);
        if (!scoped.length) setError("No active cinema is assigned to this account. Contact a manager to update the staff assignment.");
      })
      .catch((requestError) => setError(apiMessage(requestError, "Ticket-sales data could not be loaded.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [clusterScope, roleScope]);

  const clusterShowtimes = useMemo(() => showtimes
    .filter((item) => item.clusterId === clusterId)
    .sort((a, b) => `${a.showDate}T${a.startTime}`.localeCompare(`${b.showDate}T${b.startTime}`)),
  [clusterId, showtimes]);
  const selectedShowtime = clusterShowtimes.find((item) => item.showTimeId === showtimeId) ?? null;
  const selectedSeats = seats.filter((seat) => selectedSeatIds.includes(seat.seatId));
  const total = selectedSeats.reduce((sum, seat) => sum + Number(seat.price || 0), 0);

  useEffect(() => {
    setShowtimeId(null);
    setSeats([]);
    setSelectedSeatIds([]);
    setReceiptRef(receiptReference());
    setIdempotencyKey(operationKey());
    setResult(null);
  }, [clusterId]);

  useEffect(() => {
    if (!showtimeId) return;
    let active = true;
    setSeatLoading(true);
    setError("");
    setSelectedSeatIds([]);
    setReceiptRef(receiptReference());
    setIdempotencyKey(operationKey());
    bookingApi.getSeatMapByShowtime(showtimeId)
      .then((map) => active && setSeats(map.seats ?? []))
      .catch((requestError) => active && setError(apiMessage(requestError, "Seat inventory could not be loaded.")))
      .finally(() => active && setSeatLoading(false));
    return () => { active = false; };
  }, [showtimeId]);

  const toggleSeat = (seat: Seat) => {
    if (seat.status !== "AVAILABLE") return;
    setSelectedSeatIds((current) => current.includes(seat.seatId)
      ? current.filter((id) => id !== seat.seatId)
      : current.length < 8 ? [...current, seat.seatId] : current);
  };

  const submit = async () => {
    if (!clusterId || !showtimeId || !selectedSeatIds.length || !terminalId.trim() || !receiptRef.trim()) return;
    setSubmitting(true);
    setError("");
    localStorage.setItem("cineprime:pos-terminal", terminalId.trim());
    try {
      setResult(await bookingApi.createCounterSale(clusterId, {
        showtimeId,
        seatIds: selectedSeatIds,
        terminalId: terminalId.trim(),
        paymentMethod,
        receiptReference: receiptRef.trim(),
      }, idempotencyKey));
    } catch (requestError) {
      setError(apiMessage(requestError, "The counter sale could not be completed."));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setShowtimeId(null);
    setSeats([]);
    setSelectedSeatIds([]);
    setReceiptRef(receiptReference());
    setIdempotencyKey(operationKey());
    setResult(null);
    setError("");
  };

  if (result) return <div>
    <AdminPageHeader eyebrow="Customer operations" title="Ticket sale completed" description="The booking and payment were recorded by booking-service." />
    <section className="mx-auto max-w-3xl rounded-2xl border bg-[var(--bg-card)] p-8 text-center" style={{ borderColor: "var(--border-color)" }}>
      <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
      <p className="mt-5 text-sm text-[var(--text-sub)]">Booking code</p>
      <h2 className="mt-1 text-3xl font-bold tracking-wide">{result.bookingCode}</h2>
      <div className="mt-6 grid gap-3 rounded-xl bg-[var(--bg-main)] p-5 text-left sm:grid-cols-2">
        <Info label="Seats" value={result.seatCodes.join(", ")} />
        <Info label="Total collected" value={money(result.total, result.currency)} />
        <Info label="Payment method" value={result.paymentMethod} />
        <Info label="Receipt reference" value={result.receiptReference} />
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <button className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold" style={{ borderColor: "var(--border-color)" }} onClick={() => window.print()}><Printer size={16} /> Print receipt</button>
        <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white" onClick={reset}><RefreshCw size={16} /> New sale</button>
      </div>
    </section>
  </div>;

  return <div>
    <AdminPageHeader eyebrow="Customer operations" title="Ticket Sales" description="Sell available seats at an authorized cinema counter." />
    {error && <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-2xl border bg-[var(--bg-card)] p-5" style={{ borderColor: "var(--border-color)" }}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Cinema" icon={<MapPin size={15} />}><select value={clusterId ?? ""} disabled={loading || clusters.length <= 1} onChange={(event) => setClusterId(Number(event.target.value))} className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm" style={{ borderColor: "var(--border-color)" }}><option value="">No assigned cinema</option>{clusters.map((cluster) => <option key={cluster.clusterId} value={cluster.clusterId}>{cluster.clusterName}</option>)}</select></Field>
          <Field label="On-sale showtime" icon={<Ticket size={15} />}><select value={showtimeId ?? ""} disabled={!clusterId || loading} onChange={(event) => setShowtimeId(event.target.value ? Number(event.target.value) : null)} className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm" style={{ borderColor: "var(--border-color)" }}><option value="">Select movie and showtime</option>{clusterShowtimes.map((item) => <option key={item.showTimeId} value={item.showTimeId}>{item.movieName} · {item.showDate} {item.startTime.slice(0, 5)} · {item.cinemaRoomName}</option>)}</select></Field>
        </div>
        <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border-color)" }}>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Seat inventory</h2><p className="text-xs text-[var(--text-sub)]">Select up to 8 available seats.</p></div>{seatLoading && <LoaderCircle className="animate-spin text-blue-500" size={20} />}</div>
          {!showtimeId ? <Empty text="Select an on-sale showtime to load its live seat inventory." /> : !seatLoading && !seats.length ? <Empty text="No sellable seats are available for this showtime." /> : <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">{seats.map((seat) => {
            const selected = selectedSeatIds.includes(seat.seatId);
            const available = seat.status === "AVAILABLE";
            return <button key={seat.seatId} disabled={!available} onClick={() => toggleSeat(seat)} title={`${seat.seatCode ?? `${seat.row}${seat.number}`} · ${money(seat.price)}`} className={`h-10 rounded-lg border text-xs font-semibold transition ${selected ? "border-blue-600 bg-blue-600 text-white" : available ? "hover:border-blue-500" : "cursor-not-allowed opacity-35"}`} style={selected ? undefined : { borderColor: "var(--border-color)" }}>{seat.seatCode ?? `${seat.row}${seat.number}`}</button>;
          })}</div>}
        </div>
      </div>
      <aside className="h-fit rounded-2xl border bg-[var(--bg-card)] p-5" style={{ borderColor: "var(--border-color)" }}>
        <h2 className="font-semibold">Counter payment</h2><p className="mt-1 text-xs text-[var(--text-sub)]">Payment is recorded only after booking-service confirms the sale.</p>
        <div className="mt-5 space-y-4">
          <Field label="Terminal ID"><input value={terminalId} maxLength={50} onChange={(event) => setTerminalId(event.target.value)} className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm" style={{ borderColor: "var(--border-color)" }} /></Field>
          <Field label="Payment method" icon={<CreditCard size={15} />}><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm" style={{ borderColor: "var(--border-color)" }}><option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank transfer</option></select></Field>
          <Field label="Receipt reference"><input value={receiptRef} maxLength={100} onChange={(event) => setReceiptRef(event.target.value)} className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm" style={{ borderColor: "var(--border-color)" }} /></Field>
        </div>
        <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border-color)" }}><Info label="Showtime" value={selectedShowtime ? `${selectedShowtime.showDate} · ${selectedShowtime.startTime.slice(0, 5)}` : "Not selected"} /><div className="mt-3"><Info label="Seats" value={selectedSeats.map((seat) => seat.seatCode).join(", ") || "Not selected"} /></div><div className="mt-5 flex items-end justify-between"><span className="text-sm text-[var(--text-sub)]">Total</span><strong className="text-2xl">{money(total)}</strong></div></div>
        <button disabled={!showtimeId || !selectedSeatIds.length || !terminalId.trim() || !receiptRef.trim() || submitting} onClick={submit} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{submitting ? <LoaderCircle className="animate-spin" size={17} /> : <CreditCard size={17} />} Confirm payment & issue tickets</button>
      </aside>
    </section>
  </div>;
}

function Field({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-sub)]">{icon}{label}</span>{children}</label>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-xs uppercase tracking-wide text-[var(--text-sub)]">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed py-14 text-center text-sm text-[var(--text-sub)]" style={{ borderColor: "var(--border-color)" }}>{text}</div>;
}
