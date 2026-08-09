import { CircleCheck, Clock3, Film, TriangleAlert } from "lucide-react";
import type {
  MovieApiResponse,
  MovieScreeningVersionCatalogResponse,
} from "../api/movieApi";
import { toMovieContentStatus } from "../utils/movieContentStatus";

type Props = {
  movies: MovieApiResponse[];
  screeningVersions: MovieScreeningVersionCatalogResponse[] | null;
  loading?: boolean;
};

export function MovieStatsCards({ movies, screeningVersions, loading }: Props) {
  const activeCatalog = movies.filter(
    (movie) => toMovieContentStatus(movie.movieStatus) !== "ARCHIVED",
  );
  const awaitingReview = activeCatalog.filter(
    (movie) => toMovieContentStatus(movie.movieStatus) === "PENDING_REVIEW",
  ).length;

  const usableVersionMovieIds = new Set(
    (screeningVersions ?? [])
      .filter(
        (version) =>
          version.status === "ACTIVE"
          && !version.requiresAttention
          && version.compatibleRoomCount > 0,
      )
      .map((version) => version.movieId),
  );

  const approvedMovies = activeCatalog.filter(
    (movie) => toMovieContentStatus(movie.movieStatus) === "APPROVED",
  );
  const readyForPlanning = approvedMovies.filter((movie) =>
    usableVersionMovieIds.has(movie.movieId),
  ).length;
  const needsAttention = activeCatalog.filter((movie) => {
    const status = toMovieContentStatus(movie.movieStatus);
    return status === "CHANGES_REQUESTED"
      || (status === "APPROVED" && !usableVersionMovieIds.has(movie.movieId));
  }).length;

  const operationalStatsUnavailable = screeningVersions === null;
  const stats = [
    {
      label: "Total Catalogue",
      value: loading ? "—" : String(activeCatalog.length),
      sub: "active catalogue titles",
      icon: Film,
      color: "blue",
    },
    {
      label: "Awaiting Review",
      value: loading ? "—" : String(awaitingReview),
      sub: "submitted for admin decision",
      icon: Clock3,
      color: "amber",
    },
    {
      label: "Ready for Planning",
      value: loading || operationalStatsUnavailable ? "—" : String(readyForPlanning),
      sub: "approved with a schedulable version",
      icon: CircleCheck,
      color: "emerald",
    },
    {
      label: "Needs Attention",
      value: loading || operationalStatsUnavailable ? "—" : String(needsAttention),
      sub: "revision or version blocker",
      icon: TriangleAlert,
      color: "rose",
    },
  ];

  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue: { bg: "bg-blue-50", icon: "text-blue-600" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600" },
    rose: { bg: "bg-rose-50", icon: "text-rose-500" },
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
