import { CalendarDays, Clock, Film, Tag, UserRound, X } from "lucide-react";
import type { MovieApiResponse } from "../api/movieApi";
import { formatDisplayDate, toDateStr } from "../api/movieApi";

type Props = {
  open: boolean;
  movie: MovieApiResponse | null;
  onClose: () => void;
};

function formatTime(value: string | number[] | undefined): string {
  if (!value) return "-";
  if (Array.isArray(value)) {
    const [, , , h = 0, m = 0] = value;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return String(value).substring(0, 5);
}

export function MovieDetailModal({ open, movie, onClose }: Props) {
  if (!open || !movie) return null;

  const fieldLabel: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-sub)",
  };

  const fieldValue: React.CSSProperties = {
    fontSize: "14px",
    color: "var(--text-main)",
    marginTop: "4px",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative w-full max-w-4xl mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-main)", maxHeight: "90vh" }}
      >
        <div
          className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Film size={16} className="text-blue-600" />
            </div>
            <div>
              <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
                Movie Detail
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "2px" }}>
                #{movie.movieId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            style={{ color: "var(--text-sub)" }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
            <div>
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
              >
                {movie.largeImage || movie.smallImage ? (
                  <img
                    src={movie.largeImage || movie.smallImage}
                    alt={movie.movieNameEnglish}
                    className="w-full aspect-[2/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] flex items-center justify-center text-blue-600 bg-blue-50">
                    <Film size={42} />
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(movie.movieType ?? []).map((genre) => (
                  <span
                    key={genre}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium"
                    style={{
                      background: "var(--bg-card)",
                      color: "var(--text-main)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <Tag size={11} />
                    {genre}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-main)" }}>
                  {movie.movieNameEnglish}
                </h3>
                <p style={{ fontSize: "15px", color: "var(--text-sub)", marginTop: "4px" }}>
                  {movie.movieNameVn}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p style={fieldLabel}>Director</p>
                  <p style={fieldValue}>{movie.director || "-"}</p>
                </div>
                <div>
                  <p style={fieldLabel}>Actors</p>
                  <p style={fieldValue}>{movie.actor || "-"}</p>
                </div>
                <div>
                  <p style={fieldLabel}>Duration</p>
                  <p style={fieldValue}>{movie.duration ? `${movie.duration} minutes` : "-"}</p>
                </div>
                <div>
                  <p style={fieldLabel}>Format</p>
                  <p style={fieldValue}>{movie.version || "-"}</p>
                </div>
                <div>
                  <p style={fieldLabel}>Production Company</p>
                  <p style={fieldValue}>{movie.movieProductionCompany || "-"}</p>
                </div>
                <div>
                  <p style={fieldLabel}>Status</p>
                  <p style={fieldValue}>{movie.status ? "Active" : "Inactive"}</p>
                </div>
              </div>

              <div>
                <p style={fieldLabel}>Synopsis</p>
                <p style={{ ...fieldValue, lineHeight: 1.7 }}>{movie.content || "-"}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays size={15} style={{ color: "var(--text-sub)" }} />
                  <p style={fieldLabel}>Showtimes</p>
                </div>

                {movie.showTimes?.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {movie.showTimes.map((showtime) => (
                      <div
                        key={showtime.showTimeId}
                        className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
                      >
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                            {toDateStr(showtime.showDate)}
                          </p>
                          <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "2px" }}>
                            Showtime #{showtime.showTimeId}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5" style={{ color: "var(--text-sub)" }}>
                          <Clock size={13} />
                          <span style={{ fontSize: "13px" }}>
                            {formatTime(showtime.startTime)} - {formatTime(showtime.endTime)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>No showtimes available.</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="flex items-center gap-2" style={{ color: "var(--text-sub)" }}>
                  <UserRound size={14} />
                  <span style={{ fontSize: "13px" }}>Added {formatDisplayDate(movie.createAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
