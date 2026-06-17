import { X, CalendarClock } from "lucide-react";
import { useState, useEffect } from "react";

export type ShowtimeData = {
  id: number;
  movieName: string;
  roomName: string;
  showDate: string;
  startTime: string;
  endTime: string;
  status: "Upcoming" | "Showing" | "Completed";
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (showtime: Omit<ShowtimeData, "id" | "endTime" | "status">) => void;
  editShowtime?: ShowtimeData | null;
};

// Mock data cho dropdown
const mockMovies = ["Dune: Part Two", "Deadpool & Wolverine", "Inside Out 2", "Furiosa"];
const mockRooms = ["Cinema 1 (IMAX)", "Cinema 2 (3D)", "Cinema 3 (Standard)", "Cinema 4 (Standard)"];

export function ShowtimeModal({ open, onClose, onSave, editShowtime }: Props) {
  const [form, setForm] = useState({
    movieName: mockMovies[0],
    roomName: mockRooms[0],
    showDate: "",
    startTime: "",
  });

  useEffect(() => {
    if (editShowtime) {
      setForm({
        movieName: editShowtime.movieName,
        roomName: editShowtime.roomName,
        showDate: editShowtime.showDate,
        startTime: editShowtime.startTime,
      });
    } else {
      setForm({ movieName: mockMovies[0], roomName: mockRooms[0], showDate: "", startTime: "" });
    }
  }, [editShowtime, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" style={{ background: "var(--bg-main)" }}>
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

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Select Movie</label>
            <select
              value={form.movieName} onChange={(e) => setForm({ ...form, movieName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
              style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            >
              {mockMovies.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Cinema Room</label>
            <select
              value={form.roomName} onChange={(e) => setForm({ ...form, roomName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
              style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            >
              {mockRooms.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Show Date</label>
              <input
                type="date" required value={form.showDate} onChange={(e) => setForm({ ...form, showDate: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
                style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
                // Custom CSS để đổi icon date picker màu trắng trong dark mode
                style={Object.assign({ colorScheme: "var(--color-scheme)" }, { fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" })}
              />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Start Time</label>
              <input
                type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
                style={Object.assign({ colorScheme: "var(--color-scheme)" }, { fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80" style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}>
              Cancel
            </button>
            <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors" style={{ fontSize: "14px", fontWeight: 500 }}>
              {editShowtime ? "Update Schedule" : "Schedule Movie"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}