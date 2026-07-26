import {
  AlertCircle,
  Check,
  Edit3,
  Languages,
  Loader2,
  MonitorPlay,
  Plus,
  Power,
  PowerOff,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  movieApi,
  type MasterDataItem,
  type MovieScreeningVersionPayload,
  type MovieScreeningVersionResponse,
  type ScreeningFormatResponse,
} from "../../../api/movieApi";

type Props = {
  movieId: number | null;
  originalLanguage: string;
  formats: ScreeningFormatResponse[];
  canManage: boolean;
  movieEditable: boolean;
  hasUnsavedMovieChanges: boolean;
};

type EditorState = {
  versionId: number | null;
  formatId: number | "";
  audioFormatId: number | "";
  audioLanguageCode: string;
  subtitleLanguageCode: string;
  effectiveFrom: string;
  effectiveTo: string;
};

const emptyEditor = (
  formatId: number | "",
  audioFormatId: number | "",
  originalLanguage: string,
): EditorState => ({
  versionId: null,
  formatId,
  audioFormatId,
  audioLanguageCode: originalLanguage || "und",
  subtitleLanguageCode: "",
  effectiveFrom: "",
  effectiveTo: "",
});

function apiErrorMessage(error: unknown): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "The request could not be completed.";
}

const statusStyle = {
  ACTIVE: { label: "Active", color: "#059669", background: "rgba(16,185,129,0.12)" },
  INACTIVE: { label: "Inactive", color: "#6b7280", background: "rgba(107,114,128,0.12)" },
  SUPERSEDED: { label: "Superseded", color: "#d97706", background: "rgba(245,158,11,0.12)" },
} as const;

