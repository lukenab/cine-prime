import { ReactNode } from "react";
import { Armchair, CalendarDays, Clock3, CreditCard, Film, LoaderCircle, MapPin, Popcorn, Tag, X } from "lucide-react";

export interface SummarySeat {
  id?: number;
  code: string;
  type?: string;
  price?: number;
}

export interface SummaryComboItem {
  name: string;
  quantity: number;
  totalPrice: number;
}

export interface SummaryAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "ghost";
}

export interface BookingSummaryCardProps {
  movieName: string;
  posterUrl?: string;
  ageRatingCode?: string;
  durationMinutes?: number;
  cinemaName: string;
  cinemaAddress?: string;
  roomName?: string;
  showDateLabel: string;
  showTimeLabel: string;
  /** Only rendered once seats are known (Seats step onward). */
  seats?: SummarySeat[];
  seatsSubtotal?: number;
  /** Seats step only: renders a per-seat remove (×) button. */
  onRemoveSeat?: (seat: SummarySeat) => void;
  maxSeats?: number;
  holdMinutes?: number;
  /** Only rendered once the Food step has been reached. */
  comboItems?: SummaryComboItem[];
  comboSubtotal?: number;
  serviceFee?: number;
  discount?: number;
  /** Only rendered once a payment method is known (post-payment). */
  paymentMethod?: string;
  currency?: string;
  total: number;
  holdRemainingSeconds?: number;
  holdExpired?: boolean;
  primaryAction?: SummaryAction;
  /** Renders side-by-side with primaryAction (equal-weight navigation, e.g. "Back"). */
  backAction?: SummaryAction;
  /** Renders below primaryAction as a de-emphasized full-width link (e.g. "Skip", "Cancel"). */
  secondaryAction?: SummaryAction;
  /** Slot for step-specific content, e.g. a promo code field on the Payment step. */
  extra?: ReactNode;
  emptyHint?: string;
  headerAction?: SummaryAction;
}

const money = (amount: number, currency = "VND") =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(amount);

const formatCountdown = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/** Groups selected seats by type (e.g. 3 VIP seats -> one "3 x VIP" block
 *  listing D5/D6/D7 as chips) instead of one full-width row per seat. */
const SEAT_TYPE_ORDER = ["STANDARD", "VIP", "COUPLE"];

const formatSeatTypeLabel = (type: string) =>
  type.toUpperCase() === "VIP" ? "VIP" : type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

