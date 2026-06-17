import { X, Film } from "lucide-react";
import { useState, useEffect } from "react";

export type MovieData = {
  id: number;
  title: string;
  director: string;
  genre: string;
  status: "Showing" | "Coming Soon" | "Stopped";
  format: string;
  duration: number;
  releaseDate: string;
  posterColor: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (movie: Omit<MovieData, "id" | "releaseDate" | "posterColor">) => void;
  editMovie?: MovieData | null;
};

const genres = ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Romance", "Animation"];
const formats = ["2D Standard", "3D", "IMAX", "4DX"];

export function MovieModal({ open, onClose, onSave, editMovie }: Props) {
  const [form, setForm] = useState({
    title: "",
    director: "",
    genre: "Action",
    status: "Showing" as "Showing" | "Coming Soon" | "Stopped",
    format: "2D Standard",
    duration: 120,
  });

  useEffect(() => {
    if (editMovie) {
      setForm({
        title: editMovie.title,
        director: editMovie.director,
        genre: editMovie.genre,
        status: editMovie.status,
        format: editMovie.format,
        duration: editMovie.duration,
      });
    } else {
      setForm({ title: "", director: "", genre: "Action", status: "Coming Soon", format: "2D Standard", duration: 120 });
    }
  }, [editMovie, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" style={{ background: "var(--bg-main)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Film size={16} className="text-blue-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {editMovie ? "Edit Movie" : "Add New Movie"}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors" style={{ color: "var(--text-sub)" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Movie Title</label>
            <input
              type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Inception"
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
              style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Director</label>
              <input
                type="text" required value={form.director} onChange={(e) => setForm({ ...form, director: e.target.value })}
                placeholder="e.g. C. Nolan"
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
                style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              />
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Duration (mins)</label>
              <input
                type="number" required min="1" value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors"
                style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Genre</label>
              <select
                value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors appearance-none cursor-pointer"
                style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              >
                {genres.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Format</label>
              <select
                value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors appearance-none cursor-pointer"
                style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              >
                {formats.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>Status</label>
            <select
              value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors appearance-none cursor-pointer"
              style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            >
              <option value="Showing">Showing</option>
              <option value="Coming Soon">Coming Soon</option>
              <option value="Stopped">Stopped</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80"
              style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              {editMovie ? "Save Changes" : "Add Movie"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}