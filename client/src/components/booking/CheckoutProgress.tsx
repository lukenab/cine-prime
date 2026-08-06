import { Check } from "lucide-react";

// Shared across SeatBookingPage, ConcessionSelectionPage and
// BookingCheckoutPage so the customer sees one continuous flow instead of
// three pages that each drew their own (previously inconsistent) stepper.
export const CHECKOUT_STEPS = ["Movie & showtime", "Seats", "Food", "Payment", "Confirmation"] as const;

// Matches the cosmic gradient used for the active date tab / CTA buttons
// elsewhere in the booking flow, so "done"/"active" steps read as the same
// system as the rest of the page instead of a flat, unrelated blue.
const COSMIC_GRADIENT = "linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)";

export default function CheckoutProgress({ currentStep }: { currentStep: number }) {
  return (
    <nav
      aria-label="Booking progress"
      className="mb-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur"
      style={{ backgroundImage: "radial-gradient(50% 160% at 4% 0%, rgba(37,99,235,.1), transparent 65%)" }}
    >
      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-blue-300">
        {currentStep + 1}/{CHECKOUT_STEPS.length}
      </span>
      <div className="flex flex-1 items-center">
        {CHECKOUT_STEPS.map((step, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          const isLast = index === CHECKOUT_STEPS.length - 1;
          return (
            <div key={step} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
              <div className="flex shrink-0 items-center gap-2">
                <div
                  aria-current={active ? "step" : undefined}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                    done
                      ? "text-white"
                      : active
                        ? "text-white shadow-[0_0_0_4px_rgba(37,99,235,0.22)]"
                        : "bg-white/[0.08] text-white/35"
                  }`}
                  style={done || active ? { background: COSMIC_GRADIENT } : undefined}
                >
                  {done ? <Check size={12} /> : index + 1}
                </div>
                <span
                  className={`hidden whitespace-nowrap text-[11.5px] font-medium sm:block ${
                    active ? "text-white" : done ? "text-white/50" : "text-white/25"
                  }`}
                >
                  {step}
                </span>
              </div>
              {!isLast && (
                <div
                  aria-hidden="true"
                  className="mx-2 h-[2px] flex-1 rounded-full bg-white/10 transition-colors"
                  style={done ? { background: COSMIC_GRADIENT } : undefined}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
