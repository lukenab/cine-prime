import { describe, expect, it } from "vitest";
import { toMovieContentStatus } from "./movieContentStatus";

describe("toMovieContentStatus", () => {
  it("passes through the 5 canonical content statuses unchanged", () => {
    expect(toMovieContentStatus("DRAFT")).toBe("DRAFT");
    expect(toMovieContentStatus("PENDING_REVIEW")).toBe("PENDING_REVIEW");
    expect(toMovieContentStatus("APPROVED")).toBe("APPROVED");
    expect(toMovieContentStatus("CHANGES_REQUESTED")).toBe("CHANGES_REQUESTED");
    expect(toMovieContentStatus("ARCHIVED")).toBe("ARCHIVED");
  });

  it("maps legacy exhibition-flavored statuses to APPROVED, not DRAFT", () => {
    expect(toMovieContentStatus("COMING_SOON")).toBe("APPROVED");
    expect(toMovieContentStatus("NOW_SHOWING")).toBe("APPROVED");
    expect(toMovieContentStatus("SUSPENDED")).toBe("APPROVED");
  });

  it("maps the legacy single-step REJECTED to CHANGES_REQUESTED", () => {
    expect(toMovieContentStatus("REJECTED")).toBe("CHANGES_REQUESTED");
  });

  it("maps the legacy ENDED to ARCHIVED", () => {
    expect(toMovieContentStatus("ENDED")).toBe("ARCHIVED");
  });

  it("falls back to DRAFT only for a genuinely missing/unrecognized value", () => {
    expect(toMovieContentStatus(undefined)).toBe("DRAFT");
    expect(toMovieContentStatus("SOMETHING_UNEXPECTED")).toBe("DRAFT");
  });
});
