import { useEffect, useRef } from "react";
import { notify } from "../../lib/notifications";

export type ToastType = "success" | "error";

/** Compatibility adapter while legacy pages migrate away from local toast state. */
export function Toast({ type, message, onClose }: { type: ToastType; message: string; onClose: () => void }) {
  const emittedRef = useRef(false);

  useEffect(() => {
    // React StrictMode intentionally re-runs effects in development. Guard the
    // compatibility adapter so one state change produces one notification.
    if (emittedRef.current) return;
    emittedRef.current = true;

    if (type === "success") notify.success(message);
    else notify.error(message);
    onClose();
  }, [message, onClose, type]);

  return null;
}
