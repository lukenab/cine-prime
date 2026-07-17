import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Copy, Plus, X } from "lucide-react";
import type { RoomResponse } from "../../../api/movieApi";

type Props = {
  rooms: RoomResponse[];
  onCreateNew: () => void;
  onDuplicate: (sourceRoomId: number) => void;
  onClose: () => void;
};

export function RoomCreationMethodDialog({ rooms, onCreateNew, onDuplicate, onClose }: Props) {
  const [method, setMethod] = useState<"NEW" | "DUPLICATE">("NEW");
  const [sourceRoomId, setSourceRoomId] = useState("");
  // Admin theme tokens are scoped to AdminLayout's root. Portaling into body
  // loses those variables and forces the dialog to its white fallback.
  const portalRoot = document.querySelector<HTMLElement>(".theme-dark, .theme-light") ?? document.body;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 1000, background: "var(--modal-backdrop, rgba(2,6,23,0.58))", backdropFilter: "blur(3px) saturate(0.85)" }}
      onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="room-creation-title"
        className="w-full max-w-xl rounded-2xl p-5"
        style={{
          background: "linear-gradient(155deg, var(--modal-surface-highlight, #f8fafc) 0%, var(--modal-surface, #fff) 42%)",
          color: "var(--text-main)",
          border: "1px solid var(--modal-border, rgba(0,0,0,0.12))",
          boxShadow: "0 24px 70px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
        onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="room-creation-title" style={{ fontSize: "17px", fontWeight: 750, color: "var(--text-main)" }}>How would you like to create this room?</h2>
            <p style={{ fontSize: "12px", color: "var(--modal-text-sub, var(--text-sub))", marginTop: "3px" }}>Start from a template or reuse an existing room configuration.</p>
          </div>
          <button type="button" aria-label="Close room creation options" onClick={onClose} className="p-2 rounded-lg hover:opacity-70" style={{ color: "var(--text-main)", background: "transparent" }}><X size={17} /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <button type="button" onClick={() => setMethod("NEW")} className="p-4 rounded-xl border text-left transition-colors"
            style={{ borderColor: method === "NEW" ? "#3b82f6" : "var(--modal-border)", background: method === "NEW" ? "rgba(37,99,235,0.13)" : "var(--modal-option)" }}>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: "rgba(37,99,235,0.12)", color: "#2563eb" }}><Plus size={18} /></span>
            <strong style={{ display: "block", fontSize: "13px", color: "var(--text-main)" }}>Create new room</strong>
            <span style={{ display: "block", fontSize: "11px", color: "var(--modal-text-sub, var(--text-sub))", lineHeight: 1.45, marginTop: "4px" }}>Use a Standard, Premium Laser or Luxury Atmos quick-start template.</span>
          </button>

          <button type="button" disabled={rooms.length === 0} onClick={() => setMethod("DUPLICATE")} className="p-4 rounded-xl border text-left transition-colors disabled:opacity-45"
            style={{ borderColor: method === "DUPLICATE" ? "#8b5cf6" : "var(--modal-border)", background: method === "DUPLICATE" ? "rgba(124,58,237,0.13)" : "var(--modal-option)" }}>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}><Copy size={17} /></span>
            <strong style={{ display: "block", fontSize: "13px", color: "var(--text-main)" }}>Duplicate existing room</strong>
            <span style={{ display: "block", fontSize: "11px", color: "var(--modal-text-sub, var(--text-sub))", lineHeight: 1.45, marginTop: "4px" }}>{rooms.length > 0 ? "Copy technical settings and the active seat layout." : "No existing room is available to duplicate."}</span>
          </button>
        </div>

        {method === "DUPLICATE" && rooms.length > 0 && (
          <label className="block mt-4">
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-main)" }}>Source room</span>
            <select autoFocus value={sourceRoomId} onChange={(event) => setSourceRoomId(event.target.value)}
              className="cinema-select w-full h-10 px-3 mt-1 rounded-xl border"
              style={{ fontSize: "12px", background: "var(--modal-option)", color: "var(--text-main)", borderColor: "var(--modal-border)" }}>
              <option value="">Select a room to duplicate…</option>
              {rooms.map((room) => <option key={room.cinemaRoomId} value={room.cinemaRoomId}>{room.cinemaRoomName}{room.roomCode ? ` (${room.roomCode})` : ""}</option>)}
            </select>
            <span style={{ display: "block", fontSize: "10.5px", color: "var(--modal-text-sub, var(--text-sub))", marginTop: "5px" }}>Room identity and physical/screen dimensions remain blank and must match the new auditorium.</span>
          </label>
        )}

        <div className="flex justify-end gap-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--modal-border)" }}>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border" style={{ fontSize: "12px", color: "var(--text-main)", borderColor: "var(--modal-border)", background: "var(--modal-option)" }}>Cancel</button>
          <button type="button" disabled={method === "DUPLICATE" && !sourceRoomId}
            onClick={() => method === "NEW" ? onCreateNew() : onDuplicate(Number(sourceRoomId))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white disabled:opacity-40"
            style={{ fontSize: "12px", fontWeight: 700, background: method === "NEW" ? "#2563eb" : "#7c3aed" }}>
            Continue <ArrowRight size={14} />
          </button>
        </div>
      </section>
    </div>,
    portalRoot,
  );
}
