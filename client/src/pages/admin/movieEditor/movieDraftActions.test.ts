import { describe, expect, it, vi } from "vitest";
import { persistMovieDraft, saveDraftThenSubmit } from "./movieDraftActions";

describe("movie draft actions", () => {
  it("creates a new draft when no movie ID exists", async () => {
    const createMovie = vi.fn().mockResolvedValue({ result: { movieId: 41, status: "DRAFT" } });
    const updateMovie = vi.fn();

    const result = await persistMovieDraft({
      movieId: null,
      payload: { originalTitle: "New draft" },
      createMovie,
      updateMovie,
    });

    expect(result.movieId).toBe(41);
    expect(createMovie).toHaveBeenCalledOnce();
    expect(updateMovie).not.toHaveBeenCalled();
  });

  it("updates the existing draft when a movie ID exists", async () => {
    const createMovie = vi.fn();
    const updateMovie = vi.fn().mockResolvedValue({ result: { movieId: 41, status: "DRAFT" } });

    await persistMovieDraft({
      movieId: 41,
      payload: { originalTitle: "Updated draft" },
      createMovie,
      updateMovie,
    });

    expect(updateMovie).toHaveBeenCalledWith(41, { originalTitle: "Updated draft" });
    expect(createMovie).not.toHaveBeenCalled();
  });

  it("saves the latest draft before submitting it for review", async () => {
    const order: string[] = [];
    const saveDraft = vi.fn(async () => {
      order.push("save");
      return { movieId: 41, status: "DRAFT" };
    });
    const submitForReview = vi.fn(async () => {
      order.push("submit");
      return { result: { movieId: 41, status: "PENDING_REVIEW" } };
    });

    const result = await saveDraftThenSubmit({ saveDraft, submitForReview });

    expect(order).toEqual(["save", "submit"]);
    expect(submitForReview).toHaveBeenCalledWith(41);
    expect(result.status).toBe("PENDING_REVIEW");
  });

  it("does not submit when the draft save fails", async () => {
    const saveDraft = vi.fn().mockRejectedValue(new Error("save unavailable"));
    const submitForReview = vi.fn();

    await expect(saveDraftThenSubmit({ saveDraft, submitForReview })).rejects.toThrow("save unavailable");
    expect(submitForReview).not.toHaveBeenCalled();
  });

  it("reports a submit failure only after confirming that the draft was saved", async () => {
    const onDraftSaved = vi.fn();
    const saveDraft = vi.fn().mockResolvedValue({ movieId: 41, status: "DRAFT" });
    const submitForReview = vi.fn().mockRejectedValue(new Error("review service unavailable"));

    await expect(
      saveDraftThenSubmit({ saveDraft, submitForReview, onDraftSaved }),
    ).rejects.toThrow("review service unavailable");

    expect(onDraftSaved).toHaveBeenCalledWith({ movieId: 41, status: "DRAFT" });
    expect(submitForReview).toHaveBeenCalledWith(41);
  });
});
