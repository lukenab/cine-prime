import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, ChevronRight, Clapperboard, Film, GitPullRequestArrow } from "lucide-react";
import { Link } from "react-router-dom";

import { movieApi, type MovieApiResponse, type MovieAvailabilityResponse } from "../../api/movieApi";
import { showtimeApi, type SchedulePlanSummaryResponse } from "../../api/showtimeApi";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { LoadingState } from "../../components/shared/LoadingState";
import { RequestState } from "../../components/shared/RequestState";
import { classifyRequestFailure, type RequestFailure } from "../../utils/requestFailure";

const QUEUE_PREVIEW_LIMIT = 5;

type ReleasePlanGroup = {
  movieId: number;
  title: string;
  planCount: number;
  clusterCount: number;
  submittedAt?: string;
};

function formatDate(value?: string) {
  if (!value) return "Not submitted";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function groupReleasePlansByMovie(plans: MovieAvailabilityResponse[]): ReleasePlanGroup[] {
  const groups = new Map<number, {
    movieId: number;
    title: string;
    planCount: number;
    clusterIds: Set<number>;
    submittedAt?: string;
  }>();

  plans.forEach((plan) => {
    const current = groups.get(plan.movieId) ?? {
      movieId: plan.movieId,
      title: plan.movieTitle || `Movie #${plan.movieId}`,
      planCount: 0,
      clusterIds: new Set<number>(),
      submittedAt: undefined,
    };
    current.planCount += 1;
    current.clusterIds.add(plan.clusterId);
    if (plan.submittedAt && (!current.submittedAt || plan.submittedAt < current.submittedAt)) {
      current.submittedAt = plan.submittedAt;
    }
    groups.set(plan.movieId, current);
  });

  return Array.from(groups.values())
    .map(({ clusterIds, ...group }) => ({ ...group, clusterCount: clusterIds.size }))
    .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
}

function QueueSection({
  title,
  description,
  countLabel,
  accentColor,
  viewAllTo,
  viewAllLabel,
  children,
}: {
  title: string;
  description: string;
  countLabel: string | number;
  accentColor: string;
  viewAllTo?: string;
  viewAllLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-t-[3px]"
      style={{
        borderColor: "var(--border-color)",
        borderTopColor: accentColor,
        background: "var(--bg-card)",
        boxShadow: "0 6px 20px rgba(15, 23, 42, 0.07)",
      }}
    >
      <header
        className="flex min-h-[76px] items-center justify-between gap-4 border-b px-5 py-4"
        style={{
          borderColor: "var(--border-color)",
          background: `linear-gradient(90deg, ${accentColor}12 0%, var(--bg-card) 72%)`,
        }}
      >
        <div>
          <h2 className="text-base font-bold" style={{ color: "var(--text-main)" }}>{title}</h2>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-sub)" }}>{description}</p>
        </div>
        <span
          className="whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold"
          style={{ color: accentColor, borderColor: `${accentColor}24`, background: `${accentColor}12` }}
        >
          {countLabel}
        </span>
      </header>
      {children}
      {viewAllTo && viewAllLabel && (
        <footer className="border-t px-5 py-3.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <Link to={viewAllTo} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
            {viewAllLabel}<ChevronRight size={14} />
          </Link>
        </footer>
      )}
    </section>
  );
}

function QueueLink({ to, title, meta }: { to: string; title: string; meta: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-[68px] items-center justify-between gap-4 border-b px-5 py-4 transition-colors last:border-b-0 hover:bg-blue-500/5"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className="min-w-0">
        <strong className="block truncate text-[13.5px] font-semibold" style={{ color: "var(--text-main)" }}>{title}</strong>
        <span className="mt-1 block truncate text-[12px]" style={{ color: "var(--text-sub)" }}>{meta}</span>
      </div>
      <ChevronRight size={16} className="shrink-0 text-blue-600" />
    </Link>
  );
}

