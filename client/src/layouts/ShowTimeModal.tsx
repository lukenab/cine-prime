import { X, CalendarClock, AlertCircle } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  type ShowtimeResponse,
  type ShowtimeAssignPayload,
  type ShowtimeUpdatePayload,
  type ShowtimeStatus,
} from "../api/showtimeApi";
import { getMockMovies, getMockCinemas, getMockRooms } from "../api/mockShowtime";

type FormState = {
  movieId: number;
  cinemaId: number;
  cinemaRoomId: number;
  showDate: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  status: ShowtimeStatus;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: ShowtimeAssignPayload | ShowtimeUpdatePayload) => Promise<void>;
  editShowtime?: ShowtimeResponse | null;
};

const timeToMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export function ShowtimeModal({ open, onClose, onSave, editShowtime }: Props) {
  const movies  = useMemo(() => getMockMovies(),  []);
  const cinemas = useMemo(() => getMockCinemas(), []);
  const allRooms = useMemo(() => getMockRooms(),  []);

  const [form, setForm] = useState<FormState>({
    movieId: movies[0]?.movieId ?? 0,
    cinemaId: cinemas[0]?.cinemaId ?? 0,
    cinemaRoomId: 0,
    showDate: "",
    startTime: "",
    endTime: "",
    basePrice: 90000,
    status: "SCHEDULED",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);

  const rooms = useMemo(
    () => allRooms.filter(r => r.cinemaId === form.cinemaId),
    [allRooms, form.cinemaId]
  );

  // Populate form when opening
  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (editShowtime) {
      setForm({
        movieId:      editShowtime.movieId,
        cinemaId:     editShowtime.cinemaId,
        cinemaRoomId: editShowtime.cinemaRoomId,
        showDate:     editShowtime.showDate,
        startTime:    editShowtime.startTime,
        endTime:      editShowtime.endTime,
        basePrice:    editShowtime.basePrice,
        status:       editShowtime.status,
      });
    } else {
      const defaultCinema = cinemas[0]?.cinemaId ?? 0;
      const defaultRoom   = allRooms.find(r => r.cinemaId === defaultCinema)?.cinemaRoomId ?? 0;
      setForm({
        movieId: movies[0]?.movieId ?? 0,
        cinemaId: defaultCinema,
        cinemaRoomId: defaultRoom,
        showDate: "",
        startTime: "",
        endTime: "",
        basePrice: 90000,
        status: "SCHEDULED",
      });
    }
  }, [open, editShowtime, movies, cinemas, allRooms]);

  // Auto-select first room when cinema changes
  useEffect(() => {
    const firstRoom = allRooms.find(r => r.cinemaId === form.cinemaId)?.cinemaRoomId ?? 0;
    setForm(f => {
      const roomStillValid = allRooms.some(r => r.cinemaId === f.cinemaId && r.cinemaRoomId === f.cinemaRoomId);
      return roomStillValid ? f : { ...f, cinemaRoomId: firstRoom };
    });
  }, [form.cinemaId, allRooms]);

  if (!open) return null;

  const set = (field: keyof FormState, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.movieId || !form.cinemaId || !form.cinemaRoomId || !form.showDate || !form.startTime || !form.endTime) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }
    if (timeToMinutes(form.startTime) >= timeToMinutes(form.endTime)) {
      setErrorMsg("Start time must be before end time.");
      return;
    }
    if (form.basePrice <= 0) {
      setErrorMsg("Base price must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = editShowtime
        ? ({
            movieId: form.movieId,
            cinemaRoomId: form.cinemaRoomId,
            showDate: form.showDate,
            startTime: form.startTime,
            endTime: form.endTime,
            basePrice: form.basePrice,
            status: form.status,
          } as ShowtimeUpdatePayload)
        : ({
            movieId: form.movieId,
            cinemaRoomId: form.cinemaRoomId,
            showDate: form.showDate,
            startTime: form.startTime,
            endTime: form.endTime,
            basePrice: form.basePrice,
          } as ShowtimeAssignPayload);

      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        (err as { message?: string })?.message ?? "An error occurred while saving."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    colorScheme: "var(--color-scheme)" as string,
    fontSize: "14px",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    borderColor: "var(--border-color)",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ background: "var(--bg-main)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <CalendarClock size={16} className="text-purple-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {editShowtime ? "Edit Showtime" : "Schedule New Showtime"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            style={{ color: "var(--text-sub)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl border border-rose-200 bg-rose-50 flex items-start gap-2 text-rose-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p style={{ fontSize: "13px" }}>{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Movie */}
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Movie <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.movieId}
              onChange={e => set("movieId", Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
              style={inputStyle}
            >
              <option value={0} disabled>Choose a movie…</option>
              {movies.map(m => (
                <option key={m.movieId} value={m.movieId} style={{ background: "var(--bg-card)" }}>
                  {m.movieNameEnglish} ({m.duration}m)
                </option>
              ))}
            </select>
          </div>

          {/* Cinema → Room cascade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Cinema <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.cinemaId}
                onChange={e => set("cinemaId", Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
                style={inputStyle}
              >
                <option value={0} disabled>Choose cinema…</option>
                {cinemas.map(c => (
                  <option key={c.cinemaId} value={c.cinemaId} style={{ background: "var(--bg-card)" }}>
                    {c.cinemaName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Room <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.cinemaRoomId}
                disabled={!form.cinemaId}
                onChange={e => set("cinemaRoomId", Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer disabled:opacity-50"
                style={inputStyle}
              >
                <option value={0} disabled>Choose room…</option>
                {rooms.map(r => (
                  <option key={r.cinemaRoomId} value={r.cinemaRoomId} style={{ background: "var(--bg-card)" }}>
                    {r.cinemaRoomName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Show Date */}
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Show Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.showDate}
              onChange={e => set("showDate", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
              style={inputStyle}
            />
          </div>

          {/* Start / End Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={e => set("startTime", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                required
                value={form.endTime}
                onChange={e => set("endTime", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Base Price + Status (on edit) */}
          <div className={editShowtime ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Base Price (VND) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min={1000}
                step={1000}
                value={form.basePrice}
                onChange={e => set("basePrice", Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
                style={inputStyle}
              />
            </div>
            {editShowtime && (
              <div>
                <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Status</label>
                <select
                  value={form.status}
                  onChange={e => set("status", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
                  style={inputStyle}
                >
                  <option value="SCHEDULED"  style={{ background: "var(--bg-card)" }}>Scheduled</option>
                  <option value="ONGOING"    style={{ background: "var(--bg-card)" }}>Ongoing</option>
                  <option value="FINISHED"   style={{ background: "var(--bg-card)" }}>Finished</option>
                  <option value="CANCELLED"  style={{ background: "var(--bg-card)" }}>Cancelled</option>
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)", background: "transparent" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              {submitting ? "Saving…" : editShowtime ? "Update Schedule" : "Schedule Movie"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
