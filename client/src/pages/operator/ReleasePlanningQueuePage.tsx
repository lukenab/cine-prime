import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Film, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  movieApi,
  type MovieApiResponse,
  type MovieAvailabilityResponse,
} from "../../api/movieApi";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";

const PLAN_META: Record<string, { label: string; color: string; background: string }> = {
  PLANNED: { label: "Draft plan", color: "#60a5fa", background: "rgba(59,130,246,.12)" },
  IN_REVIEW: { label: "Awaiting approval", color: "#fbbf24", background: "rgba(245,158,11,.12)" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "#fb7185", background: "rgba(244,63,94,.12)" },
  APPROVED: { label: "Approved", color: "#34d399", background: "rgba(16,185,129,.12)" },
  OPEN: { label: "Open", color: "#22d3ee", background: "rgba(6,182,212,.12)" },
  SUSPENDED: { label: "Suspended", color: "#f97316", background: "rgba(249,115,22,.12)" },
  CLOSED: { label: "Closed", color: "#94a3b8", background: "rgba(148,163,184,.12)" },
};

const STATUS_ORDER = ["CHANGES_REQUESTED", "PLANNED", "IN_REVIEW", "APPROVED", "OPEN", "SUSPENDED", "CLOSED"];
const TABLE_GRID = "minmax(300px,1.5fr) minmax(130px,.6fr) minmax(180px,.8fr) minmax(150px,.7fr) minmax(220px,1fr) minmax(140px,.65fr) 120px";

function formatPlanDate(value?: string, includeTime = false) {
  if (!value) return "Not set";
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", includeTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" });
}

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
    <div style={{ width: "100%", color: "var(--text-main)" }}>
      <AdminPageHeader
        eyebrow="Film programming"
        title="Release Planning"
        description="Plan where and when an approved movie will play, then submit the plan for administrator review."
      />

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
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search an approved movie…" style={{ width: "100%", height: 46, borderRadius: 12, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-main)", padding: "0 16px 0 44px", outline: "none", fontSize: 13 }} />
      </div>

      <div style={{ borderRadius: 16, border: "1px solid var(--border-color)", background: "var(--bg-card)", overflowX: "auto" }}>
        <div style={{ minWidth: 1320 }}>
          <div style={{ display: "grid", gridTemplateColumns: TABLE_GRID, gap: 18, padding: "13px 18px", color: "var(--text-sub)", borderBottom: "1px solid var(--border-color)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
            <span>Movie</span><span>Coverage</span><span>Showing window</span><span>Sales start</span><span>Plan status</span><span>Last updated</span><span style={{ textAlign: "right" }}>Action</span>
          </div>
          {error ? <div style={{ margin: 18, padding: 15, borderRadius: 12, color: "#fb7185", background: "rgba(244,63,94,.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}><span>{error}</span><button type="button" onClick={() => void load()} style={{ flexShrink: 0, border: "1px solid rgba(244,63,94,.3)", borderRadius: 8, padding: "6px 10px", color: "#fb7185", background: "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Retry</button></div> : rows.length === 0 && !loading ? (
            <div style={{ padding: 52, textAlign: "center", color: "var(--text-sub)" }}>No approved movies are ready for release planning.</div>
          ) : rows.map((movie) => {
            const moviePlans = plansByMovie[movie.movieId] ?? [];
            const statusCounts = moviePlans.reduce<Record<string, number>>((counts, plan) => {
              counts[plan.status] = (counts[plan.status] ?? 0) + 1;
              return counts;
            }, {});
            const statuses = Object.keys(statusCounts).sort((left, right) => STATUS_ORDER.indexOf(left) - STATUS_ORDER.indexOf(right));
            const clusterCount = new Set(moviePlans.map((plan) => plan.clusterId)).size;
            const showingStarts = moviePlans.map((plan) => plan.showingStartDate).filter(Boolean).sort();
            const showingEnds = moviePlans.map((plan) => plan.showingEndDate).filter((value): value is string => Boolean(value)).sort();
            const hasOpenEndedWindow = moviePlans.some((plan) => !plan.showingEndDate);
            const salesStarts = moviePlans.map((plan) => plan.salesStartAt).filter((value): value is string => Boolean(value)).sort();
            const updatedDates = moviePlans.map((plan) => plan.updatedAt ?? plan.createdAt).filter((value): value is string => Boolean(value)).sort();
            const showingWindow = showingStarts.length
              ? `${formatPlanDate(showingStarts[0])} – ${hasOpenEndedWindow ? "Open-ended" : formatPlanDate(showingEnds.at(-1))}`
              : "Not planned";
            return (
              <div key={movie.movieId} style={{ display: "grid", gridTemplateColumns: TABLE_GRID, gap: 18, padding: "15px 18px", alignItems: "center", borderBottom: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div style={{ width: 36, height: 46, borderRadius: 8, overflow: "hidden", background: "rgba(59,130,246,.1)", flexShrink: 0 }}>{movie.smallImage && <img src={movie.smallImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</div>
                <div style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{movie.movieNameVn || movie.movieNameEnglish}</strong><small style={{ display: "block", color: "var(--text-sub)", marginTop: 4 }}>{movie.movieNameEnglish || `Movie #${movie.movieId}`}</small></div>
              </div>
              <div><strong style={{ fontSize: 13 }}>{clusterCount} cluster{clusterCount === 1 ? "" : "s"}</strong><small style={{ display: "block", color: "var(--text-sub)", marginTop: 4 }}>{moviePlans.length} plan{moviePlans.length === 1 ? "" : "s"} total</small></div>
              <div><strong style={{ fontSize: 12.5 }}>{showingWindow}</strong><small style={{ display: "block", color: "var(--text-sub)", marginTop: 4 }}>{moviePlans.length ? "Across all clusters" : "No release window"}</small></div>
              <div><strong style={{ fontSize: 12.5 }}>{formatPlanDate(salesStarts[0], true)}</strong><small style={{ display: "block", color: "var(--text-sub)", marginTop: 4 }}>{salesStarts.length > 1 ? "Earliest plan" : salesStarts.length === 1 ? "Scheduled" : "Not scheduled"}</small></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {statuses.length ? statuses.slice(0, 3).map((status) => { const meta = PLAN_META[status] ?? PLAN_META.PLANNED; return <span key={status} title={`${statusCounts[status]} ${meta.label.toLowerCase()} plan${statusCounts[status] === 1 ? "" : "s"}`} style={{ padding: "5px 8px", borderRadius: 999, color: meta.color, background: meta.background, fontSize: 10.5, fontWeight: 700 }}>{meta.label} · {statusCounts[status]}</span>; }) : <span style={{ color: "var(--text-sub)", fontSize: 12 }}>Ready to create</span>}
                {statuses.length > 3 && <span style={{ padding: "5px 8px", color: "var(--text-sub)", fontSize: 10.5, fontWeight: 700 }}>+{statuses.length - 3} states</span>}
              </div>
              <div><strong style={{ fontSize: 12.5 }}>{formatPlanDate(updatedDates.at(-1))}</strong><small style={{ display: "block", color: "var(--text-sub)", marginTop: 4 }}>{updatedDates.length ? "Latest plan change" : "No activity"}</small></div>
              <button type="button" onClick={() => navigate(`/admin/movies/${movie.movieId}/availability`)} style={{ justifySelf: "end", border: 0, padding: "4px 0", background: "transparent", color: "#3b82f6", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>Manage plans <ArrowRight size={13} /></button>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
