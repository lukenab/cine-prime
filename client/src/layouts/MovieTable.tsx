import { useState } from "react";
import { Pencil, Trash2, ChevronLeft, ChevronRight, MoreHorizontal, Clapperboard, Clock } from "lucide-react";
import type { MovieData } from "./MovieModal";

type Props = {
  movies: MovieData[];
  onEdit: (movie: MovieData) => void;
  onDelete: (id: number) => void;
  searchQuery: string;
  genreFilter: string;
  statusFilter: string;
};

const ITEMS_PER_PAGE = 8;

const genreColors: Record<string, string> = {
  Action: "bg-rose-50 text-rose-700 border-rose-100",
  Comedy: "bg-amber-50 text-amber-700 border-amber-100",
  Drama: "bg-blue-50 text-blue-700 border-blue-100",
  "Sci-Fi": "bg-purple-50 text-purple-700 border-purple-100",
  Horror: "bg-gray-100 text-gray-700 border-gray-200",
  Romance: "bg-pink-50 text-pink-700 border-pink-100",
};

export function MovieTable({ movies, onEdit, onDelete, searchQuery, genreFilter, statusFilter }: Props) {
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const filtered = movies.filter((m) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || m.title.toLowerCase().includes(q) || m.director.toLowerCase().includes(q);
    const matchGenre = !genreFilter || m.genre === genreFilter;
    const matchStatus = !statusFilter || m.status === statusFilter;
    return matchSearch && matchGenre && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageMovies = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleDelete = (id: number) => {
    if (deleteConfirm === id) {
      onDelete(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
    }
  };

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
              <th className="px-5 py-3.5 text-left"><span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Movie Info</span></th>
              <th className="px-5 py-3.5 text-left"><span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Genre</span></th>
              <th className="px-5 py-3.5 text-left"><span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Format</span></th>
              <th className="px-5 py-3.5 text-left"><span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Status</span></th>
              <th className="px-5 py-3.5 text-left"><span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Release Date</span></th>
              <th className="px-5 py-3.5 text-right"><span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Actions</span></th>
            </tr>
          </thead>

          <tbody style={{ borderColor: "var(--border-color)" }}>
            {pageMovies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                  No movies found matching your filters.
                </td>
              </tr>
            ) : (
              pageMovies.map((movie) => (
                <tr key={movie.id} className="hover-row transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-12 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: movie.posterColor }}>
                        <Clapperboard size={16} color="rgba(255,255,255,0.8)" />
                      </div>
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>{movie.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>Dir: {movie.director}</p>
                          <span style={{ color: "var(--border-color)" }}>•</span>
                          <div className="flex items-center gap-1" style={{ color: "var(--text-sub)" }}>
                            <Clock size={10} />
                            <span style={{ fontSize: "11px" }}>{movie.duration}m</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-xs font-medium ${genreColors[movie.genre] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {movie.genre}
                    </span>
                  </td>

                  <td className="px-5 py-3.5">
                    <span style={{ fontSize: "13px", color: "var(--text-sub)", fontWeight: 500 }}>{movie.format}</span>
                  </td>

                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        movie.status === "Showing" ? "bg-emerald-50 text-emerald-700" :
                        movie.status === "Coming Soon" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                          movie.status === "Showing" ? "bg-emerald-500" :
                          movie.status === "Coming Soon" ? "bg-blue-500" : "bg-gray-400"
                        }`}
                      />
                      {movie.status}
                    </span>
                  </td>

                  <td className="px-5 py-3.5">
                    <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{movie.releaseDate}</span>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 relative">
                      <button onClick={() => onEdit(movie)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors action-btn" style={{ color: "var(--text-sub)" }}>
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(movie.id)}
                        title={deleteConfirm === movie.id ? "Click again to confirm" : "Delete"}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          deleteConfirm === movie.id ? "bg-rose-100 text-rose-600" : "action-btn text-rose-400 hover:text-rose-500"
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                      <button onClick={() => setOpenMenu(openMenu === movie.id ? null : movie.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors action-btn" style={{ color: "var(--text-sub)" }}>
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
        <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
          Showing <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</span> of <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> movies
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn" style={{ color: "var(--text-sub)" }}>
            <ChevronLeft size={15} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => Math.abs(p - safePage) <= 2).map((p) => (
            <button
              key={p} onClick={() => setPage(p)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{
                fontSize: "13px",
                fontWeight: p === safePage ? 600 : 400,
                background: p === safePage ? "#2563eb" : "transparent",
                color: p === safePage ? "#fff" : "var(--text-sub)"
              }}
            >
              {p}
            </button>
          ))}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed action-btn" style={{ color: "var(--text-sub)" }}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}