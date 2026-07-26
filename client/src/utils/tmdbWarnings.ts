/**
 * `[Frontend] Show TMDB import warnings/mappings/media preview`: classifies the raw warning
 * codes TmdbService returns (see TmdbMovieDetailsResponse.warnings / TmdbImportResponse.warnings
 * on the backend) into a severity + group so the review UI can render them consistently and
 * decide what blocks Save - keyed strictly off the machine-readable code prefix, never by
 * parsing the human-readable message text.
 */

export type WarningSeverity = "INFO" | "WARNING" | "BLOCKING";

export type WarningGroup =
  | "required-metadata"
  | "genre-mapping"
  | "release-rating"
  | "trailer"
  | "poster-backdrop"
  | "upstream";

export type ClassifiedWarning = {
  code: string;
  severity: WarningSeverity;
  group: WarningGroup;
  label: string;
  /** Extra detail parsed out of the code, e.g. the unmapped TMDB genre id or teaser video key. */
  detail?: string;
};

type Rule = {
  match: (code: string) => boolean;
  severity: WarningSeverity;
  group: WarningGroup;
  label: (detail?: string) => string;
};

const RULES: Rule[] = [
  {
    match: (c) => c === "RUNTIME_MISSING",
    severity: "WARNING",
    group: "required-metadata",
    label: () => "TMDB didn't provide a runtime — please verify the duration before saving.",
  },
  {
    match: (c) => c === "AGE_RATING_NOT_AVAILABLE",
    severity: "WARNING",
    group: "release-rating",
    label: () => "TMDB has no recognized Vietnam or US theatrical certification — select and verify an age rating before review.",
  },
  {
    match: (c) => c.startsWith("GENRE_UNMAPPED:"),
    severity: "BLOCKING",
    group: "genre-mapping",
    label: () => "A TMDB genre has no local match yet — map it, create it, or ignore it below.",
  },
  {
    match: (c) => c.startsWith("GENRE_IGNORED:"),
    severity: "INFO",
    group: "genre-mapping",
    label: (detail) => `Genre ignored: ${detail?.split(":").slice(1).join(":") || "no reason given"}.`,
  },
  {
    match: (c) => c === "POSTER_NOT_AVAILABLE",
    severity: "WARNING",
    group: "poster-backdrop",
    label: () => "TMDB has no poster for this title — add one manually before publishing.",
  },
  {
    match: (c) => c === "TRAILER_NOT_FOUND",
    severity: "INFO",
    group: "trailer",
    label: () => "No official trailer found on TMDB — you can add a trailer URL manually.",
  },
  {
    match: (c) => c.startsWith("TRAILER_FALLBACK_TEASER:"),
    severity: "INFO",
    group: "trailer",
    label: () => "No trailer available — a teaser was used instead of a trailer.",
  },
  {
    match: (c) => c === "SCREENING_FORMAT_NOT_SET",
    severity: "INFO",
    group: "required-metadata",
    label: () => "Screening format isn't set from TMDB — choose at least one below.",
  },
  {
    match: (c) => c.startsWith("DUPLICATE_IMAGES_SKIPPED:"),
    severity: "INFO",
    group: "upstream",
    label: (detail) => `${detail ?? "Some"} image(s) were already imported and were skipped.`,
  },
];

function splitCode(code: string): { detail?: string } {
  const idx = code.indexOf(":");
  return idx === -1 ? {} : { detail: code.slice(idx + 1) };
}

export function classifyWarning(code: string): ClassifiedWarning {
  const { detail } = splitCode(code);
  const rule = RULES.find((r) => r.match(code));
  if (!rule) {
    return {
      code,
      severity: "WARNING",
      group: "upstream",
      label: `Unrecognized upstream warning: ${code}`,
      detail,
    };
  }
  return { code, severity: rule.severity, group: rule.group, label: rule.label(detail), detail };
}

export function classifyWarnings(codes: string[] | undefined | null): ClassifiedWarning[] {
  return (codes ?? []).map(classifyWarning);
}

export const WARNING_GROUP_LABELS: Record<WarningGroup, string> = {
  "required-metadata": "Required metadata",
  "genre-mapping": "Genre mapping",
  "release-rating": "Vietnam release & rating",
  trailer: "Trailer",
  "poster-backdrop": "Poster & backdrop",
  upstream: "Upstream / partial failure",
};

/** Stable group display order - required-metadata and genre-mapping (the two blocking-capable
 *  groups) surface first regardless of the order warnings arrived in. */
export const WARNING_GROUP_ORDER: WarningGroup[] = [
  "required-metadata",
  "genre-mapping",
  "release-rating",
  "trailer",
  "poster-backdrop",
  "upstream",
];

export function groupWarnings(warnings: ClassifiedWarning[]): Partial<Record<WarningGroup, ClassifiedWarning[]>> {
  const byGroup: Partial<Record<WarningGroup, ClassifiedWarning[]>> = {};
  for (const w of warnings) {
    const bucket = byGroup[w.group] ?? (byGroup[w.group] = []);
    bucket.push(w);
  }
  return byGroup;
}

export function hasBlockingWarning(warnings: ClassifiedWarning[]): boolean {
  return warnings.some((w) => w.severity === "BLOCKING");
}

/** Extracts the TMDB genre id from a "GENRE_UNMAPPED:<id>" warning, if that's what this is. */
export function unmappedGenreIdFrom(warning: ClassifiedWarning): number | null {
  if (warning.group !== "genre-mapping" || !warning.code.startsWith("GENRE_UNMAPPED:")) return null;
  const id = Number(warning.detail);
  return Number.isFinite(id) ? id : null;
}
