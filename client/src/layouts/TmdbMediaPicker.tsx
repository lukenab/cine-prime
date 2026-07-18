import { useEffect, useState } from "react";
import { Check, Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { movieApi, type MovieMediaCandidate, type MovieMediaPreview, type MovieImageType } from "../api/movieApi";

type Props = {
  tmdbId: number;
  media: MovieMediaPreview;
  maxStills?: number;
  /** Present once the movie has been saved - lets "Import Selected" persist immediately.
   *  When absent (still composing a new movie), selections are just handed back via
   *  onPendingSelectionChange so the caller can import right after the movie is created. */
  movieId?: number | null;
  onImported?: () => void;
  onPendingSelectionChange?: (selections: { filePath: string; imageType: MovieImageType }[]) => void;
};

const FL: React.CSSProperties = {
  fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.06em",
  textTransform: "uppercase", color: "var(--text-sub)", marginBottom: "8px",
};

function CandidateThumb({
  candidate, selected, onClick, shape,
}: { candidate: MovieMediaCandidate; selected: boolean; onClick: () => void; shape: "poster" | "wide" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative rounded-lg overflow-hidden border-2 flex-shrink-0 transition-colors"
      style={{
        borderColor: selected ? "#2563eb" : "var(--border-color)",
        width: shape === "poster" ? "72px" : "128px",
        height: shape === "poster" ? "108px" : "72px",
      }}
      title={`${candidate.languageCode || "no language"} · ★${(candidate.voteAverage ?? 0).toFixed(1)}`}
    >
      <img src={candidate.url} alt="" className="w-full h-full object-cover" />
      {selected && (
        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
          <Check size={10} className="text-white" />
        </span>
      )}
      {candidate.recommended && !selected && (
        <span
          className="absolute bottom-1 left-1 px-1 rounded"
          style={{ fontSize: "8px", fontWeight: 700, background: "rgba(37,99,235,0.85)", color: "#fff" }}
        >
          BEST
        </span>
      )}
    </button>
  );
}

/**
 * TMDB-FIX-05: admin picks specific posters/backdrops/stills instead of the app silently
 * importing everything (or, before this issue, copying one poster URL into every field).
 * Recommended candidates (locale/resolution/vote-ranked, computed server-side) are
 * pre-selected but always overridable.
 */
export function TmdbMediaPicker({ tmdbId, media, maxStills = 10, movieId, onImported, onPendingSelectionChange }: Props) {
  const [selectedPoster, setSelectedPoster] = useState<string | null>(media.recommendedPosterPath ?? null);
  const [selectedBackdrop, setSelectedBackdrop] = useState<string | null>(media.recommendedBackdropPath ?? null);
  const [selectedStills, setSelectedStills] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const toggleStill = (filePath: string) => {
    setSelectedStills((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else if (next.size < maxStills) {
        next.add(filePath);
      } else {
        toast.error(`You can select at most ${maxStills} stills.`);
      }
      return next;
    });
  };

  const selections = (): { filePath: string; imageType: MovieImageType }[] => {
    const result: { filePath: string; imageType: MovieImageType }[] = [];
    if (selectedPoster) result.push({ filePath: selectedPoster, imageType: "POSTER" });
    if (selectedBackdrop) result.push({ filePath: selectedBackdrop, imageType: "BACKDROP" });
    selectedStills.forEach((filePath) => result.push({ filePath, imageType: "STILL" }));
    return result;
  };

  useEffect(() => {
    onPendingSelectionChange?.(selections());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPoster, selectedBackdrop, selectedStills]);

  const handleImportNow = async () => {
    if (!movieId) return;
    const chosen = selections();
    if (chosen.length === 0) {
      toast.error("Select at least one image first.");
      return;
    }
    setImporting(true);
    try {
      const res = await movieApi.importTmdbImages(movieId, { tmdbId, selections: chosen });
      toast.success(`Imported ${res.result.importedCount} image(s)${res.result.skippedDuplicateCount ? `, skipped ${res.result.skippedDuplicateCount} already imported` : ""}.`);
      onImported?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Image import failed.");
    } finally {
      setImporting(false);
    }
  };

  const hasAnyCandidate = media.posters.length > 0 || media.backdrops.length > 0;

  return (
    <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      <div className="flex items-center gap-2">
        <ImageIcon size={14} className="text-blue-500" />
        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>TMDB Media</p>
      </div>

      {!hasAnyCandidate && (
        <p style={{ fontSize: "12px", color: "var(--text-sub)" }}>No poster/backdrop candidates available from TMDB for this title.</p>
      )}

      {media.posters.length > 0 && (
        <div>
          <p style={FL}>Poster (pick 1)</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {media.posters.map((c) => (
              <CandidateThumb
                key={c.filePath} candidate={c} shape="poster"
                selected={selectedPoster === c.filePath}
                onClick={() => setSelectedPoster(selectedPoster === c.filePath ? null : c.filePath)}
              />
            ))}
          </div>
        </div>
      )}

      {media.backdrops.length > 0 && (
        <div>
          <p style={FL}>Backdrop (pick 1)</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {media.backdrops.slice(0, 1 + (media.stills?.length ?? 0)).map((c) => (
              <CandidateThumb
                key={c.filePath} candidate={c} shape="wide"
                selected={selectedBackdrop === c.filePath}
                onClick={() => setSelectedBackdrop(selectedBackdrop === c.filePath ? null : c.filePath)}
              />
            ))}
          </div>
        </div>
      )}

      {media.stills.length > 0 && (
        <div>
          <p style={FL}>Stills ({selectedStills.size}/{maxStills})</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {media.stills.map((c) => (
              <CandidateThumb
                key={c.filePath} candidate={c} shape="wide"
                selected={selectedStills.has(c.filePath)}
                onClick={() => toggleStill(c.filePath)}
              />
            ))}
          </div>
        </div>
      )}

      {movieId && hasAnyCandidate && (
        <button
          type="button"
          onClick={handleImportNow}
          disabled={importing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          style={{ fontSize: "13px" }}
        >
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Import Selected
        </button>
      )}
      {!movieId && hasAnyCandidate && (
        <p style={{ fontSize: "11px", color: "var(--text-sub)" }}>
          Selected images will be imported automatically once you save this movie.
        </p>
      )}
    </div>
  );
}
