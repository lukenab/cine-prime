import { X, CalendarClock, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import {
  showtimeApi,
  ShowtimeResponse,
  CinemaResponse,
  MovieDropdownResponse,
  RoomDropdownResponse,
  ShowtimeStatus
} from "../api/showtimeApi";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
  editShowtime?: ShowtimeResponse | null;
  cinemas: CinemaResponse[];
};

const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export function ShowtimeModal({ open, onClose, onSave, editShowtime, cinemas }: Props) {
  const [movies, setMovies] = useState<MovieDropdownResponse[]>([]);
  const [rooms, setRooms] = useState<RoomDropdownResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    movieId: 0,
    cinemaId: 0,
    cinemaRoomId: 0,
    showDate: "",
    startTime: "",
    endTime: "",
    basePrice: 90000,
    status: "SCHEDULED" as ShowtimeStatus
  });

  // Fetch movies for dropdown
  useEffect(() => {
    if (open) {
      showtimeApi.getMovies()
        .then((res) => setMovies(res.result ?? []))
        .catch(() => {});
    }
  }, [open]);

  // Fetch rooms dynamically when cinemaId changes
  useEffect(() => {
    if (form.cinemaId) {
      showtimeApi.getRooms(form.cinemaId)
        .then((res) => {
          const roomList = res.result ?? [];
          setRooms(roomList);
          
          // Select first room if current room is not in the list
          const roomIds = roomList.map((r) => r.cinemaRoomId);
          if (!roomIds.includes(form.cinemaRoomId)) {
            setForm((f) => ({ ...f, cinemaRoomId: roomList[0]?.cinemaRoomId ?? 0 }));
          }
        })
        .catch(() => {});
    } else {
      setRooms([]);
      setForm((f) => ({ ...f, cinemaRoomId: 0 }));
    }
  }, [form.cinemaId]);

  // Set form values on edit or create
  useEffect(() => {
    if (editShowtime) {
      setForm({
        movieId: editShowtime.movieId,
        cinemaId: editShowtime.cinemaId,
        cinemaRoomId: editShowtime.cinemaRoomId,
        showDate: editShowtime.showDate,
        startTime: editShowtime.startTime,
        endTime: editShowtime.endTime,
        basePrice: editShowtime.basePrice,
        status: editShowtime.status
      });
    } else {
      setForm({
        movieId: movies[0]?.movieId ?? 0,
        cinemaId: cinemas[0]?.cinemaId ?? 0,
        cinemaRoomId: 0,
        showDate: "",
        startTime: "",
        endTime: "",
        basePrice: 90000,
        status: "SCHEDULED"
      });
    }
    setErrorMsg(null);
  }, [editShowtime, open, movies, cinemas]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Form validations
    if (!form.movieId || !form.cinemaId || !form.cinemaRoomId || !form.showDate || !form.startTime || !form.endTime || !form.basePrice) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    const start = timeToMinutes(form.startTime);
    const end = timeToMinutes(form.endTime);
    if (start >= end) {
      setErrorMsg("Start time must be before end time.");
      return;
    }

    if (form.basePrice <= 0) {
      setErrorMsg("Base price must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        movieId: Number(form.movieId),
        cinemaRoomId: Number(form.cinemaRoomId),
        showDate: form.showDate,
        startTime: form.startTime,
        endTime: form.endTime,
        basePrice: Number(form.basePrice),
        ...(editShowtime ? { status: form.status } : {})
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message ?? "An error occurred while saving showtime.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" style={{ background: "var(--bg-main)" }}>
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
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors" style={{ color: "var(--text-sub)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl border border-rose-200 bg-rose-50 flex items-start gap-2 text-rose-600">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <p style={{ fontSize: "13px" }}>{errorMsg}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Select Movie */}
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Select Movie</label>
            <select
              value={form.movieId} onChange={(e) => setForm({ ...form, movieId: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer font-medium"
              style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            >
              <option value={0} disabled>Choose a Movie...</option>
              {movies.map((m) => (
                <option key={m.movieId} value={m.movieId}>
                  {m.movieNameEnglish} ({m.duration}m)
                </option>
              ))}
            </select>
          </div>

          {/* Grid: Cinema & Room */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Cinema</label>
              <select
                value={form.cinemaId} onChange={(e) => setForm({ ...form, cinemaId: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
                style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              >
                <option value={0} disabled>Choose Cinema...</option>
                {cinemas.map((c) => (
                  <option key={c.cinemaId} value={c.cinemaId}>{c.cinemaName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Cinema Room</label>
              <select
                value={form.cinemaRoomId} onChange={(e) => setForm({ ...form, cinemaRoomId: Number(e.target.value) })}
                disabled={!form.cinemaId}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer disabled:opacity-50"
                style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              >
                <option value={0} disabled>Choose Room...</option>
                {rooms.map((r) => (
                  <option key={r.cinemaRoomId} value={r.cinemaRoomId}>{r.cinemaRoomName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Grid: Show Date */}
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Show Date</label>
            <input
              type="date" required value={form.showDate} onChange={(e) => setForm({ ...form, showDate: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
              style={Object.assign({ colorScheme: "var(--color-scheme)" }, { fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" })}
            />
          </div>

          {/* Grid: Start/End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Start Time</label>
              <input
                type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
                style={Object.assign({ colorScheme: "var(--color-scheme)" }, { fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" })}
              />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>End Time</label>
              <input
                type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
                style={Object.assign({ colorScheme: "var(--color-scheme)" }, { fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" })}
              />
            </div>
          </div>

          {/* Grid: Base Price & Status (if editing) */}
          <div className={editShowtime ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Base Price (VND)</label>
              <input
                type="number" required min={0} value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
                style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              />
            </div>

            {editShowtime && (
              <div>
                <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Status</label>
                <select
                  value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ShowtimeStatus })}
                  className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
                  style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
                >
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="ONGOING">Ongoing</option>
                  <option value="FINISHED">Finished</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button" onClick={onClose} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)", background: "transparent" }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              {submitting ? "Saving..." : editShowtime ? "Update Schedule" : "Schedule Movie"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}