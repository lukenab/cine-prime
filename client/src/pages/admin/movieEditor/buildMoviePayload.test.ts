import { describe, expect, it } from "vitest";
import { buildMoviePayload, type MoviePayloadFormFields } from "./buildMoviePayload";

function baseForm(overrides: Partial<MoviePayloadFormFields> = {}): MoviePayloadFormFields {
  return {
    originalTitle: "Parasite",
    originalLanguage: "en",
    durationMinutes: 132,
    releaseDate: "2019-05-30",
    country: "South Korea",
    ageRatingId: 3,
    genreIds: [1],
    posterUrl: "",
    thumbnailUrl: "",
    trailerUrl: "",
    vi_title: "",
    vi_synopsis: "",
    vi_tagline: "",
    en_title: "",
    en_synopsis: "",
    en_tagline: "",
    popularityScore: 0,
    priorityOverride: "",
    ...overrides,
  };
}

describe("buildMoviePayload", () => {
  it("never includes endDate in the payload, on create or update", () => {
    const payload = buildMoviePayload(baseForm(), [], []);

    expect(payload).not.toHaveProperty("endDate");
    expect(JSON.stringify(payload)).not.toContain("endDate");
  });

  it("still sends releaseDate as theatrical/content metadata", () => {
    const payload = buildMoviePayload(baseForm({ releaseDate: "2019-05-30" }), [], []);

    expect(payload.releaseDate).toBe("2019-05-30");
  });

  it("omits releaseDate (rather than sending an empty string) when unset", () => {
    const payload = buildMoviePayload(baseForm({ releaseDate: "" }), [], []);

    expect(payload.releaseDate).toBeUndefined();
  });

  it("sends popularityScore and only parses priorityOverride when non-blank", () => {
    const withOverride = buildMoviePayload(baseForm({ popularityScore: 72, priorityOverride: "8.5" }), [], []);
    expect(withOverride.popularityScore).toBe(72);
    expect(withOverride.priorityOverride).toBe(8.5);

    const withoutOverride = buildMoviePayload(baseForm({ popularityScore: 0, priorityOverride: "" }), [], []);
    expect(withoutOverride.popularityScore).toBe(0);
    expect(withoutOverride.priorityOverride).toBeUndefined();
  });

  it("still builds translations, genres and companies as before", () => {
    const payload = buildMoviePayload(
      baseForm({ en_title: "Parasite", en_synopsis: "A poor family schemes...", genreIds: [1, 2] }),
      [10, 20],
      [{ personId: 1, roleType: "DIRECTOR" }],
    );

    expect(payload.translations).toEqual([
      { languageCode: "en", title: "Parasite", synopsis: "A poor family schemes...", tagline: undefined },
    ]);
    expect(payload.companyIds).toEqual([10, 20]);
    expect(payload.genreIds).toEqual([1, 2]);
    expect(payload.cast).toEqual([{ personId: 1, roleType: "DIRECTOR" }]);
  });

  it("never includes formatIds in the payload - movie.formats is derived from screening versions", () => {
    const payload = buildMoviePayload(baseForm(), [], []);

    expect(payload).not.toHaveProperty("formatIds");
  });
});
