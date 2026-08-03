import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LoaderCircle, Minus, Plus, Popcorn } from "lucide-react";
import { bookingApi, type BookingDetail } from "../../api/bookingApi";
import { movieApi, type ClusterResponse, type PublicMovieResponse } from "../../api/movieApi";
import {
  concessionApi,
  type CatalogConcession,
  type ComboComponent,
  type ConcessionCartItem,
  type ReservationSelection,
} from "../../api/concessionApi";
import CheckoutProgress from "../../components/booking/CheckoutProgress";
import BookingSummaryCard from "../../components/booking/BookingSummaryCard";
import CancelBookingModal from "../../components/booking/CancelBookingModal";
import { formatBookingDate } from "../../components/booking/bookingUi";
import { useBookingFlowCancelAction } from "../../context/BookingFlowContext";
import "../../components/booking/booking.css";

const money = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const formatTime = (value?: string) => value?.slice(0, 5) || "—";

type CartLine = ConcessionCartItem & { key: string; product: CatalogConcession };

const groupComponents = (components: ComboComponent[]) =>
  components.reduce<Record<string, ComboComponent[]>>((groups, component) => {
    if (!groups[component.groupCode]) groups[component.groupCode] = [];
    groups[component.groupCode].push(component);
    return groups;
  }, {});

const componentCapacity = (component: ComboComponent) =>
  component.availableCount == null
    ? Number.MAX_SAFE_INTEGER
    : Math.floor(component.availableCount / Math.max(1, component.quantity));

const initialGroupSelection = (options: ComboComponent[], count: number) => {
  const usage = new Map<number, number>();
  return Array.from({ length: count }, () => {
    const option = options.find(
      (candidate) => (usage.get(candidate.allowedSkuId) ?? 0) < componentCapacity(candidate),
    );
    if (!option) return options[0]?.allowedSkuId ?? 0;
    usage.set(option.allowedSkuId, (usage.get(option.allowedSkuId) ?? 0) + 1);
    return option.allowedSkuId;
  });
};

const defaultComboSelections = (product: CatalogConcession): ReservationSelection[] =>
  Object.entries(groupComponents(product.components)).map(([groupCode, options]) => ({
    groupCode,
    skuIds: initialGroupSelection(options, options[0]?.minSelect ?? 0),
  }));

const selectionsAsRecord = (selections?: ReservationSelection[]) =>
  Object.fromEntries((selections ?? []).map(({ groupCode, skuIds }) => [groupCode, skuIds]));

const selectionIsAvailable = (
  product: CatalogConcession,
  selection: Record<string, number[]>,
  comboQuantity = 1,
) => {
  const groups = groupComponents(product.components);
  return Object.entries(groups).every(([groupCode, options]) => {
    if (!options.length) return false;
    const selected = selection[groupCode] ?? [];
    if (selected.length < options[0].minSelect || selected.length > options[0].maxSelect) return false;
    const usage = selected.reduce<Map<number, number>>((counts, skuId) => {
      counts.set(skuId, (counts.get(skuId) ?? 0) + 1);
      return counts;
    }, new Map());
    return Array.from(usage.entries()).every(([skuId, count]) => {
      const option = options.find((candidate) => candidate.allowedSkuId === skuId);
      return Boolean(option && count * comboQuantity <= componentCapacity(option));
    });
  });
};

const comboContents = (product: CatalogConcession, selections?: ReservationSelection[]) => {
  const selectedIds = (selections ?? defaultComboSelections(product)).flatMap((group) => group.skuIds);
  return selectedIds
    .map((skuId) => product.components.find((component) => component.allowedSkuId === skuId)?.label)
    .filter((label): label is string => Boolean(label))
    .join(" · ");
};

