import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

type Props = {
  src?: string | null;
  alt: string;
  aspectRatio?: string;
  /** Shown in the placeholder box when there is no asset selected yet. */
  emptyLabel: string;
  className?: string;
};

/**
 * `[Frontend] Consolidate movie assets into a dedicated Media section`: a plain `<img>` with a
 * broken `src` just renders the browser's own broken-image icon - no group in the Media section
 * (poster, backdrop, gallery) should ever look like that. This renders one consistent, explicit
 * fallback box for both "nothing selected yet" and "selected but the URL doesn't load".
 */
export function MediaThumbnail({ src, alt, aspectRatio = "2 / 3", emptyLabel, className }: Props) {
  const [broken, setBroken] = useState(false);

  // A new src (operator picked a different asset) deserves a fresh chance to load,
  // not the previous asset's broken state.
  useEffect(() => setBroken(false), [src]);

  if (!src || broken) {
    return (
      <div
        role="img"
        aria-label={broken ? `${alt} preview unavailable` : `${alt} - no asset selected`}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed ${className ?? ""}`}
        style={{ aspectRatio, borderColor: "var(--border-color)", background: "var(--bg-main)" }}
      >
        {broken && <ImageOff size={20} style={{ color: "var(--text-sub)" }} />}
        <span style={{ fontSize: "11.5px", color: "var(--text-sub)", textAlign: "center", padding: "0 8px" }}>
          {broken ? "Preview unavailable" : emptyLabel}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className={`w-full rounded-xl border object-cover ${className ?? ""}`}
      style={{ aspectRatio, borderColor: "var(--border-color)" }}
    />
  );
}
