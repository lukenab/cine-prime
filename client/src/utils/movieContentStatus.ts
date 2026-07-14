import type { MovieStatus } from "../api/movieApi";

/**
 * Content-review states shown by Movie Management.
 *
 * The backend still returns legacy exhibition states. They are normalized here
 * so the admin UI does not present cinema operations as Movie content states.
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

export function toMovieContentStatus(status?: MovieStatus | string): MovieContentStatus {
  switch (status) {
    case "PENDING_REVIEW":
      return "PENDING_REVIEW";
    case "APPROVED":
    case "COMING_SOON":
    case "NOW_SHOWING":
    case "SUSPENDED":
      return "APPROVED";
    case "CHANGES_REQUESTED":
    case "REJECTED":
      return "CHANGES_REQUESTED";
    case "ARCHIVED":
    case "ENDED":
      return "ARCHIVED";
    case "DRAFT":
    default:
      return "DRAFT";
  }
}
