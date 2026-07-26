import { X, CalendarClock, AlertCircle, RefreshCw } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  type ShowtimeResponse,
  type ShowtimeAssignPayload,
  type ShowtimeUpdatePayload,
} from "../api/showtimeApi";
import { movieApi, type MovieApiResponse, type RoomResponse } from "../api/movieApi";
import { isRoomSchedulable } from "../utils/showtimeEligibility";

type FormState = {
  movieId: number;
  cinemaRoomId: number;
  showDate: string;
  startTime: string;
  basePrice: string; // string for input; sent as number only when > 0
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: ShowtimeAssignPayload | ShowtimeUpdatePayload) => Promise<void>;
  editShowtime?: ShowtimeResponse | null;
  /** Pre-select this movie when opening for a new showtime (e.g. deep-linked from a
   *  release plan's "Schedule shows" action). Ignored when editing an existing showtime. */
  presetMovieId?: number | null;
  /** Narrow the room list to this cinema cluster when opening for a new showtime,
   *  and default the room selection to a room in that cluster if one is schedulable. */
  presetClusterId?: number | null;
};

const EMPTY_FORM: FormState = {
  movieId: 0,
  cinemaRoomId: 0,
  showDate: "",
  startTime: "",
  basePrice: "",
};

export function ShowtimeModal({ open, onClose, onSave, editShowtime, presetMovieId, presetClusterId }: Props) {
  const [movies, setMovies]   = useState<MovieApiResponse[]>([]);
  const [rooms, setRooms]     = useState<RoomResponse[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);

  // Load movies + rooms once when modal opens
  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);

    setLoadingData(true);
    Promise.all([
      movieApi.getAllMovies().catch(() => ({ result: [] as MovieApiResponse[] })),
      movieApi.getRooms().catch(() => ({ result: [] as RoomResponse[] })),
    ]).then(([movRes, roomRes]) => {
      const movList  = (movRes as any)?.result ?? [];
      const roomList: RoomResponse[] = (roomRes as any)?.result ?? [];
      const schedulableRooms = roomList.filter(isRoomSchedulable);
      setMovies(movList);
      setRooms(schedulableRooms);

      // Populate form
      if (editShowtime) {
        setForm({
          movieId:     editShowtime.movieId,
          cinemaRoomId: editShowtime.cinemaRoomId,
          showDate:    editShowtime.showDate,
          startTime:   editShowtime.startTime.slice(0, 5), // "HH:mm:ss" → "HH:mm"
          basePrice:   "",
        });
      } else {
        // When deep-linked (e.g. "Schedule shows" from a movie's release plan), default
        // to the requested movie/cluster instead of just the first item in each list.
        const clusterRooms = presetClusterId
          ? schedulableRooms.filter((r) => r.clusterId === presetClusterId)
          : [];
        const defaultRoomPool = clusterRooms.length > 0 ? clusterRooms : schedulableRooms;
        const defaultMovieId = presetMovieId && movList.some((m: MovieApiResponse) => m.movieId === presetMovieId)
          ? presetMovieId
          : movList[0]?.movieId ?? 0;
        setForm({
          ...EMPTY_FORM,
          movieId:     defaultMovieId,
          cinemaRoomId: defaultRoomPool[0]?.cinemaRoomId ?? 0,
        });
      }
    }).finally(() => setLoadingData(false));
  }, [open, editShowtime, presetMovieId, presetClusterId]);

  if (!open) return null;

  const set = (field: keyof FormState, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.movieId || !form.cinemaRoomId || !form.showDate || !form.startTime) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const basePriceNum = form.basePrice ? Number(form.basePrice) : undefined;

      const payload = editShowtime
        ? ({
            movieId:     form.movieId     || undefined,
            cinemaRoomId: form.cinemaRoomId || undefined,
            showDate:    form.showDate    || undefined,
            startTime:   form.startTime   || undefined,
          } as ShowtimeUpdatePayload)
        : ({
            movieId:     form.movieId,
            cinemaRoomId: form.cinemaRoomId,
            showDate:    form.showDate,
            startTime:   form.startTime,
            basePrice:   basePriceNum && basePriceNum > 0 ? basePriceNum : undefined,
          } as ShowtimeAssignPayload);

      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as { message?: string })?.message ??
        "An error occurred while saving.";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    colorScheme: "var(--color-scheme)" as string,
    fontSize: "14px",
    background: "var(--bg-card)",
    color: "var(--text-main)",
    borderColor: "var(--border-color)",
  };

  // For the "end time calculated automatically" hint
  const selectedMovie = useMemo(
    () => movies.find((m) => m.movieId === form.movieId),
    [movies, form.movieId]
  );

  // Narrow the room picker to the deep-linked cluster (new showtimes only); fall back to
  // every schedulable room if that cluster happens to have none.
  const roomsForSelect = useMemo(() => {
    if (editShowtime || !presetClusterId) return rooms;
    const clusterRooms = rooms.filter((r) => r.clusterId === presetClusterId);
    return clusterRooms.length > 0 ? clusterRooms : rooms;
  }, [rooms, presetClusterId, editShowtime]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ background: "var(--bg-main)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <CalendarClock size={16} className="text-purple-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {editShowtime ? "Edit Showtime" : "Schedule New Showtime"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            style={{ color: "var(--text-sub)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl border border-rose-200 bg-rose-50 flex items-start gap-2 text-rose-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p style={{ fontSize: "13px" }}>{errorMsg}</p>
          </div>
        )}

        {loadingData ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw size={18} className="animate-spin text-purple-600" />
            <span style={{ fontSize: "14px", color: "var(--text-sub)" }}>Loading movies and rooms…</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Movie */}
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Movie <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.movieId}
                onChange={e => set("movieId", Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
                style={inputStyle}
              >
                <option value={0} disabled>Choose a movie…</option>
                {movies.map(m => (
                  <option key={m.movieId} value={m.movieId} style={{ background: "var(--bg-card)" }}>
                    {m.movieNameEnglish || m.movieNameVn}
                    {m.duration ? ` (${m.duration}m)` : ""}
                  </option>
                ))}
              </select>
              {selectedMovie && (
                <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "4px" }}>
                  End time is calculated automatically from movie duration.
                </p>
              )}
            </div>

            {/* Room */}
            <div>
              <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                Screening Room <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.cinemaRoomId}
                onChange={e => set("cinemaRoomId", Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors appearance-none cursor-pointer"
                style={inputStyle}
              >
                <option value={0} disabled>Choose a room…</option>
                {roomsForSelect.map(r => (
                  <option key={r.cinemaRoomId} value={r.cinemaRoomId} style={{ background: "var(--bg-card)" }}>
                    {r.cinemaRoomName} · {r.seatQuantity} seats
                  </option>
                ))}
              </select>
              {rooms.length === 0 ? (
                <p className="mt-1.5 text-xs text-amber-600">
                  No schedulable room is available. Activate a room and its sellable seat layout first.
                </p>
              ) : (
                <p className="mt-1.5" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                  Only ACTIVE rooms with an ACTIVE sellable seat layout are shown.
                </p>
              )}
            </div>

            {/* Show Date + Start Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                  Show Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.showDate}
                  onChange={e => set("showDate", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={form.startTime}
                  onChange={e => set("startTime", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Base Price — create only, optional */}
            {!editShowtime && (
              <div>
                <label className="block mb-1.5" style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                  Base Price (VND){" "}
                  <span style={{ fontSize: "11px", fontWeight: 400, color: "var(--text-sub)" }}>(optional — leave blank to use room defaults)</span>
                </label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  placeholder="e.g. 90000"
                  value={form.basePrice}
                  onChange={e => set("basePrice", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-purple-400 transition-colors"
                  style={inputStyle}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
                style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)", background: "transparent" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ fontSize: "14px", fontWeight: 500 }}
              >
                {submitting && <RefreshCw size={14} className="animate-spin" />}
                {submitting ? "Saving…" : editShowtime ? "Update Schedule" : "Schedule Movie"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
