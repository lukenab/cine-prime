import type { MovieStatus } from "../api/movieApi";

/**
 * Content-review states shown by Movie Management. MovieStatus already IS this
 * exact 5-value union (MOV-LC-04) — this alias + toMovieContentStatus() exist
 * only so callers don't need to special-case an unexpected/missing value.
 */
export type MovieContentStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "ARCHIVED";

export const MOVIE_CONTENT_STATUS_META: Record<
  MovieContentStatus,
  { label: string; dot: string; bg: string; text: string }
> = {
  DRAFT: {
    label: "Draft",
    dot: "#9ca3af",
    bg: "rgba(156,163,175,0.12)",
    text: "#6b7280",
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    dot: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    text: "#d97706",
  },
  APPROVED: {
    label: "Approved",
    dot: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    text: "#059669",
  },
  CHANGES_REQUESTED: {
    label: "Changes Requested",
    dot: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    text: "#dc2626",
  },
  ARCHIVED: {
    label: "Archived",
    dot: "#9ca3af",
    bg: "rgba(156,163,175,0.08)",
    text: "#6b7280",
  },
};

/**
 * Compatibility adapter (MOV-LC-08): the backend's current MovieStatus enum only ever emits
 * the 5 canonical content-review values, but this must keep tolerating whatever a not-yet-fully
 * migrated response (or stale cached data) might still send, without special-casing it as an
 * unhandled/unknown value. Legacy exhibition-flavored statuses map to the closest canonical
 * content state they imply, never silently to DRAFT:
 *  - COMING_SOON / NOW_SHOWING / SUSPENDED: content was already approved (exhibition-only
 *    concepts, layered on top of an APPROVED movie) -> APPROVED.
 *  - REJECTED: the old single-step rejection -> CHANGES_REQUESTED (the closest canonical
 *    equivalent - the movie is back with the operator to revise).
 *  - ENDED: legacy backend overloaded this for both "finished its run" and soft-delete -> ARCHIVED.
 *    Not a canonical model - MOV-LC-05 must classify this correctly at the data layer.
 * Only a genuinely missing/unrecognized value falls back to DRAFT.
 */
export function toMovieContentStatus(status?: MovieStatus | string): MovieContentStatus {
  switch (status) {
    case "PENDING_REVIEW":
    case "APPROVED":
    case "CHANGES_REQUESTED":
    case "ARCHIVED":
      return status;
    case "COMING_SOON":
    case "NOW_SHOWING":
    case "SUSPENDED":
      return "APPROVED";
    case "REJECTED":
      return "CHANGES_REQUESTED";
    case "ENDED":
      return "ARCHIVED";
    case "DRAFT":
    default:
      return "DRAFT";
  }
}