const groupSeatsByType = (seats: SummarySeat[]) => {
  const byType = new Map<string, { type: string; label: string; seats: SummarySeat[]; total: number }>();
  seats.forEach((seat) => {
    const type = seat.type ?? "STANDARD";
    const existing = byType.get(type);
    if (existing) {
      existing.seats.push(seat);
      existing.total += seat.price ?? 0;
    } else {
      byType.set(type, { type, label: formatSeatTypeLabel(type), seats: [seat], total: seat.price ?? 0 });
    }
  });
  return Array.from(byType.values()).sort((a, b) => {
    const ai = SEAT_TYPE_ORDER.indexOf(a.type.toUpperCase());
    const bi = SEAT_TYPE_ORDER.indexOf(b.type.toUpperCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
};

export default function BookingSummaryCard({
  movieName,
  posterUrl,
  ageRatingCode,
  durationMinutes,
  cinemaName,
  cinemaAddress,
  roomName,
  showDateLabel,
  showTimeLabel,
  seats,
  seatsSubtotal,
  onRemoveSeat,
  maxSeats,
  holdMinutes,
  comboItems,
  comboSubtotal,
  serviceFee,
  discount,
  paymentMethod,
  currency = "VND",
  total,
  holdRemainingSeconds,
  holdExpired,
  primaryAction,
  backAction,
  secondaryAction,
  extra,
  emptyHint,
  headerAction,
}: BookingSummaryCardProps) {
  const hasSeats = Boolean(seats && seats.length > 0);
  const hasCombos = Boolean(comboItems && comboItems.length > 0);
  const seatGroups = hasSeats ? groupSeatsByType(seats!) : [];

  return (
    <div className="flex h-full flex-col gap-3 xl:sticky xl:top-24">
      {/* Hold countdown sits above the card, not buried inside it, so it
          stays visible at a glance while scrolling the summary. No frame
          around it — the amber, high-contrast timer digits are what should
          catch the eye, not a boxed banner. */}
      {holdRemainingSeconds != null && (
        <div className={`flex shrink-0 items-center gap-1.5 px-1 py-1 text-sm ${holdExpired ? "text-rose-300" : "text-white/60"}`}>
          <Clock3 size={16} className="shrink-0" />
          <span>{holdExpired ? "Seat hold expired" : "Seats held for:"}</span>
          {!holdExpired && (
            <strong
              className={`font-mono text-xl font-bold leading-none tabular-nums ${
                holdRemainingSeconds <= 120 ? "text-orange-400" : "text-amber-400"
              }`}
              style={{ textShadow: "0 0 18px rgba(251,191,36,0.35)" }}
            >
              {formatCountdown(holdRemainingSeconds)}
            </strong>
          )}
        </div>
      )}

      <aside className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-blue-400/20 bg-[#101725]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex min-w-0 items-start gap-3.5">
        {posterUrl ? (
          <img src={posterUrl} alt="" className="h-32 w-[86px] shrink-0 rounded-lg border border-white/10 object-cover" />
        ) : (
          <span className="grid h-32 w-[86px] shrink-0 place-items-center rounded-lg bg-blue-500/15 text-blue-400">
            <Film size={28} />
          </span>
        )}
        <div className="min-w-0 pt-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-400">Booking details</p>
          <h2 className="mt-1 line-clamp-2 font-bold leading-snug">{movieName || "Your movie"}</h2>
          {(ageRatingCode || durationMinutes) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ageRatingCode && (
                <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] font-bold text-rose-300">{ageRatingCode}</span>
              )}
              {durationMinutes ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">{durationMinutes} min</span>
              ) : null}
            </div>
          )}
        </div>
        </div>
        {headerAction && (
          <button
            type="button"
            onClick={headerAction.onClick}
            disabled={headerAction.disabled}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {headerAction.label}
          </button>
        )}
      </div>

      <div className="space-y-4 px-5 py-5 text-sm">
        <div className="flex gap-3">
          <MapPin size={17} className="mt-0.5 shrink-0 text-blue-400" />
          <div>
            <p className="font-medium">{cinemaName}</p>
            {cinemaAddress && <p className="mt-0.5 text-xs text-white/40">{cinemaAddress}</p>}
            {roomName && <p className="mt-0.5 text-xs text-white/40">{roomName}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex gap-3">
            <CalendarDays size={17} className="mt-0.5 shrink-0 text-blue-400" />
            <div>
              <p className="font-medium">{showDateLabel}</p>
              <p className="mt-0.5 text-xs text-white/40">Show date</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Clock3 size={17} className="mt-0.5 shrink-0 text-blue-400" />
            <div>
              <p className="font-medium">{showTimeLabel}</p>
              <p className="mt-0.5 text-xs text-white/40">Start time</p>
            </div>
          </div>
        </div>

        {hasSeats ? (
          onRemoveSeat ? (
            <div className="space-y-2">
              {seatGroups.map((group) => (
                <div key={group.type} className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{group.seats.length} × {group.label}</span>
                    <span className="text-xs font-medium tabular-nums text-white/70">{money(group.total, currency)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {group.seats.map((seat) => (
                      <span key={seat.id ?? seat.code} className="flex items-center gap-1 rounded-md bg-white/[0.05] py-0.5 pl-2 pr-1 text-[11px] font-medium text-white/70">
                        {seat.code}
                        <button
                          type="button"
                          aria-label={`Remove seat ${seat.code}`}
                          onClick={() => onRemoveSeat(seat)}
                          className="grid h-4 w-4 place-items-center rounded text-white/35 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-3">
              <Armchair size={17} className="mt-0.5 shrink-0 text-blue-400" />
              <div>
                <p className="font-medium">{seats!.map((s) => s.code).join(", ")}</p>
                <p className="mt-0.5 text-xs text-white/40">{seats!.length} selected seat{seats!.length === 1 ? "" : "s"}</p>
              </div>
            </div>
          )
        ) : emptyHint ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 px-3.5 py-3 text-white/35">
            <Armchair size={18} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/60">{emptyHint}</p>
              {(maxSeats || holdMinutes) && (
                <p className="mt-0.5 text-[10px] text-white/25">
                  {maxSeats ? `Maximum ${maxSeats} seats` : ""}
                  {maxSeats && holdMinutes ? " · " : ""}
                  {holdMinutes ? `${holdMinutes}-minute web hold` : ""}
                </p>
              )}
            </div>
          </div>
        ) : null}

        {hasCombos && (
          <div className="flex gap-3">
            <Popcorn size={17} className="mt-0.5 shrink-0 text-blue-400" />
            <div className="min-w-0">
              {comboItems!.map((item) => (
                <p key={item.name} className="truncate font-medium">
                  {item.quantity}× {item.name}
                </p>
              ))}
            </div>
          </div>
        )}

        {paymentMethod && (
          <div className="flex gap-3">
            <CreditCard size={17} className="mt-0.5 shrink-0 text-blue-400" />
            <div>
              <p className="font-medium">{paymentMethod}</p>
              <p className="mt-0.5 text-xs text-white/40">Payment method</p>
            </div>
          </div>
        )}
      </div>

      {extra && <div className="mx-5 mt-5">{extra}</div>}

      <div className="mx-5 mt-auto space-y-2.5 border-t border-white/10 pt-5 text-sm">
        {seatsSubtotal != null && (
          <div className="flex justify-between text-white/50">
            <span>Tickets</span>
            <span>{money(seatsSubtotal, currency)}</span>
          </div>
        )}
        {comboSubtotal != null && comboSubtotal > 0 && (
          <div className="flex justify-between text-white/50">
            <span>Food & drinks</span>
            <span>{money(comboSubtotal, currency)}</span>
          </div>
        )}
        {serviceFee != null && serviceFee > 0 && (
          <div className="flex justify-between text-white/50">
            <span>Service fee</span>
            <span>{money(serviceFee, currency)}</span>
          </div>
        )}
        {discount != null && discount > 0 && (
          <div className="flex justify-between text-emerald-300">
            <span className="flex items-center gap-1.5"><Tag size={13} /> Discount</span>
            <span>-{money(discount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 text-lg font-bold">
          <span>Total</span>
          <span className="text-blue-300">{money(total, currency)}</span>
        </div>
      </div>

      {(primaryAction || backAction || secondaryAction) && (
        <div className="space-y-2 p-5">
          {(primaryAction || backAction) && (
            <div className="flex gap-2">
              {backAction && (
                <button
                  type="button"
                  disabled={backAction.disabled}
                  onClick={backAction.onClick}
                  className={`rounded-xl border border-white/15 py-3.5 text-sm font-bold text-white/75 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${primaryAction ? "flex-1" : "w-full"}`}
                >
                  {backAction.label}
                </button>
              )}
              {primaryAction && (
                <button
                  type="button"
                  disabled={primaryAction.disabled}
                  onClick={primaryAction.onClick}
                  className={`flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(37,99,235,0.22)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none ${backAction ? "flex-[2]" : "w-full"}`}
                >
                  {primaryAction.loading && <LoaderCircle size={17} className="animate-spin" />}
                  {primaryAction.label}
                </button>
              )}
            </div>
          )}
          {secondaryAction && (
            <button
              type="button"
              disabled={secondaryAction.disabled}
              onClick={secondaryAction.onClick}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white/45 transition hover:bg-white/5 hover:text-white"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
      </aside>
    </div>
  );
}