export default function ProgrammingApprovalWorkspacePage() {
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [releasePlans, setReleasePlans] = useState<MovieAvailabilityResponse[]>([]);
  const [schedulePlans, setSchedulePlans] = useState<SchedulePlanSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<RequestFailure | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const [movieResponse, releaseResponse, scheduleResponse] = await Promise.all([
        movieApi.getAllMovies(),
        movieApi.searchAvailabilities({ status: "IN_REVIEW" }),
        showtimeApi.listSchedulePlans("IN_REVIEW", 0, 50),
      ]);
      setMovies((movieResponse.result ?? []).filter((movie) => movie.movieStatus === "PENDING_REVIEW"));
      setReleasePlans((releaseResponse.result ?? []).filter((plan) => plan.status === "IN_REVIEW"));
      setSchedulePlans(scheduleResponse.result?.content ?? []);
    } catch (error) {
      setFailure(classifyRequestFailure(error, "The programming approval queues could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const total = movies.length + releasePlans.length + schedulePlans.length;
  const releasePlanGroups = useMemo(() => groupReleasePlansByMovie(releasePlans), [releasePlans]);
  const oldestSubmission = useMemo(() => {
    const timestamps = [
      ...releasePlans.map((item) => item.submittedAt),
      ...schedulePlans.map((item) => item.submittedAt),
    ].filter((item): item is string => Boolean(item)).sort();
    return timestamps[0];
  }, [releasePlans, schedulePlans]);

  return (
    <div className="mx-auto w-full max-w-[1540px] pb-10">
      <AdminPageHeader eyebrow="Film programming" title="Approval Workspace" description="Review submitted content, release plans and generated schedules without entering creation workflows." />

      <div className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Awaiting review", value: total, helper: "Across all programming queues", icon: GitPullRequestArrow, color: "#2563eb" },
          { label: "Movie content", value: movies.length, helper: "Titles submitted for approval", icon: Film, color: "#7c3aed" },
          { label: "Release plans", value: releasePlans.length, helper: `${releasePlanGroups.length} movie queues`, icon: CalendarCheck2, color: "#d97706" },
          { label: "Generated schedules", value: schedulePlans.length, helper: oldestSubmission ? `Oldest submitted ${formatDate(oldestSubmission)}` : "No schedule awaiting review", icon: Clapperboard, color: "#059669" },
        ].map(({ label, value, helper, icon: Icon, color }) => (
          <article
            key={label}
            className="flex min-h-[124px] items-center justify-between rounded-2xl border border-t-[3px] p-5"
            style={{
              borderColor: "var(--border-color)",
              borderTopColor: color,
              background: "var(--bg-card)",
              boxShadow: "0 6px 18px rgba(15, 23, 42, 0.065)",
            }}
          >
            <div>
              <p className="text-[13px] font-medium" style={{ color: "var(--text-sub)" }}>{label}</p>
              <strong className="mt-2 block text-[28px] leading-none" style={{ color: "var(--text-main)" }}>{loading ? "–" : value}</strong>
              <small className="mt-2 block text-[11.5px]" style={{ color: "var(--text-sub)" }}>{helper}</small>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ color, background: `${color}16` }}><Icon size={20} /></span>
          </article>
        ))}
      </div>

      {loading ? <LoadingState label="Loading approval queues…" /> : failure ? (
        <RequestState kind={failure.kind} description={failure.description} onRetry={() => void load()} />
      ) : total === 0 ? (
        <RequestState kind="empty" title="All programming queues are clear" description="New submissions from programming operators will appear here for independent review." />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-3">
          <QueueSection
            title="Movie content"
            description="Customer-facing catalogue records"
            countLabel={movies.length}
            accentColor="#7c3aed"
            viewAllTo={movies.length > QUEUE_PREVIEW_LIMIT ? "/admin/movies" : undefined}
            viewAllLabel={movies.length > QUEUE_PREVIEW_LIMIT ? `View all ${movies.length} titles` : undefined}
          >
            {movies.length
              ? movies.slice(0, QUEUE_PREVIEW_LIMIT).map((movie) => <QueueLink key={movie.movieId} to="/admin/movies" title={movie.movieNameVn || movie.movieNameEnglish} meta={`Submitted content · Movie #${movie.movieId}`} />)
              : <RequestState compact kind="empty" title="No movie reviews" description="No movie content is awaiting review." />}
          </QueueSection>

          <QueueSection
            title="Release plans"
            description="Grouped by movie instead of every branch plan"
            countLabel={`${releasePlans.length} plans · ${releasePlanGroups.length} titles`}
            accentColor="#d97706"
            viewAllTo={releasePlanGroups.length > QUEUE_PREVIEW_LIMIT ? "/admin/release-plans" : undefined}
            viewAllLabel={releasePlanGroups.length > QUEUE_PREVIEW_LIMIT ? `View all ${releasePlanGroups.length} movie queues` : undefined}
          >
            {releasePlanGroups.length
              ? releasePlanGroups.slice(0, QUEUE_PREVIEW_LIMIT).map((group) => (
                <QueueLink
                  key={group.movieId}
                  to={`/admin/release-plans?movieId=${group.movieId}`}
                  title={group.title}
                  meta={`${group.planCount} branch plan${group.planCount === 1 ? "" : "s"} across ${group.clusterCount} cluster${group.clusterCount === 1 ? "" : "s"} · oldest ${formatDate(group.submittedAt)}`}
                />
              ))
              : <RequestState compact kind="empty" title="No release-plan reviews" description="No cluster release plan is awaiting review." />}
          </QueueSection>

          <QueueSection
            title="Generated schedules"
            description="Validated plans ready for checker review"
            countLabel={schedulePlans.length}
            accentColor="#059669"
            viewAllTo={schedulePlans.length > QUEUE_PREVIEW_LIMIT ? "/admin/showtimes/auto/review" : undefined}
            viewAllLabel={schedulePlans.length > QUEUE_PREVIEW_LIMIT ? `View all ${schedulePlans.length} schedules` : undefined}
          >
            {schedulePlans.length
              ? schedulePlans.slice(0, QUEUE_PREVIEW_LIMIT).map((plan) => <QueueLink key={plan.schedulePlanId} to={`/admin/showtimes/auto/review?runId=${plan.generationRunId}`} title={`Schedule plan #${plan.schedulePlanId}`} meta={`${plan.cinemaCount} cinemas · ${plan.sessionCount} sessions · submitted ${formatDate(plan.submittedAt)}`} />)
              : <RequestState compact kind="empty" title="No schedule reviews" description="No generated schedule is awaiting review." />}
          </QueueSection>
        </div>
      )}
    </div>
  );
}
