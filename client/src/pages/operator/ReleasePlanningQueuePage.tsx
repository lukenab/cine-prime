import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Film, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  movieApi,
  type MovieApiResponse,
  type MovieAvailabilityResponse,
} from "../../api/movieApi";

const PLAN_META: Record<string, { label: string; color: string; background: string }> = {
  PLANNED: { label: "Draft plan", color: "#60a5fa", background: "rgba(59,130,246,.12)" },
  IN_REVIEW: { label: "Awaiting approval", color: "#fbbf24", background: "rgba(245,158,11,.12)" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "#fb7185", background: "rgba(244,63,94,.12)" },
  APPROVED: { label: "Approved", color: "#34d399", background: "rgba(16,185,129,.12)" },
  OPEN: { label: "Open", color: "#22d3ee", background: "rgba(6,182,212,.12)" },
  SUSPENDED: { label: "Suspended", color: "#f97316", background: "rgba(249,115,22,.12)" },
  CLOSED: { label: "Closed", color: "#94a3b8", background: "rgba(148,163,184,.12)" },
};

export default function ReleasePlanningQueuePage() {
  const navigate = useNavigate();
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [plans, setPlans] = useState<MovieAvailabilityResponse[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [movieResponse, planResponse] = await Promise.all([
        movieApi.getAllMovies(),
        movieApi.searchAvailabilities({}),
      ]);
      setMovies(movieResponse.result ?? []);
      setPlans(planResponse.result ?? []);
    } catch {
      setError("Could not load the release planning queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const plansByMovie = useMemo(() => plans.reduce<Record<number, MovieAvailabilityResponse[]>>((result, plan) => {
    (result[plan.movieId] ??= []).push(plan);
    return result;
  }, {}), [plans]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return movies
      .filter((movie) => movie.movieStatus === "APPROVED")
      .filter((movie) => !normalizedQuery || `${movie.movieNameVn} ${movie.movieNameEnglish}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => (plansByMovie[right.movieId]?.length ?? 0) - (plansByMovie[left.movieId]?.length ?? 0));
  }, [movies, plansByMovie, query]);

  const inReview = plans.filter((plan) => plan.status === "IN_REVIEW").length;
  const needsWork = plans.filter((plan) => plan.status === "PLANNED" || plan.status === "CHANGES_REQUESTED").length;
  const approved = plans.filter((plan) => plan.status === "APPROVED" || plan.status === "OPEN").length;

  return (
    <div style={{ maxWidth: 1480, margin: "0 auto", color: "var(--text-main)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#3b82f6", fontSize: 12, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase" }}><CalendarDays size={15} /> Film programming</div>
          <h1 style={{ margin: "8px 0 6px", fontSize: 28 }}>Release planning</h1>
          <p style={{ margin: 0, color: "var(--text-sub)", fontSize: 13.5 }}>Plan where and when an approved movie will play, then submit the plan for administrator review.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} style={{ height: 42, padding: "0 16px", borderRadius: 11, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600 }}><RefreshCw className={loading ? "animate-spin" : ""} size={16} /> Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
        {[
          { label: "Needs operator action", value: needsWork, icon: Film, color: "#3b82f6" },
          { label: "Awaiting administrator", value: inReview, icon: Clock3, color: "#f59e0b" },
          { label: "Approved / open", value: approved, icon: CheckCircle2, color: "#10b981" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ padding: 18, borderRadius: 15, border: "1px solid var(--border-color)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div><div style={{ color: "var(--text-sub)", fontSize: 11.5 }}>{label}</div><div style={{ fontSize: 27, fontWeight: 700, marginTop: 7 }}>{loading ? "–" : value}</div></div>
            <span style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", color, background: `${color}18` }}><Icon size={19} /></span>
          </div>
        ))}
      </div>

      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "var(--text-sub)" }} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search an approved movie…" style={{ width: "100%", height: 46, borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-main)", padding: "0 16px 0 44px", outline: "none" }} />
      </div>

      <div style={{ borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-card)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,1.5fr) minmax(190px,.7fr) minmax(250px,1fr) 150px", gap: 20, padding: "13px 18px", color: "var(--text-sub)", borderBottom: "1px solid var(--border-color)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
          <span>Movie</span><span>Coverage</span><span>Plan status</span><span style={{ textAlign: "right" }}>Action</span>
        </div>
        {error ? <div style={{ margin: 18, padding: 15, borderRadius: 12, color: "#fb7185", background: "rgba(244,63,94,.08)" }}>{error}</div> : rows.length === 0 && !loading ? (
          <div style={{ padding: 52, textAlign: "center", color: "var(--text-sub)" }}>No approved movies are ready for release planning.</div>
        ) : rows.map((movie) => {
          const moviePlans = plansByMovie[movie.movieId] ?? [];
          const statuses = [...new Set(moviePlans.map((plan) => plan.status))];
          return (
            <div key={movie.movieId} style={{ display: "grid", gridTemplateColumns: "minmax(280px,1.5fr) minmax(190px,.7fr) minmax(250px,1fr) 150px", gap: 20, padding: "15px 18px", alignItems: "center", borderBottom: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div style={{ width: 36, height: 46, borderRadius: 8, overflow: "hidden", background: "rgba(59,130,246,.1)", flexShrink: 0 }}>{movie.smallImage && <img src={movie.smallImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
                <div style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{movie.movieNameVn || movie.movieNameEnglish}</strong><small style={{ display: "block", color: "var(--text-sub)", marginTop: 4 }}>{movie.movieNameEnglish || `Movie #${movie.movieId}`}</small></div>
              </div>
              <div><strong style={{ fontSize: 13 }}>{moviePlans.length} branch plan{moviePlans.length === 1 ? "" : "s"}</strong><small style={{ display: "block", color: "var(--text-sub)", marginTop: 4 }}>{moviePlans.length ? "Cluster-specific windows" : "Not planned yet"}</small></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {statuses.length ? statuses.slice(0, 3).map((status) => { const meta = PLAN_META[status] ?? PLAN_META.PLANNED; return <span key={status} style={{ padding: "5px 8px", borderRadius: 999, color: meta.color, background: meta.background, fontSize: 10.5, fontWeight: 700 }}>{meta.label}</span>; }) : <span style={{ color: "var(--text-sub)", fontSize: 12 }}>Ready to create</span>}
              </div>
              <button type="button" onClick={() => navigate(`/admin/movies/${movie.movieId}/availability`)} style={{ justifySelf: "end", border: 0, padding: "4px 0", background: "transparent", color: "#3b82f6", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>Manage plans <ArrowRight size={13} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
