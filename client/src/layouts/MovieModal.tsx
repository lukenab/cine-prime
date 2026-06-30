import { X, Film, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import {
  movieApi,
  MovieApiResponse, TypeResponse, RoomResponse,
  CreateMoviePayload, UpdateMoviePayload, todayPlusDays,
} from "../api/movieApi";

type ShowTimeRow = {
  cinemaRoomId: string; // "" when unselected so HTML required validation works
  showDate: string;
  startTime: string;
};

type FormState = {
  movieNameEnglish: string;
  movieNameVn: string;
  director: string;
  actor: string;
  duration: number;
  content: string;
  version: string;
  status: boolean;
  movieProductionCompany: string;
  largeImage: string;
  smallImage: string;
  typeIds: number[];
  showTimes: ShowTimeRow[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateMoviePayload) => Promise<void>;
  onUpdate: (id: number, data: UpdateMoviePayload) => Promise<void>;
  editMovie?: MovieApiResponse | null;
  types: TypeResponse[];
  rooms: RoomResponse[];
};

const VERSIONS = ["2D Standard", "3D", "IMAX", "4DX"];

const defaultForm: FormState = {
  movieNameEnglish: "",
  movieNameVn: "",
  director: "",
  actor: "",
  duration: 120,
  content: "",
  version: "2D Standard",
  status: true,
  movieProductionCompany: "",
  largeImage: "",
  smallImage: "",
  typeIds: [],
  showTimes: [{ cinemaRoomId: "", showDate: todayPlusDays(3), startTime: "10:00" }],
};

function movieToForm(movie: MovieApiResponse, types: TypeResponse[]): FormState {
  const ids = types
    .filter((t) => movie.movieType?.includes(t.typeName))
    .map((t) => Number(t.typeId));
  return {
    movieNameEnglish: movie.movieNameEnglish ?? "",
    movieNameVn: movie.movieNameVn ?? "",
    director: movie.director ?? "",
    actor: movie.actor ?? "",
    duration: movie.duration ?? 120,
    content: movie.content ?? "",
    version: movie.version ?? "2D Standard",
    status: movie.status ?? true,
    movieProductionCompany: movie.movieProductionCompany ?? "",
    largeImage: movie.largeImage ?? "",
    smallImage: movie.smallImage ?? "",
    typeIds: ids,
    showTimes: [{ cinemaRoomId: "", showDate: todayPlusDays(3), startTime: "10:00" }],
  };
}

export function MovieModal({ open, onClose, onCreate, onUpdate, editMovie, types, rooms }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<"largeImage" | "smallImage" | null>(null);
  const [uploadError, setUploadError] = useState("");

  // Reset form fields when modal opens or editMovie changes
  useEffect(() => {
    if (!open) return;
    setForm(editMovie ? movieToForm(editMovie, types) : defaultForm);
  }, [open, editMovie]);

  // Re-map typeIds once types finish loading (handles the race condition)
  useEffect(() => {
    if (!open || !editMovie || types.length === 0) return;
    const ids = types
      .filter((t) => editMovie.movieType?.includes(t.typeName))
      .map((t) => Number(t.typeId));
    setForm((prev) => ({ ...prev, typeIds: ids }));
  }, [types, editMovie, open]);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const toggleType = (id: number) =>
    set(
      "typeIds",
      form.typeIds.includes(id)
        ? form.typeIds.filter((x) => x !== id)
        : [...form.typeIds, id],
    );

  const addShowTime = () =>
    set("showTimes", [
      ...form.showTimes,
      { cinemaRoomId: "", showDate: todayPlusDays(3), startTime: "10:00" },
    ]);

  const removeShowTime = (i: number) =>
    set("showTimes", form.showTimes.filter((_, idx) => idx !== i));

  const setShowTime = (i: number, field: keyof ShowTimeRow, val: string) =>
    set(
      "showTimes",
      form.showTimes.map((st, idx) => (idx === i ? { ...st, [field]: val } : st)),
    );

  const handleImageUpload = async (field: "largeImage" | "smallImage", file?: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setUploadError("Please choose a JPG, PNG, or WebP image up to 5MB.");
      return;
    }

    setUploadError("");
    setUploadingImage(field);
    try {
      const res = await movieApi.uploadImage(file);
      const url = res.result?.secureUrl || res.result?.url;
      if (!url) throw new Error("Missing uploaded image URL");
      set(field, url as FormState[typeof field]);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Image upload failed. Please try again.";
      setUploadError(msg);
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (form.typeIds.length === 0) {
      alert("Please select at least one genre.");
      return;
    }
    setSubmitting(true);
    try {
      if (editMovie) {
        const payload: UpdateMoviePayload = {
          movieNameEnglish: form.movieNameEnglish,
          movieNameVn: form.movieNameVn,
          director: form.director,
          actor: form.actor,
          duration: form.duration,
          content: form.content,
          version: form.version,
          status: form.status,
          movieProductionCompany: form.movieProductionCompany,
          ...(form.largeImage && { largeImage: form.largeImage }),
          ...(form.smallImage && { smallImage: form.smallImage }),
          ...(form.typeIds.length > 0 && { typeIds: form.typeIds }),
        };
        await onUpdate(editMovie.movieId, payload);
      } else {
        const payload: CreateMoviePayload = {
          movieNameEnglish: form.movieNameEnglish,
          movieNameVn: form.movieNameVn,
          director: form.director,
          actor: form.actor,
          duration: form.duration,
          content: form.content,
          version: form.version,
          status: form.status,
          movieProductionCompany: form.movieProductionCompany,
          largeImage: form.largeImage,
          smallImage: form.smallImage,
          typeIds: form.typeIds,
          showTimes: form.showTimes.map((st) => ({
            cinemaRoomId: Number(st.cinemaRoomId),
            showDate: st.showDate,
            startTime: st.startTime,
            })),
        };
        await onCreate(payload);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    fontSize: "14px",
    background: "var(--bg-main)",
    color: "var(--text-main)",
    border: "1px solid var(--border-color)",
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-sub)",
    marginBottom: "12px",
  };
  const fieldLabel: React.CSSProperties = {
    fontSize: "13px",
    color: "var(--text-sub)",
    display: "block",
    marginBottom: "6px",
  };
  const inputClass = "w-full px-3.5 py-2.5 rounded-xl border outline-none focus:border-blue-400 transition-colors";
  const minDate = todayPlusDays(3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--bg-main)", maxHeight: "90vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Film size={16} className="text-blue-600" />
            </div>
            <h2 style={{ fontSize: "16px", color: "var(--text-main)", fontWeight: 600 }}>
              {editMovie ? "Edit Movie" : "Add New Movie"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            style={{ color: "var(--text-sub)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* ── Movie Info ── */}
          <div>
            <p style={sectionLabel}>Movie Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={fieldLabel}>English Title <span className="text-rose-500">*</span></label>
                <input
                  required type="text" placeholder="e.g. Dune: Part Two"
                  value={form.movieNameEnglish}
                  onChange={(e) => set("movieNameEnglish", e.target.value)}
                  className={inputClass} style={inputStyle}
                />
              </div>
              <div>
                <label style={fieldLabel}>Vietnamese Title <span className="text-rose-500">*</span></label>
                <input
                  required type="text" placeholder="e.g. Cát Bụi Vũ Trụ"
                  value={form.movieNameVn}
                  onChange={(e) => set("movieNameVn", e.target.value)}
                  className={inputClass} style={inputStyle}
                />
              </div>
              <div>
                <label style={fieldLabel}>Director <span className="text-rose-500">*</span></label>
                <input
                  required type="text" placeholder="e.g. Denis Villeneuve"
                  value={form.director}
                  onChange={(e) => set("director", e.target.value)}
                  className={inputClass} style={inputStyle}
                />
              </div>
              <div>
                <label style={fieldLabel}>Actor(s) <span className="text-rose-500">*</span></label>
                <input
                  required type="text" placeholder="e.g. Timothée Chalamet"
                  value={form.actor}
                  onChange={(e) => set("actor", e.target.value)}
                  className={inputClass} style={inputStyle}
                />
              </div>
              <div>
                <label style={fieldLabel}>Duration (mins) <span className="text-rose-500">*</span></label>
                <input
                  required type="number" min="1"
                  value={form.duration}
                  onChange={(e) => set("duration", parseInt(e.target.value) || 0)}
                  className={inputClass} style={inputStyle}
                />
              </div>
              <div>
                <label style={fieldLabel}>Format / Version <span className="text-rose-500">*</span></label>
                <select
                  value={form.version}
                  onChange={(e) => set("version", e.target.value)}
                  className={inputClass + " appearance-none cursor-pointer"} style={inputStyle}
                >
                  {VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Production Company <span className="text-rose-500">*</span></label>
                <input
                  required type="text" placeholder="e.g. Warner Bros."
                  value={form.movieProductionCompany}
                  onChange={(e) => set("movieProductionCompany", e.target.value)}
                  className={inputClass} style={inputStyle}
                />
              </div>
              <div>
                <label style={fieldLabel}>Status <span className="text-rose-500">*</span></label>
                <select
                  value={form.status ? "true" : "false"}
                  onChange={(e) => set("status", e.target.value === "true")}
                  className={inputClass + " appearance-none cursor-pointer"} style={inputStyle}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Synopsis ── */}
          <div>
            <p style={sectionLabel}>Synopsis</p>
            <textarea
              required rows={3} placeholder="Brief synopsis of the movie..."
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              className={inputClass + " resize-none"} style={inputStyle}
            />
          </div>

          {/* ── Poster Images ── */}
          <div>
            <p style={sectionLabel}>Poster Images</p>
            {uploadError && (
              <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {uploadError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={fieldLabel}>
                  Large Poster {!editMovie && <span className="text-rose-500">*</span>}
                </label>
                <input
                  required={!editMovie}
                  type="text" placeholder="https://…/large.jpg"
                  value={form.largeImage}
                  onChange={(e) => set("largeImage", e.target.value)}
                  className={inputClass} style={inputStyle}
                />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleImageUpload("largeImage", e.target.files?.[0])}
                  className={inputClass + " mt-2"} style={inputStyle}
                />
                {uploadingImage === "largeImage" && (
                  <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "4px" }}>
                    Uploading...
                  </p>
                )}
                {form.largeImage && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={form.largeImage} alt="Large poster preview" className="h-16 w-12 rounded-md object-cover border" style={{ borderColor: "var(--border-color)" }} />
                    <p className="min-w-0 flex-1 truncate" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                      {form.largeImage}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label style={fieldLabel}>
                  Small Poster {!editMovie && <span className="text-rose-500">*</span>}
                </label>
                <input
                  required={!editMovie}
                  type="text" placeholder="https://…/small.jpg"
                  value={form.smallImage}
                  onChange={(e) => set("smallImage", e.target.value)}
                  className={inputClass} style={inputStyle}
                />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleImageUpload("smallImage", e.target.files?.[0])}
                  className={inputClass + " mt-2"} style={inputStyle}
                />
                {uploadingImage === "smallImage" && (
                  <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "4px" }}>
                    Uploading...
                  </p>
                )}
                {form.smallImage && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={form.smallImage} alt="Small poster preview" className="h-16 w-12 rounded-md object-cover border" style={{ borderColor: "var(--border-color)" }} />
                    <p className="min-w-0 flex-1 truncate" style={{ fontSize: "11px", color: "var(--text-sub)" }}>
                      {form.smallImage}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Genres ── */}
          <div>
            <p style={sectionLabel}>Genres <span className="text-rose-500">*</span></p>
            {types.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Loading genres…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {types.map((t) => {
                  const selected = form.typeIds.includes(Number(t.typeId));
                  return (
                    <button
                      key={t.typeId} type="button"
                      onClick={() => toggleType(Number(t.typeId))}
                      className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                      style={{
                        background: selected ? "#2563eb" : "transparent",
                        color: selected ? "#fff" : "var(--text-sub)",
                        borderColor: selected ? "#2563eb" : "var(--border-color)",
                      }}
                    >
                      {t.typeName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Showtimes — CREATE only ── */}
          {!editMovie && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p style={sectionLabel}>
                  Showtimes <span className="text-rose-500">*</span>
                </p>
                <button
                  type="button" onClick={addShowTime}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-blue-600 border border-blue-200 hover:bg-blue-50 text-xs font-medium transition-colors"
                >
                  <Plus size={12} /> Add Row
                </button>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-sub)", marginBottom: "10px" }}>
                Must be ≥ 3 days from today · Cinema hours: 08:00 – 23:00
              </p>
              <div className="space-y-3">
                {form.showTimes.map((st, i) => (
                  <div
                    key={i}
                    className="flex items-end gap-2 p-3 rounded-xl border"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
                  >
                    <div className="flex-1">
                      <label style={{ ...fieldLabel, marginBottom: "4px" }}>Cinema Room</label>
                      <select
                        required
                        value={st.cinemaRoomId}
                        onChange={(e) => setShowTime(i, "cinemaRoomId", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border outline-none focus:border-blue-400 text-sm appearance-none cursor-pointer"
                        style={inputStyle}
                      >
                        <option value="">Select room…</option>
                        {rooms.map((r) => (
                          <option key={r.cinemaRoomId} value={r.cinemaRoomId}>
                            {r.cinemaRoomName} ({r.seatQuantity} seats)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...fieldLabel, marginBottom: "4px" }}>Date</label>
                      <input
                        required type="date" min={minDate}
                        value={st.showDate}
                        onChange={(e) => setShowTime(i, "showDate", e.target.value)}
                        className="px-3 py-2 rounded-lg border outline-none focus:border-blue-400 text-sm"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ ...fieldLabel, marginBottom: "4px" }}>Start Time</label>
                      <input
                        required type="time" min="08:00" max="23:00"
                        value={st.startTime}
                        onChange={(e) => setShowTime(i, "startTime", e.target.value)}
                        className="px-3 py-2 rounded-lg border outline-none focus:border-blue-400 text-sm"
                        style={inputStyle}
                      />
                    </div>
                    {form.showTimes.length > 1 && (
                      <button
                        type="button" onClick={() => removeShowTime(i)}
                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex gap-3 pt-1 pb-1">
            <button
              type="button" onClick={onClose} disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
              style={{ fontSize: "14px", fontWeight: 500 }}
            >
              {submitting ? "Saving…" : editMovie ? "Save Changes" : "Add Movie"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