export default function ConcessionSelectionPage() {
  const { bookingId = "" } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [catalog, setCatalog] = useState<CatalogConcession[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [movieDetail, setMovieDetail] = useState<PublicMovieResponse | null>(null);
  const [clusterDetail, setClusterDetail] = useState<ClusterResponse | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Hands the navbar its "Cancel booking" action while this step is
  // mounted (see BookingFlowContext) so it can switch into its locked,
  // logo-only checkout mode instead of showing full site navigation.
  const openCancel = useCallback(() => setCancelOpen(true), []);
  useBookingFlowCancelAction("Cancel booking", booking ? openCancel : null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await bookingApi.getBooking(bookingId);
        if (!active) return;
        if (current.status !== "PENDING_PAYMENT" || current.concessions?.length) {
          navigate(`/checkout/${bookingId}`, { replace: true });
          return;
        }
        setBooking(current);
        setCatalog(await concessionApi.getCatalog(current.cinemaClusterId, current.showtimeId));
      } catch (requestError: any) {
        setError(requestError?.response?.data?.message || "Concession catalog could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [bookingId, navigate]);

  useEffect(() => {
    if (!booking?.expiresAt) return;
    const updateRemaining = () => {
      const expiry = new Date(booking.expiresAt as string).getTime();
      setRemainingSeconds(Math.max(0, Math.floor((expiry - Date.now()) / 1000)));
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [booking?.expiresAt]);

  // Best-effort enrichment (poster/age rating, full cinema address) shared
  // with BookingCheckoutPage — see its comment for why this stays a
  // separate, non-blocking fetch instead of part of the booking snapshot.
  useEffect(() => {
    if (!booking?.movieId) return;
    let active = true;
    movieApi.getPublicMovieDetail(booking.movieId).then((res) => { if (active) setMovieDetail(res.result); }).catch(() => {});
    return () => { active = false; };
  }, [booking?.movieId]);

  useEffect(() => {
    if (!booking?.cinemaClusterId) return;
    let active = true;
    movieApi.getClusterById(booking.cinemaClusterId).then((res) => { if (active) setClusterDetail(res.result); }).catch(() => {});
    return () => { active = false; };
  }, [booking?.cinemaClusterId]);

  const combos = useMemo(
    () => catalog.filter((item) => item.sellableType === "COMBO"),
    [catalog],
  );
  const concessionTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const holdExpired = Boolean(booking?.expiresAt) && remainingSeconds <= 0;

  const findLine = (product: CatalogConcession) =>
    cart.find((line) => line.sellableId === product.sellableId && line.sellableType === "COMBO");

  const canUseQuantity = (product: CatalogConcession, quantity: number, selections?: ReservationSelection[]) =>
    product.availability !== "SOLD_OUT"
    && selectionIsAvailable(product, selectionsAsRecord(selections ?? defaultComboSelections(product)), quantity);

  const changeComboQuantity = (product: CatalogConcession, delta: number) => {
    setError("");
    setCart((current) => {
      const existing = current.find(
        (line) => line.sellableId === product.sellableId && line.sellableType === "COMBO",
      );
      const nextQuantity = Math.max(0, (existing?.quantity ?? 0) + delta);
      const selections = existing?.selections ?? defaultComboSelections(product);

      if (nextQuantity === 0) {
        return current.filter((line) => line !== existing);
      }
      if (!canUseQuantity(product, nextQuantity, selections)) {
        setError(`There is not enough stock for another ${product.name}.`);
        return current;
      }
      if (existing) {
        return current.map((line) =>
          line === existing ? { ...line, quantity: nextQuantity } : line,
        );
      }
      return [
        ...current,
        {
          key: `COMBO:${product.sellableId}`,
          product,
          sellableType: "COMBO",
          sellableId: product.sellableId,
          quantity: 1,
          selections,
        },
      ];
    });
  };

  const continueToPayment = async () => {
    if (!booking || holdExpired) return;
    // No combos selected: there's nothing to attach, so this doubles as the
    // old "skip" action instead of requiring a separate button for it.
    if (!cart.length) {
      navigate(`/checkout/${bookingId}`);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const storageKey = `cineprime:concession-idempotency:${bookingId}`;
      let idempotencyKey = sessionStorage.getItem(storageKey);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        sessionStorage.setItem(storageKey, idempotencyKey);
      }
      await bookingApi.attachConcessions(
        bookingId,
        cart.map(({ sellableType, sellableId, quantity, selections }) => ({
          sellableType,
          sellableId,
          quantity,
          selections,
        })),
        idempotencyKey,
      );
      navigate(`/checkout/${bookingId}`);
    } catch (requestError: any) {
      setError(
        requestError?.response?.status === 409
          ? "One or more combos are no longer available. Please reduce the quantity or choose another combo."
          : requestError?.response?.data?.message || "Items could not be reserved. Please review your order.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="grid min-h-[70vh] place-items-center bg-[#080b12] text-white">
        <LoaderCircle className="animate-spin text-blue-400" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080b12] px-4 pb-7 pt-24 text-white sm:px-8 sm:pt-28">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">Optional add-on</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Choose food & drinks</h1>
          <p className="mt-2 text-sm text-white/50">
            Quick-pick combos available at {booking?.cinemaClusterName}. Continue without adding anything to skip this step.
          </p>
        </div>

        <CheckoutProgress currentStep={2} />

        <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-label="Available combos">
            {error && (
              <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1119]">
              <div className="border-b border-white/10 px-5 py-4">
                <h2 className="font-semibold">Cinema combos</h2>
                <p className="mt-1 text-xs text-white/40">Everything you need, grouped for faster checkout.</p>
              </div>

              <div className="divide-y divide-white/10">
                {combos.map((product) => {
                  const line = findLine(product);
                  const quantity = line?.quantity ?? 0;
                  const soldOut = product.availability === "SOLD_OUT";
                  const canIncrement = canUseQuantity(product, quantity + 1, line?.selections);
                  const contents = comboContents(product, line?.selections);

                  return (
                    <article
                      key={product.sellableId}
                      className={`grid gap-4 p-4 transition sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center sm:p-5 ${
                        quantity > 0 ? "bg-blue-500/[0.055]" : "hover:bg-white/[0.025]"
                      }`}
                    >
                      <div className="relative h-24 overflow-hidden rounded-xl border border-white/10 bg-[#111827] sm:h-24 sm:w-28">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-blue-400/70">
                            <Popcorn size={30} />
                          </div>
                        )}
                        {soldOut && (
                          <div className="absolute inset-0 grid place-items-center bg-black/70 text-[11px] font-bold uppercase tracking-wider">
                            Sold out
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-white">{product.name}</h3>
                          {product.availability === "LOW_AVAILABILITY" && (
                            <span className="rounded-full bg-orange-400/10 px-2 py-1 text-[10px] font-bold uppercase text-orange-300">
                              Low stock
                            </span>
                          )}
                        </div>
                        {product.description && (
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-white/45">{product.description}</p>
                        )}
                        {contents && (
                          <p className="mt-2 truncate text-xs text-blue-300/80">
                            Includes: {contents}
                          </p>
                        )}
                        <p className="mt-3 font-bold text-blue-300">{money(product.price)}</p>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <span className="text-xs text-white/35 sm:hidden">Quantity</span>
                        <div className={`flex items-center rounded-xl border p-1 ${
                          quantity > 0
                            ? "border-blue-400/35 bg-blue-500/10"
                            : "border-white/10 bg-black/20"
                        }`}>
                          <button
                            type="button"
                            aria-label={`Remove one ${product.name}`}
                            disabled={quantity === 0}
                            onClick={() => changeComboQuantity(product, -1)}
                            className="grid h-9 w-9 place-items-center rounded-lg text-white/65 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-9 text-center text-sm font-bold tabular-nums">{quantity}</span>
                          <button
                            type="button"
                            aria-label={`Add one ${product.name}`}
                            disabled={soldOut || !canIncrement}
                            onClick={() => changeComboQuantity(product, 1)}
                            className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {!combos.length && (
                <div className="grid min-h-52 place-items-center px-6 text-center">
                  <div>
                    <Popcorn className="mx-auto text-white/20" size={32} />
                    <p className="mt-3 text-sm text-white/40">No combos are available for this cinema.</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <BookingSummaryCard
            movieName={booking?.movieName || "Your movie"}
            posterUrl={movieDetail?.posterUrl}
            ageRatingCode={movieDetail?.ageRating?.ratingCode}
            durationMinutes={movieDetail?.durationMinutes}
            cinemaName={booking?.cinemaClusterName || ""}
            cinemaAddress={clusterDetail?.address}
            roomName={booking?.cinemaRoomName}
            showDateLabel={formatBookingDate(booking?.showDate)}
            showTimeLabel={formatTime(booking?.startTime)}
            seats={booking?.seats?.map((seat) => ({ code: seat.seatCode, type: seat.seatType, price: seat.finalPrice }))}
            seatsSubtotal={booking?.ticketSubtotal}
            comboItems={cart.map((item) => ({ name: item.product.name, quantity: item.quantity, totalPrice: item.product.price * item.quantity }))}
            comboSubtotal={concessionTotal}
            serviceFee={booking?.serviceFee}
            currency={booking?.currency}
            total={(booking?.total ?? 0) + concessionTotal}
            holdRemainingSeconds={remainingSeconds}
            holdExpired={holdExpired}
            backAction={{ label: "Back", onClick: () => navigate(-1) }}
            primaryAction={{
              label: "Continue",
              onClick: () => void continueToPayment(),
              disabled: submitting || holdExpired,
              loading: submitting,
            }}
          />
        </div>
      </div>

      <CancelBookingModal
        open={cancelOpen}
        booking={booking}
        onClose={() => setCancelOpen(false)}
        onCompleted={() => navigate("/my-bookings")}
      />
    </main>
  );
}