export default function ScreeningVersionsSection({
  movieId,
  originalLanguage,
  formats,
  canManage,
  movieEditable,
  hasUnsavedMovieChanges,
}: Props) {
  const [versions, setVersions] = useState<MovieScreeningVersionResponse[]>([]);
  const [audioFormats, setAudioFormats] = useState<MasterDataItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const presentationFormats = useMemo(
    () => formats.filter((format) => format.formatCode.toUpperCase() !== "ATMOS"),
    [formats],
  );

  const load = useCallback(async () => {
    if (!movieId) {
      setVersions([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await movieApi.listMovieScreeningVersions(movieId);
      setVersions(response.result ?? []);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [movieId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    movieApi.getRoomMasterData()
      .then((response) => {
        if (active) {
          setAudioFormats((response.result?.audioFormats ?? []).filter((item) => item.active !== false));
        }
      })
      .catch(() => {
        if (active) setError("Audio format catalogue could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  const startCreate = () => {
    setError("");
    setEditor(emptyEditor(
      presentationFormats[0]?.formatId ?? "",
      audioFormats[0]?.id ?? "",
      originalLanguage,
    ));
  };

  const startEdit = (version: MovieScreeningVersionResponse) => {
    setError("");
    setEditor({
      versionId: version.screeningVersionId,
      formatId: version.formatId,
      audioFormatId: version.audioFormatId ?? "",
      audioLanguageCode: version.audioLanguageCode,
      subtitleLanguageCode: version.subtitleLanguageCode ?? "",
      effectiveFrom: version.effectiveFrom ?? "",
      effectiveTo: version.effectiveTo ?? "",
    });
  };

  const submit = async () => {
    if (!movieId || !editor || !editor.formatId || !editor.audioFormatId || !editor.audioLanguageCode.trim()) {
      setError("Presentation format, audio format and audio language are required.");
      return;
    }
    if (editor.effectiveFrom && editor.effectiveTo && editor.effectiveTo < editor.effectiveFrom) {
      setError("Effective to must be on or after effective from.");
      return;
    }

    const payload: MovieScreeningVersionPayload = {
      formatId: editor.formatId,
      audioFormatId: editor.audioFormatId,
      audioLanguageCode: editor.audioLanguageCode.trim(),
      subtitleLanguageCode: editor.subtitleLanguageCode.trim() || null,
      effectiveFrom: editor.effectiveFrom || null,
      effectiveTo: editor.effectiveTo || null,
    };

    setSaving(true);
    setError("");
    try {
      if (editor.versionId) {
        await movieApi.updateMovieScreeningVersion(movieId, editor.versionId, payload);
        toast.success("Screening version updated.");
      } else {
        await movieApi.createMovieScreeningVersion(movieId, payload);
        toast.success("Screening version created.");
      }
      setEditor(null);
      await load();
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (version: MovieScreeningVersionResponse) => {
    if (!movieId) return;
    setSaving(true);
    setError("");
    try {
      if (version.status === "ACTIVE") {
        await movieApi.deactivateMovieScreeningVersion(movieId, version.screeningVersionId);
        toast.success("Version deactivated. Existing schedules remain unchanged.");
      } else {
        await movieApi.activateMovieScreeningVersion(movieId, version.screeningVersionId);
        toast.success("Version activated for future scheduling.");
      }
      await load();
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  if (!movieId) {
    return (
      <div
        className="flex items-start gap-3 rounded-xl border px-4 py-4"
        style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}
      >
        <MonitorPlay size={18} className="mt-0.5 flex-shrink-0 text-blue-500" />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Save the movie draft first</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-sub)" }}>
            Save the draft first, then define the exact presentation, audio system and language combination used for exhibition.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Exhibition-ready versions</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed" style={{ color: "var(--text-sub)" }}>
            A version is the exact format, audio and subtitle combination used by availability plans and showtimes.
          </p>
        </div>
        {canManage && movieEditable && (
          <button
            type="button"
            onClick={startCreate}
            disabled={presentationFormats.length === 0 || audioFormats.length === 0 || saving || hasUnsavedMovieChanges}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={14} /> Add version
          </button>
        )}
      </div>

      {(presentationFormats.length === 0 || audioFormats.length === 0) && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertCircle size={14} />
          Presentation and audio catalogues must both contain at least one active option before a version can be created.
        </div>
      )}

      {hasUnsavedMovieChanges && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <AlertCircle size={14} />
          Save the movie draft before adding or editing screening versions.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {editor && (
        <div
          className="rounded-xl border p-4"
          style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Languages size={16} className="text-blue-500" />
              <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                {editor.versionId ? "Edit screening version" : "New screening version"}
              </p>
            </div>
            <button type="button" onClick={() => setEditor(null)} aria-label="Close version editor">
              <X size={16} style={{ color: "var(--text-sub)" }} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs" style={{ color: "var(--text-sub)" }}>
              Presentation format <span className="text-rose-500">*</span>
              <select
                value={editor.formatId}
                onChange={(event) => setEditor({ ...editor, formatId: Number(event.target.value) })}
                disabled={Boolean(editor.versionId && versions.find((item) => item.screeningVersionId === editor.versionId)?.referenced)}
                className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm disabled:opacity-60"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
              >
                <option value="">Select presentation format</option>
                {presentationFormats.map((format) => (
                  <option key={format.formatId} value={format.formatId}>{format.formatCode} — {format.formatName}</option>
                ))}
              </select>
            </label>

            <label className="text-xs" style={{ color: "var(--text-sub)" }}>
              Audio format <span className="text-rose-500">*</span>
              <select
                value={editor.audioFormatId}
                onChange={(event) => setEditor({ ...editor, audioFormatId: Number(event.target.value) })}
                disabled={Boolean(editor.versionId && versions.find((item) => item.screeningVersionId === editor.versionId)?.referenced)}
                className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm disabled:opacity-60"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
              >
                <option value="">Select audio format</option>
                {audioFormats.map((format) => (
                  <option key={format.id} value={format.id}>{format.code} — {format.name}</option>
                ))}
              </select>
            </label>

            <label className="text-xs" style={{ color: "var(--text-sub)" }}>
              Audio language <span className="text-rose-500">*</span>
              <input
                value={editor.audioLanguageCode}
                onChange={(event) => setEditor({ ...editor, audioLanguageCode: event.target.value })}
                disabled={Boolean(editor.versionId && versions.find((item) => item.screeningVersionId === editor.versionId)?.referenced)}
                placeholder="vi"
                maxLength={10}
                className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm disabled:opacity-60"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
              />
            </label>

            <label className="text-xs" style={{ color: "var(--text-sub)" }}>
              Subtitle language
              <input
                value={editor.subtitleLanguageCode}
                onChange={(event) => setEditor({ ...editor, subtitleLanguageCode: event.target.value })}
                disabled={Boolean(editor.versionId && versions.find((item) => item.screeningVersionId === editor.versionId)?.referenced)}
                placeholder="None"
                maxLength={10}
                className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm disabled:opacity-60"
                style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs" style={{ color: "var(--text-sub)" }}>
                Effective from
                <input
                  type="date"
                  value={editor.effectiveFrom}
                  onChange={(event) => setEditor({ ...editor, effectiveFrom: event.target.value })}
                  disabled={Boolean(editor.versionId && versions.find((item) => item.screeningVersionId === editor.versionId)?.referenced)}
                  className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm disabled:opacity-60"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
                />
              </label>
              <label className="text-xs" style={{ color: "var(--text-sub)" }}>
                Effective to
                <input
                  type="date"
                  value={editor.effectiveTo}
                  onChange={(event) => setEditor({ ...editor, effectiveTo: event.target.value })}
                  disabled={Boolean(editor.versionId && versions.find((item) => item.screeningVersionId === editor.versionId)?.referenced)}
                  className="mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm disabled:opacity-60"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-main)" }}
                />
              </label>
            </div>
          </div>

          {editor.versionId && versions.find((item) => item.screeningVersionId === editor.versionId)?.referenced && (
            <p className="mt-3 text-xs text-amber-600">
              This version is already referenced and is immutable. Deactivate it and create a replacement to change its identity.
            </p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditor(null)}
              className="rounded-lg border px-3 py-2 text-xs font-semibold"
              style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || Boolean(editor.versionId && versions.find((item) => item.screeningVersionId === editor.versionId)?.referenced)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {editor.versionId ? "Save changes" : "Create version"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-blue-500" /></div>
      ) : versions.length === 0 ? (
        <div
          className="rounded-xl border border-dashed px-4 py-8 text-center"
          style={{ borderColor: "var(--border-color)", color: "var(--text-sub)" }}
        >
          <MonitorPlay size={22} className="mx-auto mb-2" />
          <p className="text-sm font-medium">No screening versions yet</p>
          <p className="mt-1 text-xs">Add a presentation, audio and language combination for scheduling.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {versions.map((version) => {
            const status = statusStyle[version.status];
            return (
              <article
                key={version.screeningVersionId}
                className="rounded-xl border p-4"
                style={{ background: "var(--bg-main)", borderColor: "var(--border-color)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-blue-600 px-2 py-1 text-xs font-bold text-white">{version.formatCode}</span>
                      <span className="rounded-md bg-violet-500/10 px-2 py-1 text-xs font-bold text-violet-500">
                        {version.audioFormatCode || "Audio not set"}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                        Audio {version.audioLanguageCode.toUpperCase()}
                        {version.subtitleLanguageCode ? ` · Sub ${version.subtitleLanguageCode.toUpperCase()}` : " · No subtitles"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs" style={{ color: "var(--text-sub)" }}>
                      {version.effectiveFrom || version.effectiveTo
                        ? `${version.effectiveFrom || "Open"} → ${version.effectiveTo || "Open"}`
                        : "No effective-date restriction"}
                    </p>
                    {!version.audioFormatId && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600">
                        <AlertCircle size={13} /> Legacy version: select an audio format before activation.
                      </p>
                    )}
                  </div>
                  <span
                    className="rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: status.color, background: status.background }}
                  >
                    {status.label}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-color)" }}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Compatible capacity</p>
                    <p className="mt-1 text-xs font-semibold" style={{ color: "var(--text-main)" }}>
                      {version.compatibleRoomCount} rooms · {version.compatibleClusterCount} cinemas
                    </p>
                  </div>
                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-color)" }}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-sub)" }}>Usage</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-main)" }}>
                      {version.referenced ? <ShieldCheck size={13} className="text-amber-500" /> : <Check size={13} className="text-emerald-500" />}
                      {version.referenceCount} references
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="mt-3 flex justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
                    {movieEditable && (
                      <button
                        type="button"
                        onClick={() => startEdit(version)}
                        disabled={version.referenced || hasUnsavedMovieChanges}
                        title={version.referenced ? "Referenced versions cannot be rewritten" : "Edit version"}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ borderColor: "var(--border-color)", color: "var(--text-main)" }}
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                    )}
                    {version.status !== "SUPERSEDED" && (
                      <button
                        type="button"
                        onClick={() => void changeStatus(version)}
                        disabled={saving || hasUnsavedMovieChanges || (version.status !== "ACTIVE" && !movieEditable)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          borderColor: version.status === "ACTIVE" ? "rgba(245,158,11,0.45)" : "rgba(16,185,129,0.45)",
                          color: version.status === "ACTIVE" ? "#d97706" : "#059669",
                        }}
                      >
                        {version.status === "ACTIVE" ? <PowerOff size={13} /> : <Power size={13} />}
                        {version.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
