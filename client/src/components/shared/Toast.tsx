import { useEffect } from "react";
import { notify } from "../../lib/notifications";

export type ToastType = "success" | "error";

/** Compatibility adapter while legacy pages migrate away from local toast state. */
export function Toast({ type, message, onClose }: { type: ToastType; message: string; onClose: () => void }) {
  useEffect(() => {
    if (type === "success") notify.success(message);
    else notify.error(message);
    onClose();
  }, [message, onClose, type]);

  return null;
}
