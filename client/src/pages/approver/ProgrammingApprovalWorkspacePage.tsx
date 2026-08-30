import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Clapperboard, Clock3, Film } from "lucide-react";
import { Link } from "react-router-dom";

import { movieApi, type MovieApiResponse, type MovieAvailabilityResponse } from "../../api/movieApi";
import { showtimeApi, type SchedulePlanSummaryResponse } from "../../api/showtimeApi";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import {
  WorkspaceQueuePanel,
  WorkspaceSummaryStrip,
  WorkspaceTabs,
} from "../../components/admin/ProgrammingWorkspaceChrome";
import { LoadingState } from "../../components/shared/LoadingState";
import { RequestState } from "../../components/shared/RequestState";
import { classifyRequestFailure, type RequestFailure } from "../../utils/requestFailure";

const QUEUE_PREVIEW_LIMIT = 10;
type ApprovalQueueTab = "movie-content" | "release-plans" | "generated-schedules";

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
  const [activeTab, setActiveTab] = useState<ApprovalQueueTab>("movie-content");

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

  const tabs = [
    { id: "movie-content", label: "Movie content", count: movies.length },
    { id: "release-plans", label: "Release plans", count: releasePlanGroups.length },
    { id: "generated-schedules", label: "Generated schedules", count: schedulePlans.length },
  ];

  const activeQueueMeta: Record<ApprovalQueueTab, { viewAllTo?: string; viewAllLabel?: string }> = {
    "movie-content": {
      viewAllTo: movies.length > QUEUE_PREVIEW_LIMIT ? "/admin/movies" : undefined,
      viewAllLabel: movies.length > QUEUE_PREVIEW_LIMIT ? `View all ${movies.length} titles` : undefined,
    },
    "release-plans": {
      viewAllTo: releasePlanGroups.length > QUEUE_PREVIEW_LIMIT ? "/admin/release-plans" : undefined,
      viewAllLabel: releasePlanGroups.length > QUEUE_PREVIEW_LIMIT ? `View all ${releasePlanGroups.length} movie queues` : undefined,
    },
    "generated-schedules": {
      viewAllTo: schedulePlans.length > QUEUE_PREVIEW_LIMIT ? "/admin/showtimes/auto/review" : undefined,
      viewAllLabel: schedulePlans.length > QUEUE_PREVIEW_LIMIT ? `View all ${schedulePlans.length} schedules` : undefined,
    },
  };

  const renderActiveQueue = () => {
    if (activeTab === "movie-content") {
      return movies.length
        ? movies.slice(0, QUEUE_PREVIEW_LIMIT).map((movie) => (
          <QueueLink
            key={movie.movieId}
            to="/admin/movies"
            title={movie.movieNameVn || movie.movieNameEnglish}
            meta={movie.updatedAt ? `Updated ${formatDate(movie.updatedAt)}` : "Awaiting decision"}
          />
        ))
        : <div className="p-4"><RequestState compact kind="empty" title="No movie reviews" description="No movie content is awaiting review." /></div>;
    }

    if (activeTab === "release-plans") {
      return releasePlanGroups.length
        ? releasePlanGroups.slice(0, QUEUE_PREVIEW_LIMIT).map((group) => (
          <QueueLink
            key={group.movieId}
            to={`/admin/release-plans?movieId=${group.movieId}`}
            title={group.title}
            meta={`${group.planCount} branch plan${group.planCount === 1 ? "" : "s"} across ${group.clusterCount} cluster${group.clusterCount === 1 ? "" : "s"} · oldest ${formatDate(group.submittedAt)}`}
          />
        ))
        : <div className="p-4"><RequestState compact kind="empty" title="No release-plan reviews" description="No cluster release plan is awaiting review." /></div>;
    }

    return schedulePlans.length
      ? schedulePlans.slice(0, QUEUE_PREVIEW_LIMIT).map((plan) => (
        <QueueLink
          key={plan.schedulePlanId}
          to={`/admin/showtimes/auto/review?runId=${plan.generationRunId}`}
          title={`Schedule plan #${plan.schedulePlanId}`}
          meta={`${plan.cinemaCount} cinemas · ${plan.sessionCount} sessions · submitted ${formatDate(plan.submittedAt)}`}
        />
      ))
      : <div className="p-4"><RequestState compact kind="empty" title="No schedule reviews" description="No generated schedule is awaiting review." /></div>;
  };

  return (
    <div className="mx-auto w-full max-w-[1540px] pb-10">
      <AdminPageHeader eyebrow="Film programming" title="Programming Review Workspace" description="Review submitted movie content, release plans and generated schedules." />

      <WorkspaceSummaryStrip items={[
        { label: "Awaiting review", value: loading ? "–" : total, helper: "Across all review queues", icon: Clock3, iconColor: "#2563eb", iconBackground: "rgba(37,99,235,.10)" },
        { label: "Movie content", value: loading ? "–" : movies.length, helper: "Titles awaiting decision", icon: Film, iconColor: "#7c3aed", iconBackground: "rgba(124,58,237,.10)", onSelect: () => setActiveTab("movie-content") },
        { label: "Release plans", value: loading ? "–" : releasePlans.length, helper: `${releasePlanGroups.length} movie queues`, icon: CalendarDays, iconColor: "#d97706", iconBackground: "rgba(217,119,6,.10)", onSelect: () => setActiveTab("release-plans") },
        { label: "Generated schedules", value: loading ? "–" : schedulePlans.length, helper: oldestSubmission ? `Oldest ${formatDate(oldestSubmission)}` : "No schedule awaiting review", icon: Clapperboard, iconColor: "#059669", iconBackground: "rgba(5,150,105,.10)", onSelect: () => setActiveTab("generated-schedules") },
      ]} />

      <WorkspaceTabs tabs={tabs} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as ApprovalQueueTab)} />

      {loading ? <LoadingState label="Loading approval queues…" /> : failure ? (
        <RequestState kind={failure.kind} description={failure.description} onRetry={() => void load()} />
      ) : (
        <WorkspaceQueuePanel
          ariaLabel={`${tabs.find((tab) => tab.id === activeTab)?.label ?? "Programming"} approval queue`}
          footer={activeQueueMeta[activeTab].viewAllTo && activeQueueMeta[activeTab].viewAllLabel ? (
            <Link to={activeQueueMeta[activeTab].viewAllTo} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
              {activeQueueMeta[activeTab].viewAllLabel}<ChevronRight size={14} />
            </Link>
          ) : undefined}
        >
          {renderActiveQueue()}
        </WorkspaceQueuePanel>
      )}
    </div>
  );
}
