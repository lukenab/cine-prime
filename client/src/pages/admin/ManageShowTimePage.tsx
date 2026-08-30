import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, SlidersHorizontal, RefreshCw, AlertCircle, CalendarDays, History, List, Film, X } from "lucide-react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { movieApi } from "../../api/movieApi";

import { ShowtimeStatsCards } from "../../layouts/ShowTimeStatsCards";
import { ShowtimeTable } from "../../layouts/ShowTimeTable";
import { ShowtimeModal } from "../../layouts/ShowTimeModal";
import {
  showtimeApi,
  type ShowtimeResponse,
  type ShowtimeAssignPayload,
  type ShowtimeUpdatePayload,
  type ShowtimeStatus,
} from "../../api/showtimeApi";
import {
  GenerationRunsView,
  ShowtimeCreateChoiceDialog,
} from "./showtimeWorkspace/ShowtimeWorkspaceViews";
import ShowtimeOperationsBoard from "./showtimeWorkspace/ShowtimeOperationsBoard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

type WorkspaceView = "operations" | "list" | "runs";

export default function ManageShowtimePage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Live Schedule is an operational verification surface for programming roles.
  // Direct showtime mutation remains an administrator responsibility; operators
  // create schedules through the governed automatic-scheduling workflow instead.
  const canManageShowtimes = Boolean(user?.roles.some((role) =>
    role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN"));
  const isReadOnly = !canManageShowtimes;

  // Deep-link scope from a release plan's "Schedule shows" action
  // (/admin/showtimes?movieId=...&clusterId=...&availabilityId=...): when present, the
  // workspace narrows to that movie+cluster and offers to schedule a showtime for it directly.
  const scopeMovieId   = searchParams.get("movieId")   ? Number(searchParams.get("movieId"))   : null;
  const scopeClusterId = searchParams.get("clusterId") ? Number(searchParams.get("clusterId")) : null;
  const isScoped = scopeMovieId != null || scopeClusterId != null;

  const [scopeMovieName, setScopeMovieName] = useState<string | null>(null);
  const [scopeClusterName, setScopeClusterName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (scopeMovieId != null) {
      movieApi.getMovieById(scopeMovieId).then((res: any) => {
        if (!active) return;
        const movie = res?.result;
        setScopeMovieName(movie?.movieNameEnglish || movie?.movieNameVn || null);
      }).catch(() => { if (active) setScopeMovieName(null); });
    } else {
      setScopeMovieName(null);
    }
    return () => { active = false; };
  }, [scopeMovieId]);

  useEffect(() => {
    let active = true;
    if (scopeClusterId != null) {
      movieApi.getClusterById(scopeClusterId).then((res: any) => {
        if (!active) return;
        setScopeClusterName(res?.result?.clusterName ?? null);
      }).catch(() => { if (active) setScopeClusterName(null); });
    } else {
      setScopeClusterName(null);
    }
    return () => { active = false; };
  }, [scopeClusterId]);

  const clearScope = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("movieId");
    next.delete("clusterId");
    next.delete("availabilityId");
    setSearchParams(next, { replace: true });
  };

  const [showtimes, setShowtimes]   = useState<ShowtimeResponse[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const [searchQuery, setSearchQuery]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter]     = useState("");
  const [roomFilter, setRoomFilter]     = useState<number | "">("");
  const [clusterFilter, setClusterFilter] = useState<number | "">("");

  const [modalOpen, setModalOpen]       = useState(false);
  const [editShowtime, setEditShowtime] = useState<ShowtimeResponse | null>(null);
  const [showFilters, setShowFilters]   = useState(false);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("operations");
  const [createChoiceOpen, setCreateChoiceOpen] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const loadShowtimes = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await showtimeApi.getInternalShowtimes();
      setShowtimes(res.result ?? []);
      setLastSyncedAt(new Date());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Failed to load showtimes. Is the showtime service running?");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadShowtimes(); }, [loadShowtimes]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadShowtimes(true);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [loadShowtimes]);

  // Derive room filter options from loaded showtimes (no extra API calls)
  const roomOptions = useMemo(() => {
    const map = new Map<number, string>();
    showtimes.forEach((s) => map.set(s.cinemaRoomId, s.cinemaRoomName));
    return Array.from(map, ([cinemaRoomId, cinemaRoomName]) => ({ cinemaRoomId, cinemaRoomName }));
  }, [showtimes]);

  // Derive cluster filter options from loaded showtimes (no extra API calls)
  const clusterOptions = useMemo(() => {
    const map = new Map<number, string>();
    showtimes.forEach((s) => {
      if (s.clusterId != null) map.set(s.clusterId, s.clusterName ?? `Cluster ${s.clusterId}`);
    });
    return Array.from(map, ([clusterId, clusterName]) => ({ clusterId, clusterName }));
  }, [showtimes]);

  // Scope to the deep-linked movie/cluster first, then apply the cluster picker on top.
  const scopedShowtimes = useMemo(() => {
    return showtimes.filter((s) =>
      (scopeMovieId == null || s.movieId === scopeMovieId) &&
      (scopeClusterId == null || s.clusterId === scopeClusterId) &&
      (!clusterFilter || s.clusterId === clusterFilter),
    );
  }, [showtimes, scopeMovieId, scopeClusterId, clusterFilter]);

  const operationsShowtimes = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return scopedShowtimes.filter((showtime) => {
      const matchesSearch = !query
        || showtime.movieName.toLocaleLowerCase().includes(query)
        || showtime.cinemaRoomName.toLocaleLowerCase().includes(query)
        || (showtime.clusterName ?? "").toLocaleLowerCase().includes(query);
      const matchesStatus = !statusFilter || showtime.status === statusFilter;
      const matchesRoom = !roomFilter || showtime.cinemaRoomId === roomFilter;
      return matchesSearch && matchesStatus && matchesRoom;
    });
  }, [roomFilter, searchQuery, scopedShowtimes, statusFilter]);

  const handleSaveShowtime = async (payload: ShowtimeAssignPayload | ShowtimeUpdatePayload) => {
    if (editShowtime) {
      await showtimeApi.updateShowtime(editShowtime.showTimeId, payload as ShowtimeUpdatePayload);
    } else {
      await showtimeApi.createShowtime(payload as ShowtimeAssignPayload);
    }
    await loadShowtimes(true);
  };

  const handleMoveShowtime = async (
    showtime: ShowtimeResponse,
    cinemaRoomId: number,
    showDate: string,
    startTime: string,
  ) => {
    try {
      setLoading(true);
      setError(null);
      await showtimeApi.updateShowtime(showtime.showTimeId, { cinemaRoomId, showDate, startTime });
      await loadShowtimes(true);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? "The showtime could not be moved. Check room availability and scheduling rules.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (
    showtime: ShowtimeResponse,
    status: ShowtimeStatus,
    reason?: string,
  ) => {
    try {
      setLoading(true);
      setError(null);
      const response = await showtimeApi.updateShowtimeStatus(showtime.showTimeId, { status, reason });
      setShowtimes((current) =>
        current.map((item) => item.showTimeId === showtime.showTimeId ? response.result : item),
      );
      setLastSyncedAt(new Date());
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? "The showtime status could not be updated.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStatusChange = async (
    showtimeIds: number[],
    status: ShowtimeStatus,
    reason?: string,
  ) => {
    try {
      setLoading(true);
      setError(null);
      // The backend deliberately caps one bulk command at 100 ids. A filtered
      // movie can span more than one page (and occasionally more than 100
      // sessions), so submit deterministic chunks while keeping one UI action.
      for (let index = 0; index < showtimeIds.length; index += 100) {
        await showtimeApi.bulkUpdateShowtimeStatus({
          showtimeIds: showtimeIds.slice(index, index + 100),
          status,
          reason,
        });
      }
      await loadShowtimes(true);
    } catch (err: unknown) {
      await loadShowtimes(true);
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? "The selected showtimes could not be updated.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShowtime = async (id: number) => {
    try {
      await showtimeApi.deleteShowtime(id);
      setShowtimes((prev) => prev.filter((s) => s.showTimeId !== id));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Failed to delete showtime. Please try again.");
    }
  };

  const handleResetFilters = () => {
    setClusterFilter("");
    setStatusFilter("");
    setDateFilter("");
    setRoomFilter("");
  };

  const hasAdvancedFilters = !!(roomFilter || (workspaceView === "list" && dateFilter));
  const hasActiveFilters = !!(clusterFilter || statusFilter || hasAdvancedFilters);

  const openManualCreate = () => {
    setCreateChoiceOpen(false);
    setEditShowtime(null);
    setModalOpen(true);
  };

  const openAutomaticCreate = (runId: number | null = null) => {
    setCreateChoiceOpen(false);
    navigate(runId ? `/admin/showtimes/auto/create?runId=${runId}` : "/admin/showtimes/auto/create");
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
            {isReadOnly ? "Live Schedule" : "Showtime Workspace"}
          </h1>
          <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
            {isReadOnly
              ? "View published and operational cinema schedules across all clusters."
              : "Plan, generate, and manage cinema schedules in one workspace"}
          </p>
        </div>
        {canManageShowtimes ? <div className="flex items-center rounded-xl border p-1" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          {([
            ["operations", CalendarDays, "Operations"],
            ["list", List, "Showtime List"],
            ["runs", History, "Automation"],
          ] as const).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setWorkspaceView(value)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors"
              style={{
                background: workspaceView === value ? "rgba(37,99,235,.10)" : "transparent",
                color: workspaceView === value ? "#2563eb" : "var(--text-sub)",
                fontSize: "12px",
                fontWeight: workspaceView === value ? 650 : 500,
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div> : (
          <span className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ color: "var(--text-sub)", borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            Read-only
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border border-rose-200 bg-rose-50">
          <AlertCircle size={16} className="text-rose-500 flex-shrink-0" />
          <p style={{ fontSize: "14px", color: "#e11d48" }}>{error}</p>
          <button
            onClick={() => void loadShowtimes()}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 transition-colors text-rose-600"
            style={{ fontSize: "13px" }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {isScoped && (
        <div
          className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: "rgba(37,99,235,0.35)", background: "rgba(37,99,235,0.08)" }}
        >
          <Film size={16} className="flex-shrink-0" style={{ color: "#2563eb" }} />
          <p style={{ fontSize: "13px", color: "var(--text-main)" }}>
            Showing schedules for{" "}
            <strong>{scopeMovieName ?? (scopeMovieId != null ? `Movie #${scopeMovieId}` : "this movie")}</strong>
            {scopeClusterId != null && (
              <>
                {" "}at <strong>{scopeClusterName ?? `Cluster #${scopeClusterId}`}</strong>
              </>
            )}
            {" "}from the release plan.
          </p>
          {canManageShowtimes && <button
            type="button"
            onClick={() => setCreateChoiceOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-white transition-all hover:opacity-90"
            style={{ fontSize: "12px", fontWeight: 600, background: "#2563eb" }}
          >
            <Plus size={13} /> Schedule showtime
          </button>}
          <button
            type="button"
            onClick={clearScope}
            className="ml-auto flex items-center gap-1 rounded-lg border px-2.5 py-1.5 transition-all hover:opacity-80"
            style={{ fontSize: "12px", color: "var(--text-sub)", borderColor: "var(--border-color)" }}
          >
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {workspaceView !== "runs" && (
        <ShowtimeStatsCards showtimes={scopedShowtimes} loading={loading && showtimes.length === 0} />
      )}

      {workspaceView !== "runs" && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-[1_1_320px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text"
            placeholder="Search movie, cinema or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl border pl-10 pr-4 outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
            style={{ fontSize: "13px", background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
          />
        </div>

        <div
          className="flex h-10 overflow-hidden rounded-xl border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            title="Date and room filters"
            aria-label="Toggle date and room filters"
            aria-expanded={showFilters}
            className="relative flex w-10 items-center justify-center border-r transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: showFilters || hasAdvancedFilters ? "#2563eb" : "var(--text-sub)", borderColor: "var(--border-color)" }}
          >
            <SlidersHorizontal size={15} />
            {hasAdvancedFilters && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-600" />}
          </button>
          <Select
            value={clusterFilter === "" ? "all" : String(clusterFilter)}
            onValueChange={(value) => setClusterFilter(value === "all" ? "" : Number(value))}
          >
            <SelectTrigger
              aria-label="Filter by cinema"
              className="h-full min-w-[170px] rounded-none border-0 border-r bg-transparent px-3 text-[13px] font-medium focus-visible:ring-0 dark:bg-transparent dark:hover:bg-white/5"
              style={{ height: "38px", color: "var(--text-main)", borderColor: "var(--border-color)" }}
            >
              <SelectValue placeholder="All cinemas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cinemas</SelectItem>
              {clusterOptions.map((cluster) => (
                <SelectItem key={cluster.clusterId} value={String(cluster.clusterId)}>{cluster.clusterName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
            <SelectTrigger
              aria-label="Filter by showtime status"
              className="h-full min-w-[135px] rounded-none border-0 bg-transparent px-3 text-[13px] font-medium focus-visible:ring-0 dark:bg-transparent dark:hover:bg-white/5"
              style={{ height: "38px", color: "var(--text-main)" }}
            >
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="ON_SALE">On sale</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <button
          onClick={() => void loadShowtimes()}
          disabled={loading}
          title={lastSyncedAt ? `Last synced ${lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Refresh schedules"}
          aria-label="Refresh schedules"
          className="flex h-10 items-center justify-center gap-2 rounded-xl border px-3 transition-all hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          <span className="text-[13px] font-semibold">Refresh</span>
        </button>

        {canManageShowtimes && <button
          onClick={() => setCreateChoiceOpen(true)}
          className="flex h-10 items-center gap-2 rounded-xl px-4 text-white shadow-sm transition-all hover:opacity-90"
          style={{ fontSize: "13px", fontWeight: 600, background: isDarkMode ? "#9333ea" : "#7e22ce" }}
        >
          <Plus size={16} /> Create Schedule
        </button>}
        </div>
      )}

      {/* Filter panel */}
      {showFilters && workspaceView !== "runs" && (
        <div className="mb-4 space-y-4 rounded-xl border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border-color)" }}>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)" }}>Filter Showtimes</p>
            {hasActiveFilters && (
              <button onClick={handleResetFilters} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                Reset Filters
              </button>
            )}
          </div>

          <div className={`grid grid-cols-1 gap-4 ${workspaceView === "list" ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
            {workspaceView === "list" && <div>
              <label className="block mb-1.5" style={{ fontSize: "12px", color: "var(--text-sub)" }}>Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border outline-none"
                style={{ colorScheme: "var(--color-scheme)" as string, fontSize: "13px", background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              />
            </div>}

            <div>
              <label className="block mb-1.5" style={{ fontSize: "12px", color: "var(--text-sub)" }}>Room</label>
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 rounded-lg border outline-none cursor-pointer"
                style={{ fontSize: "13px", background: "var(--bg-main)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
              >
                <option value="">All Rooms</option>
                {roomOptions.map((r) => (
                  <option key={r.cinemaRoomId} value={r.cinemaRoomId}>{r.cinemaRoomName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading && showtimes.length === 0 && workspaceView !== "runs" ? (
        <div className="rounded-2xl border p-12 text-center" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-purple-600" />
          <p style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading schedules...</p>
        </div>
      ) : workspaceView === "operations" ? (
        <ShowtimeOperationsBoard
          showtimes={operationsShowtimes}
          busy={loading}
          readOnly={isReadOnly}
          onEdit={(showtime) => { setEditShowtime(showtime); setModalOpen(true); }}
          onMove={handleMoveShowtime}
          onStatusChange={handleStatusChange}
          onBulkStatusChange={canManageShowtimes ? handleBulkStatusChange : undefined}
          customerPreviewShowtimes={scopedShowtimes}
        />
      ) : workspaceView === "list" ? (
        <ShowtimeTable
          showtimes={scopedShowtimes}
          onEdit={(s) => { setEditShowtime(s); setModalOpen(true); }}
          onDelete={handleDeleteShowtime}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          dateFilter={dateFilter}
          roomFilter={roomFilter}
          onBulkStatusChange={handleBulkStatusChange}
          scopedToOneCinema={Boolean(clusterFilter || scopeClusterId)}
        />
      ) : (
        <GenerationRunsView
          onCreate={() => openAutomaticCreate()}
          onOpenRun={(runId) => openAutomaticCreate(runId)}
        />
      )}

      {canManageShowtimes && <ShowtimeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveShowtime}
        editShowtime={editShowtime}
        presetMovieId={scopeMovieId}
        presetClusterId={scopeClusterId}
      />}

      {canManageShowtimes && <ShowtimeCreateChoiceDialog
        open={createChoiceOpen}
        canGenerate={user?.permissions.includes("SCHEDULE_PLAN_SUBMIT")
          || user?.roles.some((role) => role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN")}
        onClose={() => setCreateChoiceOpen(false)}
        onManual={openManualCreate}
        onAutomatic={() => openAutomaticCreate()}
      />}

      <style>{`
        .hover-row:hover { background-color: rgba(128, 128, 128, 0.04); }
        .theme-dark .hover-row:hover { background-color: rgba(255, 255, 255, 0.03); }
        .action-btn:hover { background-color: rgba(128, 128, 128, 0.1); color: var(--text-main) !important; }
      `}</style>
    </>
  );
}
