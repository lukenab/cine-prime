import { Check } from "lucide-react";

// Shared across SeatBookingPage, ConcessionSelectionPage and
// BookingCheckoutPage so the customer sees one continuous flow instead of
// three pages that each drew their own (previously inconsistent) stepper.
export const CHECKOUT_STEPS = ["Movie & showtime", "Seats", "Food", "Payment", "Confirmation"] as const;

export default function CheckoutProgress({ currentStep }: { currentStep: number }) {
  return (
    <nav
      aria-label="Booking progress"
      className="mb-6 flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 backdrop-blur"
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
              <div className="flex shrink-0 items-center gap-1.5">
                <div
                  aria-current={active ? "step" : undefined}
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-all duration-300 ${
                    done
                      ? "bg-blue-500 text-white"
                      : active
                        ? "bg-blue-500 text-white shadow-[0_0_0_3px_rgba(59,130,246,0.25)]"
                        : "bg-white/[0.08] text-white/35"
                  }`}
                >
                  {done ? <Check size={11} /> : index + 1}
                </div>
                <span
                  className={`hidden whitespace-nowrap text-[11px] font-medium sm:block ${
                    active ? "text-white" : done ? "text-white/50" : "text-white/25"
                  }`}
                >
                  {step}
                </span>
              </div>
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={`mx-2 h-px flex-1 rounded-full transition-colors ${done ? "bg-blue-500/60" : "bg-white/10"}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
