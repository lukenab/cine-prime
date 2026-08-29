import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Clapperboard,
  Film,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { subscribeLifecycleEvents } from "../../api/lifecycleSocket";
import { movieApi, type MovieApiResponse } from "../../api/movieApi";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import {
  WorkspaceQueuePanel,
  WorkspaceSummaryStrip,
  WorkspaceTabs,
} from "../../components/admin/ProgrammingWorkspaceChrome";
import { RequestState } from "../../components/shared/RequestState";
import { classifyRequestFailure, type RequestFailure } from "../../utils/requestFailure";

const STATUS_META: Record<string, { label: string; color: string; background: string }> = {
  DRAFT: { label: "Draft", color: "#60a5fa", background: "rgba(59,130,246,.12)" },
  PENDING_REVIEW: { label: "Awaiting approval", color: "#fbbf24", background: "rgba(245,158,11,.12)" },
  APPROVED: { label: "Approved", color: "#34d399", background: "rgba(16,185,129,.12)" },
  CHANGES_REQUESTED: { label: "Changes requested", color: "#fb7185", background: "rgba(244,63,94,.12)" },
  ARCHIVED: { label: "Archived", color: "#94a3b8", background: "rgba(148,163,184,.12)" },
};

type OperatorQueueTab = "needs-action" | "awaiting-review" | "approved";

export default function ProgrammingOperatorDashboardPage() {
  const navigate = useNavigate();
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const [activeTab, setActiveTab] = useState<OperatorQueueTab>("needs-action");

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const response = await movieApi.getAllMovies();
      setMovies(response.result ?? []);
    } catch (error) {
      setFailure(classifyRequestFailure(error, "The programming queue could not be loaded."));
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

  const queues = useMemo(() => ({
    "needs-action": movies.filter((movie) => ["DRAFT", "CHANGES_REQUESTED"].includes(movie.movieStatus ?? "DRAFT")),
    "awaiting-review": movies.filter((movie) => movie.movieStatus === "PENDING_REVIEW"),
    approved: movies.filter((movie) => movie.movieStatus === "APPROVED"),
  }), [movies]);

  const queue = useMemo(() => queues[activeTab]
    .sort((left, right) => String(right.updatedAt ?? right.createAt).localeCompare(String(left.updatedAt ?? left.createAt)))
    .slice(0, 10), [activeTab, queues]);

  const tabMeta: Record<OperatorQueueTab, { title: string; description: string; emptyTitle: string; emptyDescription: string }> = {
    "needs-action": {
      title: "Needs action",
      description: "Draft and returned movie content that can be edited now.",
      emptyTitle: "No content needs action",
      emptyDescription: "New drafts and returned submissions will appear here.",
    },
    "awaiting-review": {
      title: "Awaiting review",
      description: "Submitted content waiting for an independent approval decision.",
      emptyTitle: "No content is awaiting review",
      emptyDescription: "Submitted movie content will appear here until a reviewer responds.",
    },
    approved: {
      title: "Recently approved",
      description: "Approved titles that are eligible for release planning.",
      emptyTitle: "No approved movie content",
      emptyDescription: "Approved titles will appear here when review is complete.",
    },
  };

  const tabs = [
    { id: "needs-action", label: "Needs action", count: queues["needs-action"].length },
    { id: "awaiting-review", label: "Awaiting review", count: queues["awaiting-review"].length },
    { id: "approved", label: "Recently approved", count: queues.approved.length },
  ];

  return (
    <div className="mx-auto w-full max-w-[1540px] pb-10" style={{ color: "var(--text-main)" }}>
      <AdminPageHeader
        eyebrow="Film programming"
        title="Programming Workspace"
        description="Prepare catalogue, release and schedule drafts for independent review."
        actions={(
          <>
            <button type="button" onClick={() => navigate("/admin/movies")} className="inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-colors hover:bg-blue-500/5" style={{ borderColor: "var(--border-color)", color: "var(--text-main)", background: "var(--bg-card)" }}>
              <Film size={16} /> Movie catalogue
            </button>
            <button type="button" onClick={() => navigate("/admin/showtimes/auto/create")} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700">
              <Clapperboard size={16} /> Create schedule
            </button>
          </>
        )}
      />

      <WorkspaceSummaryStrip items={[
        { label: "Needs action", value: loading ? "–" : queues["needs-action"].length, helper: "Draft or returned", onSelect: () => setActiveTab("needs-action") },
        { label: "Awaiting review", value: loading ? "–" : queues["awaiting-review"].length, helper: "Submitted for decision", onSelect: () => setActiveTab("awaiting-review") },
        { label: "Approved titles", value: loading ? "–" : queues.approved.length, helper: "Eligible for release planning", onSelect: () => setActiveTab("approved") },
      ]} />

      <WorkspaceTabs tabs={tabs} activeTab={activeTab} onChange={(tab) => setActiveTab(tab as OperatorQueueTab)} />

      <WorkspaceQueuePanel
        title={tabMeta[activeTab].title}
        description={tabMeta[activeTab].description}
        actions={<button type="button" onClick={() => navigate("/admin/movies")} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">View catalogue <ArrowRight size={14} /></button>}
      >
          {failure ? (
            <div className="p-4"><RequestState compact kind={failure.kind} description={failure.description} onRetry={() => void load()} /></div>
          ) : queue.length === 0 && !loading ? (
            <div className="p-4"><RequestState compact kind="empty" title={tabMeta[activeTab].emptyTitle} description={tabMeta[activeTab].emptyDescription} /></div>
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
      </WorkspaceQueuePanel>
    </div>
  );
}
