import { describe, expect, it } from "vitest";
import {
  describeMovieReadinessViolation,
  extractMovieReadinessViolations,
} from "./movieReadiness";

describe("movie readiness helpers", () => {
  it("extracts violations from the movie-service result envelope", () => {
    const error = {
      response: {
        data: {
          result: {
            violations: [
              {
                field: "screeningVersions",
                rule: "AT_LEAST_ONE_COMPLETE_ACTIVE_VERSION_REQUIRED",
              },
            ],
          },
        },
      },
    };

    expect(extractMovieReadinessViolations(error)).toEqual(
      error.response.data.result.violations,
    );
  });

  it("turns a screening-version violation into an actionable message", () => {
    expect(
      describeMovieReadinessViolation({
        field: "screeningVersions",
        rule: "AT_LEAST_ONE_COMPLETE_ACTIVE_VERSION_REQUIRED",
      }),
    ).toBe(
      "Add at least one active screening version with presentation format, audio format and audio language.",
    );
  });
});
