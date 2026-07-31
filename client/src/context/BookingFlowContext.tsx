import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface CancelAction {
  label: string;
  onClick: () => void;
}

interface BookingFlowContextValue {
  cancelAction: CancelAction | null;
  setCancelAction: (action: CancelAction | null) => void;
}

const BookingFlowContext = createContext<BookingFlowContextValue | null>(null);

/** Wraps the customer layout so the checkout-flow pages (Food, Payment) can
 *  hand their "Cancel booking" action up to the navbar, which switches into
 *  a locked, distraction-free mode while a booking is in progress. */
export function BookingFlowProvider({ children }: { children: ReactNode }) {
  const [cancelAction, setCancelAction] = useState<CancelAction | null>(null);
  const value = useMemo(() => ({ cancelAction, setCancelAction }), [cancelAction]);
  return <BookingFlowContext.Provider value={value}>{children}</BookingFlowContext.Provider>;
}

export function useBookingFlow() {
  const ctx = useContext(BookingFlowContext);
  if (!ctx) throw new Error("useBookingFlow must be used within a BookingFlowProvider");
  return ctx;
}

/** Registers this page's cancel action while it's mounted, and clears it on
 *  unmount/navigation so the navbar reverts to its normal state. Pass null
 *  (or omit) when the current booking can't be cancelled from this step. */
export function useBookingFlowCancelAction(label: string, onClick: (() => void) | null) {
  const { setCancelAction } = useBookingFlow();
  useEffect(() => {
    setCancelAction(onClick ? { label, onClick } : null);
    return () => setCancelAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, onClick, setCancelAction]);
}
