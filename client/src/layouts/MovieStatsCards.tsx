import { Film, PlayCircle, CalendarX, Layers } from "lucide-react";
import type { MovieApiResponse } from "../api/movieApi";
import { toDateStr } from "../api/movieApi";

type Props = {
  movies: MovieApiResponse[];
  loading?: boolean;
};

function hasFutureShowtime(movie: MovieApiResponse): boolean {
  if (!movie.showTimes?.length) return false;
  const today = new Date().toISOString().split("T")[0];
  return movie.showTimes.some((st) => toDateStr(st.showDate) >= today);
}

export function MovieStatsCards({ movies, loading }: Props) {
  const total = movies.length;
  const showing = movies.filter(hasFutureShowtime).length;
  const noUpcoming = total - showing;
  const genreSet = new Set(movies.flatMap((m) => m.movieType ?? []));

  const stats = [
    {
      label: "Total Movies",
      value: loading ? "—" : String(total),
      sub: "in catalog",
      icon: Film,
      color: "blue",
    },
    {
      label: "Now Showing",
      value: loading ? "—" : String(showing),
      sub: "with upcoming showtimes",
      icon: PlayCircle,
      color: "emerald",
    },
    {
      label: "No Upcoming",
      value: loading ? "—" : String(noUpcoming),
      sub: "no scheduled showtimes",
      icon: CalendarX,
      color: "rose",
    },
    {
      label: "Genres",
      value: loading ? "—" : String(genreSet.size),
      sub: "distinct genres",
      icon: Layers,
      color: "violet",
    },
  ];

  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue:   { bg: "bg-blue-50",   icon: "text-blue-600"   },
    emerald:{ bg: "bg-emerald-50",icon: "text-emerald-600"},
    rose:   { bg: "bg-rose-50",   icon: "text-rose-500"   },
    violet: { bg: "bg-violet-50", icon: "text-violet-600" },
  };

  return (
    <div className="grid grid-cols-4 gap-5 mb-6">
      {stats.map(({ label, value, sub, icon: Icon, color }) => {
        const c = colorMap[color];
        return (
          <div
            key={label}
            className="rounded-2xl border p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>{label}</p>
                <p style={{ fontSize: "26px", fontWeight: 700, lineHeight: 1.1, color: "var(--text-main)", marginTop: "4px" }}>
                  {value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                <Icon size={18} className={c.icon} />
              </div>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>{sub}</p>
          </div>
        );
      })}
    </div>
  );
}
