import { describe, expect, it } from "vitest";
import {
  classifyWarning,
  classifyWarnings,
  groupWarnings,
  hasBlockingWarning,
  unmappedGenreIdFrom,
} from "./tmdbWarnings";

describe("classifyWarning", () => {
  it("classifies an unmapped genre as blocking, in the genre-mapping group", () => {
    const w = classifyWarning("GENRE_UNMAPPED:99");
    expect(w.severity).toBe("BLOCKING");
    expect(w.group).toBe("genre-mapping");
    expect(w.detail).toBe("99");
  });

  it("classifies a missing poster as a non-blocking warning", () => {
    const w = classifyWarning("POSTER_NOT_AVAILABLE");
    expect(w.severity).toBe("WARNING");
    expect(w.group).toBe("poster-backdrop");
  });

  it("classifies missing trailer and teaser fallback as info, in the trailer group", () => {
    expect(classifyWarning("TRAILER_NOT_FOUND").severity).toBe("INFO");
    expect(classifyWarning("TRAILER_NOT_FOUND").group).toBe("trailer");

    const teaser = classifyWarning("TRAILER_FALLBACK_TEASER:abc123");
    expect(teaser.severity).toBe("INFO");
    expect(teaser.group).toBe("trailer");
    expect(teaser.detail).toBe("abc123");
  });

  it("classifies missing runtime as a non-blocking required-metadata warning", () => {
    const w = classifyWarning("RUNTIME_MISSING");
    expect(w.severity).toBe("WARNING");
    expect(w.group).toBe("required-metadata");
  });

  it("classifies a missing age rating as a release-rating warning", () => {
    const w = classifyWarning("AGE_RATING_NOT_AVAILABLE");
    expect(w.severity).toBe("WARNING");
    expect(w.group).toBe("release-rating");
    expect(w.label).toContain("select and verify");
  });

  it("falls back to a generic upstream warning for an unrecognized code, keyed off the code prefix only", () => {
    const w = classifyWarning("SOME_FUTURE_CODE:xyz");
    expect(w.severity).toBe("WARNING");
    expect(w.group).toBe("upstream");
    expect(w.label).toContain("SOME_FUTURE_CODE:xyz");
  });
});

describe("classifyWarnings / groupWarnings", () => {
  it("groups a mixed warning list by classification group", () => {
    const classified = classifyWarnings([
      "GENRE_UNMAPPED:1",
      "GENRE_UNMAPPED:2",
      "POSTER_NOT_AVAILABLE",
      "TRAILER_NOT_FOUND",
    ]);
    const grouped = groupWarnings(classified);

    expect(grouped["genre-mapping"]).toHaveLength(2);
    expect(grouped["poster-backdrop"]).toHaveLength(1);
    expect(grouped["trailer"]).toHaveLength(1);
    expect(grouped["release-rating"]).toBeUndefined();
  });

  it("returns an empty array for null/undefined input instead of throwing", () => {
    expect(classifyWarnings(undefined)).toEqual([]);
    expect(classifyWarnings(null)).toEqual([]);
  });
});

describe("hasBlockingWarning", () => {
  it("is true only when at least one BLOCKING-severity warning is present", () => {
    expect(hasBlockingWarning(classifyWarnings(["GENRE_UNMAPPED:1"]))).toBe(true);
    expect(hasBlockingWarning(classifyWarnings(["POSTER_NOT_AVAILABLE", "TRAILER_NOT_FOUND"]))).toBe(false);
    expect(hasBlockingWarning([])).toBe(false);
  });
});

describe("unmappedGenreIdFrom", () => {
  it("extracts the TMDB genre id from a GENRE_UNMAPPED warning", () => {
    expect(unmappedGenreIdFrom(classifyWarning("GENRE_UNMAPPED:42"))).toBe(42);
  });

  it("returns null for a warning that isn't an unmapped-genre one", () => {
    expect(unmappedGenreIdFrom(classifyWarning("POSTER_NOT_AVAILABLE"))).toBeNull();
    expect(unmappedGenreIdFrom(classifyWarning("TRAILER_NOT_FOUND"))).toBeNull();
  });
});
