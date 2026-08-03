import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clapperboard,
  Clock3,
  Film,
  Languages,
  Workflow,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { subscribeLifecycleEvents } from "../../api/lifecycleSocket";
import { movieApi, type MovieApiResponse } from "../../api/movieApi";

const STATUS_META: Record<string, { label: string; color: string; background: string }> = {
  DRAFT: { label: "Draft", color: "#60a5fa", background: "rgba(59,130,246,.12)" },
  PENDING_REVIEW: { label: "Awaiting approval", color: "#fbbf24", background: "rgba(245,158,11,.12)" },
  APPROVED: { label: "Approved", color: "#34d399", background: "rgba(16,185,129,.12)" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "#fb7185", background: "rgba(244,63,94,.12)" },
  ARCHIVED: { label: "Archived", color: "#94a3b8", background: "rgba(148,163,184,.12)" },
};

const quickActions = [
  {
    title: "Movie catalogue",
    description: "Import movie metadata, prepare content and submit drafts for review.",
    path: "/admin/movies",
    icon: Film,
  },
  {
    title: "Release planning",
    description: "Create cluster release windows and submit plans for administrator approval.",
    path: "/admin/release-plans",
    icon: Clock3,
  },
  {
    title: "Screening versions",
    description: "Manage language, subtitle, audio and presentation packages used by schedules.",
    path: "/admin/screening-versions",
    icon: Languages,
  },
  {
    title: "Automatic scheduling",
    description: "Generate branch schedules from approved movies, release plans and constraints.",
    path: "/admin/showtimes/auto",
    icon: Clapperboard,
  },
];

export default function ProgrammingOperatorDashboardPage() {
  const navigate = useNavigate();
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await movieApi.getAllMovies();
      setMovies(response.result ?? []);
    } catch {
      setError("Could not load the programming queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribeLifecycleEvents((event) => {
    if (event.aggregateType === "MOVIE") void load();
  }), [load]);

  const counts = useMemo(() => movies.reduce<Record<string, number>>((result, movie) => {
    const status = movie.movieStatus ?? "DRAFT";
    result[status] = (result[status] ?? 0) + 1;
    return result;
  }, {}), [movies]);

  const queue = useMemo(() => movies
    .filter((movie) => movie.movieStatus !== "ARCHIVED")
    .sort((left, right) => String(right.updatedAt ?? right.createAt).localeCompare(String(left.updatedAt ?? left.createAt)))
    .slice(0, 5), [movies]);

  const statCards = [
    { label: "Working drafts", value: (counts.DRAFT ?? 0) + (counts.CHANGES_REQUESTED ?? 0), note: "Ready for operator action", icon: CircleDashed, color: "#3b82f6" },
    { label: "Awaiting admin", value: counts.PENDING_REVIEW ?? 0, note: "Submitted for review", icon: Clock3, color: "#f59e0b" },
    { label: "Approved movies", value: counts.APPROVED ?? 0, note: "Eligible for release planning", icon: CheckCircle2, color: "#10b981" },
  ];

  return (
    <div style={{ maxWidth: 1480, margin: "0 auto", color: "var(--text-main)" }}>
      <div style={{ marginBottom: 26 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#3b82f6", fontSize: 12, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase" }}>
            <Workflow size={15} /> Film programming
          </div>
          <h1 style={{ margin: "8px 0 6px", fontSize: 30, lineHeight: 1.15 }}>Programming workspace</h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 14, lineHeight: 1.6 }}>
            Prepare catalogue, release and schedule drafts. Publishing remains an administrator decision.
          </p>
        </div>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16, marginBottom: 20 }}>
        {statCards.map(({ label, value, note, icon: Icon, color }) => (
          <div key={label} style={{ minHeight: 126, padding: 20, borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-card)", display: "flex", justifyContent: "space-between", gap: 18 }}>
            <div>
              <div style={{ color: "var(--text-sub)", fontSize: 12 }}>{label}</div>
              <div style={{ fontSize: 30, fontWeight: 700, margin: "8px 0 5px" }}>{loading ? "–" : value}</div>
              <div style={{ color: "var(--text-sub)", fontSize: 11.5 }}>{note}</div>
            </div>
            <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 12, display: "grid", placeItems: "center", color, background: `${color}18` }}><Icon size={20} /></div>
          </div>
        ))}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1.45fr) minmax(340px,.8fr)", gap: 18 }}>
        <div style={{ borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-card)", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16 }}>Programming queue</h2>
              <p style={{ margin: "5px 0 0", color: "var(--text-sub)", fontSize: 12 }}>Recent content records and their approval state.</p>
            </div>
            <button type="button" onClick={() => navigate("/admin/movies")} style={{ border: 0, padding: "4px 0", background: "transparent", color: "#3b82f6", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>View catalogue <ArrowRight size={13} /></button>
          </div>
          {error ? (
            <div style={{ margin: 20, padding: 16, borderRadius: 12, color: "#fb7185", background: "rgba(244,63,94,.08)", border: "1px solid rgba(244,63,94,.18)" }}>{error}</div>
          ) : queue.length === 0 && !loading ? (
            <div style={{ padding: 54, textAlign: "center", color: "var(--text-sub)" }}>No movie records in the programming queue.</div>
          ) : (
            queue.map((movie) => {
              const status = movie.movieStatus ?? "DRAFT";
              const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
              return (
                <button key={movie.movieId} type="button" onClick={() => navigate(`/admin/movies/${movie.movieId}/edit`)} style={{ width: "100%", padding: "15px 20px", border: 0, borderBottom: "1px solid var(--border-color)", background: "transparent", color: "var(--text-main)", display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: "pointer" }}>
                  <div style={{ width: 38, height: 48, borderRadius: 8, overflow: "hidden", background: "rgba(59,130,246,.1)", flexShrink: 0 }}>
                    {movie.smallImage && <img src={movie.smallImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{movie.movieNameVn || movie.movieNameEnglish}</div>
                    <div style={{ color: "var(--text-sub)", fontSize: 11.5, marginTop: 5 }}>{movie.movieNameEnglish || `Movie #${movie.movieId}`}</div>
                  </div>
                  <span style={{ padding: "5px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, color: meta.color, background: meta.background }}>{meta.label}</span>
                  <ArrowRight size={15} color="var(--text-sub)" />
                </button>
              );
            })
          )}
        </div>

        <div style={{ borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-card)", padding: 20, alignSelf: "start" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Continue your workflow</h2>
          <p style={{ margin: "6px 0 18px", color: "var(--text-sub)", fontSize: 12, lineHeight: 1.55 }}>Each tool exposes only the actions assigned to film programming.</p>
          <div style={{ display: "grid", gap: 10 }}>
            {quickActions.map(({ title, description, path, icon: Icon }) => (
              <button key={title} type="button" onClick={() => navigate(path)} style={{ padding: 14, borderRadius: 13, border: "1px solid var(--border-color)", background: "var(--bg-main)", color: "var(--text-main)", display: "grid", gridTemplateColumns: "38px 1fr 18px", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer" }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", color: "#3b82f6", background: "rgba(59,130,246,.1)" }}><Icon size={18} /></span>
                <span><strong style={{ display: "block", fontSize: 13 }}>{title}</strong><small style={{ display: "block", color: "var(--text-sub)", lineHeight: 1.45, marginTop: 4 }}>{description}</small></span>
                <ArrowRight size={16} color="var(--text-sub)" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
