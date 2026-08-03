import type { ReadinessViolation } from "../api/movieApi";

const READINESS_MESSAGES: Record<string, string> = {
  "originalTitle:REQUIRED": "Enter the original movie title.",
  "originalLanguage:MUST_BE_TWO_LETTER_CODE": "Select a valid two-letter original language code.",
  "durationMinutes:MUST_BE_POSITIVE": "Enter a runtime greater than 0 minutes.",
  "genres:AT_LEAST_ONE_REQUIRED": "Add at least one genre.",
  "screeningVersions:AT_LEAST_ONE_COMPLETE_ACTIVE_VERSION_REQUIRED":
    "Add at least one active screening version with presentation format, audio format and audio language.",
  "ageRating:REQUIRED_FOR_APPROVAL": "Select a Vietnam age classification.",
  "ageRating:CLASSIFICATION_C_BANNED_FROM_PUBLIC_RELEASE":
    "Replace classification C before public release.",
  "poster:PRIMARY_IMAGE_REQUIRED": "Select a primary poster.",
  "synopsis:REQUIRED_FOR_APPROVAL": "Add a synopsis.",
  "translations:LOCALIZED_TITLE_REQUIRED": "Add at least one localized title.",
  "genres:PENDING_REVIEW_GENRE_MUST_BE_RESOLVED":
    "Resolve every genre that is still pending review.",
  "releaseDate:RELEASE_DATE_NOT_REACHED": "The configured release date has not been reached.",
  "showTimes:AT_LEAST_ONE_FUTURE_SHOWTIME_REQUIRED":
    "Create at least one future showtime.",
};

export function extractMovieReadinessViolations(error: unknown): ReadinessViolation[] {
  const responseData = (error as {
    response?: {
      data?: {
        result?: { violations?: ReadinessViolation[] };
        violations?: ReadinessViolation[];
      };
    };
  })?.response?.data;

  const violations = responseData?.result?.violations ?? responseData?.violations;
  return Array.isArray(violations) ? violations : [];
}

export function describeMovieReadinessViolation(violation: ReadinessViolation): string {
  return (
    READINESS_MESSAGES[`${violation.field}:${violation.rule}`]
    ?? `Complete ${violation.field} (${violation.rule.toLowerCase().replaceAll("_", " ")}).`
  );
}
