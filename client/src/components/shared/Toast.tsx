import { AlertCircle, CheckCircle2 } from "lucide-react";

export type ToastType = "success" | "error";

/** Shared bottom-right toast — extracted from the near-identical inline copies
 *  in RoomDetailPage.tsx and the cinema room editor. */
export function Toast({ type, message, onClose }: { type: ToastType; message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl"
      style={{ background: type === "success" ? "#059669" : "#ef4444", color: "#fff", minWidth: "280px" }}>
      {type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <span style={{ fontSize: "14px", fontWeight: 500 }}>{message}</span>
      <button onClick={onClose} className="ml-auto opacity-75 hover:opacity-100" style={{ fontSize: "18px", lineHeight: 1 }}>×</button>
    </div>
  );
}
