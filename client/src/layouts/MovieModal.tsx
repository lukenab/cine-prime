import { X, Film, Upload, Loader2, Check, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import {
  movieApi,
  MovieApiResponse, TypeResponse, RoomResponse,
  CreateMoviePayload, UpdateMoviePayload, todayPlusDays,
} from "../api/movieApi";

type ShowTimeRow = {
  cinemaRoomId: string;
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

export function MovieModal({ open, onClose, onCreate, onUpdate, editMovie, types }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<"largeImage" | "smallImage" | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState("");

  // Wizard steps. Showtime scheduling is handled separately in Showtime Management.
  const steps = ["Details", "Media & Genres"];
  const isLastStep = step === steps.length - 1;

  // Reset form + wizard when modal opens or editMovie changes
  useEffect(() => {
    if (!open) return;
    setForm(editMovie ? movieToForm(editMovie, types) : defaultForm);
    setStep(0);
    setStepError("");
    setUploadError("");
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

  // Validate only the fields visible on the current step
  const validateStep = (): string | null => {
    if (step === 0) {
      if (
        !form.movieNameEnglish.trim() || !form.movieNameVn.trim() ||
        !form.director.trim() || !form.actor.trim() ||
        !form.movieProductionCompany.trim() || !form.content.trim()
      ) return "Please fill in all required fields.";
      if (!form.duration || form.duration < 1) return "Duration must be at least 1 minute.";
    }
    if (step === 1) {
      if (!editMovie && (!form.largeImage || !form.smallImage))
        return "Please provide both the large and small poster.";
      if (form.typeIds.length === 0) return "Please select at least one genre.";
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep();
    if (err) { setStepError(err); return; }
    setStepError("");
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const goBack = () => {
    setStepError("");
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    // Pressing Enter mid-wizard should advance, not submit
    if (!isLastStep) { goNext(); return; }

    const err = validateStep();
    if (err) { setStepError(err); return; }

    setSubmitting(true);
    setStepError("");
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
          // Showtimes are scheduled separately in Showtime Management.
          showTimes: [],
        };
        await onCreate(payload);
      }
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        (editMovie ? "Failed to update the movie. Please try again." : "Failed to create the movie. Please try again.");
      setStepError(msg);
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

  // ── Reusable poster upload zone ──
  const renderPoster = (field: "largeImage" | "smallImage", label: string) => {
    const value = form[field];
    const isUploading = uploadingImage === field;
    return (
      <div>
        <label style={fieldLabel}>
          {label} {!editMovie && <span className="text-rose-500">*</span>}
        </label>

        {value ? (
          <div className="relative rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
            <img src={value} alt={label} className="w-full h-40 object-cover" />
            <button
              type="button"
              onClick={() => set(field, "")}
              title="Remove image"
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center gap-1.5 h-40 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:border-blue-400"
            style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
          >
            {isUploading ? (
              <>
                <Loader2 size={22} className="animate-spin text-blue-500" />
                <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>Uploading…</span>
              </>
            ) : (
              <>
                <Upload size={22} className="text-blue-500" />
                <span style={{ fontSize: "12.5px", color: "var(--text-main)", fontWeight: 500 }}>Click to upload</span>
                <span style={{ fontSize: "11px", color: "var(--text-sub)" }}>JPG · PNG · WebP · ≤ 5MB</span>
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                handleImageUpload(field, e.target.files?.[0]);
                e.currentTarget.value = ""; // allow re-selecting the same file
              }}
            />
          </label>
        )}

        {/* Optional: paste an image URL instead of uploading */}
        <input
          type="text"
          placeholder="or paste an image URL…"
          value={value}
          onChange={(e) => set(field, e.target.value)}
          className={inputClass + " mt-2"}
          style={{ ...inputStyle, fontSize: "12px" }}
        />
      </div>
    );
  };

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

        {/* Step indicator */}
        <div className="flex items-center px-6 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
          {steps.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    background: i <= step ? "#2563eb" : "var(--bg-card)",
                    color: i <= step ? "#fff" : "var(--text-sub)",
                    border: "1px solid " + (i <= step ? "#2563eb" : "var(--border-color)"),
                  }}
                >
                  {i < step ? <Check size={13} /> : i + 1}
                </div>
                <span
                  style={{
                    fontSize: "12.5px",
                    fontWeight: i === step ? 600 : 400,
                    color: i === step ? "var(--text-main)" : "var(--text-sub)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-px mx-3" style={{ background: "var(--border-color)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* ══ STEP 0 — Details ══ */}
          {step === 0 && (
            <>
              <div>
                <p style={sectionLabel}>Movie Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={fieldLabel}>English Title <span className="text-rose-500">*</span></label>
                    <input
                      type="text" placeholder="e.g. Dune: Part Two"
                      value={form.movieNameEnglish}
                      onChange={(e) => set("movieNameEnglish", e.target.value)}
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Vietnamese Title <span className="text-rose-500">*</span></label>
                    <input
                      type="text" placeholder="e.g. Hành Tinh Cát"
                      value={form.movieNameVn}
                      onChange={(e) => set("movieNameVn", e.target.value)}
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Director <span className="text-rose-500">*</span></label>
                    <input
                      type="text" placeholder="e.g. Denis Villeneuve"
                      value={form.director}
                      onChange={(e) => set("director", e.target.value)}
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Actor(s) <span className="text-rose-500">*</span></label>
                    <input
                      type="text" placeholder="e.g. Timothée Chalamet"
                      value={form.actor}
                      onChange={(e) => set("actor", e.target.value)}
                      className={inputClass} style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={fieldLabel}>Duration (mins) <span className="text-rose-500">*</span></label>
                    <input
                      type="number" min="1"
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
                      type="text" placeholder="e.g. Warner Bros."
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

              <div>
                <p style={sectionLabel}>Synopsis</p>
                <textarea
                  rows={3} placeholder="Brief synopsis of the movie..."
                  value={form.content}
                  onChange={(e) => set("content", e.target.value)}
                  className={inputClass + " resize-none"} style={inputStyle}
                />
              </div>
            </>
          )}

          {/* ══ STEP 1 — Media & Genres ══ */}
          {step === 1 && (
            <>
              <div>
                <p style={sectionLabel}>Poster Images</p>
                {uploadError && (
                  <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                    {uploadError}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {renderPoster("largeImage", "Large Poster")}
                  {renderPoster("smallImage", "Small Poster")}
                </div>
              </div>

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
            </>
          )}

        </form>

        {/* Footer — step navigation */}
        <div className="px-6 py-4 border-t flex-shrink-0" style={{ borderColor: "var(--border-color)" }}>
          {stepError && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-rose-600">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <p className="text-xs leading-relaxed">{stepError}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>
              Step {step + 1} of {steps.length}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={step === 0 ? onClose : goBack}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl border transition-colors hover:opacity-80 disabled:opacity-50"
                style={{ fontSize: "14px", borderColor: "var(--border-color)", color: "var(--text-main)" }}
              >
                {step === 0 ? "Cancel" : "Back"}
              </button>
              {isLastStep ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                  style={{ fontSize: "14px", fontWeight: 500 }}
                >
                  {submitting ? "Saving…" : editMovie ? "Save Changes" : "Add Movie"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  style={{ fontSize: "14px", fontWeight: 500 }}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
