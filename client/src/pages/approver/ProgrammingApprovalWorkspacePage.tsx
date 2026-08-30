import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Clapperboard, Clock3, Film } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import {
  movieApi,
  type MovieApiResponse,
  type MovieAvailabilityResponse,
  type MovieResponse,
} from "../../api/movieApi";
import { showtimeApi, type SchedulePlanSummaryResponse } from "../../api/showtimeApi";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import {
  WorkspaceQueuePanel,
  WorkspaceSummaryStrip,
  WorkspaceTabs,
} from "../../components/admin/ProgrammingWorkspaceChrome";
import { LoadingState } from "../../components/shared/LoadingState";
import { RequestState } from "../../components/shared/RequestState";
import { MovieDetailModal } from "../../layouts/MovieDetailModal";
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

function formatDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return "Runtime not set";
  return `${minutes} min`;
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

function QueueReviewButton({ movie, onClick }: { movie: MovieApiResponse; onClick: () => void }) {
  const primaryTitle = movie.movieNameVn?.trim() || movie.movieNameEnglish?.trim() || "Untitled movie";
  const originalTitle = movie.movieNameEnglish?.trim();
  const showOriginalTitle = Boolean(originalTitle && originalTitle.toLocaleLowerCase() !== primaryTitle.toLocaleLowerCase());
  const posterUrl = movie.smallImage || movie.largeImage;
  const genres = movie.movieType?.filter(Boolean).slice(0, 2).join(", ") || "Genre not set";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[88px] w-full items-center justify-between gap-5 border-b px-5 py-3.5 text-left transition-colors last:border-b-0 hover:bg-blue-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      style={{ borderColor: "var(--border-color)" }}
      aria-label={`Review submission for ${primaryTitle}`}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <div
          className="flex h-[60px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-hover)", color: "var(--text-sub)" }}
        >
          {posterUrl
            ? <img src={posterUrl} alt="" className="h-full w-full object-cover" />
            : <Film size={16} aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-[13.5px] font-semibold" style={{ color: "var(--text-main)" }}>{primaryTitle}</strong>
          {showOriginalTitle && <span className="mt-0.5 block truncate text-[12px]" style={{ color: "var(--text-sub)" }}>{originalTitle}</span>}
          <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]" style={{ color: "var(--text-sub)" }}>
            <span className="font-semibold" style={{ color: "var(--text-main)" }}>{movie.ageRatingCode || "Unrated"}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDuration(movie.duration)}</span>
            <span aria-hidden="true">·</span>
            <span>{genres}</span>
            <span aria-hidden="true">·</span>
            <span>{movie.updatedAt ? `Updated ${formatDate(movie.updatedAt)}` : "Awaiting decision"}</span>
          </span>
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-600">
        Review submission
        <ChevronRight size={15} />
      </span>
    </button>
  );
}

export default function ProgrammingApprovalWorkspacePage() {
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [releasePlans, setReleasePlans] = useState<MovieAvailabilityResponse[]>([]);
  const [schedulePlans, setSchedulePlans] = useState<SchedulePlanSummaryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [activeTab, setActiveTab] = useState<ApprovalQueueTab>("movie-content");
  const [reviewMovie, setReviewMovie] = useState<MovieResponse | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

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

  const openMovieReview = async (movie: MovieApiResponse) => {
    setReviewMovie(null);
    setReviewLoading(true);
    try {
      const response = await movieApi.getMovieById(movie.movieId);
      setReviewMovie(response.result);
    } catch (error) {
      const detailFailure = classifyRequestFailure(error, "The movie content could not be opened for review.");
      toast.error(detailFailure.description);
    } finally {
      setReviewLoading(false);
    }
  };

  const approveMovie = async (movieId: number) => {
    await movieApi.approveMovie(movieId);
    setMovies((current) => current.filter((movie) => movie.movieId !== movieId));
  };

  const requestMovieChanges = async (movieId: number, note: string) => {
    await movieApi.requestMovieChanges(movieId, note);
    setMovies((current) => current.filter((movie) => movie.movieId !== movieId));
  };

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
      viewAllTo: undefined,
      viewAllLabel: undefined,
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
        ? movies.map((movie) => (
          <QueueReviewButton
            key={movie.movieId}
            movie={movie}
            onClick={() => void openMovieReview(movie)}
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

      <MovieDetailModal
        mode="review"
        open={Boolean(reviewMovie) || reviewLoading}
        movie={reviewMovie}
        loading={reviewLoading}
        onClose={() => {
          setReviewMovie(null);
          setReviewLoading(false);
        }}
        onApprove={approveMovie}
        onReject={requestMovieChanges}
      />
    </div>
  );
}
