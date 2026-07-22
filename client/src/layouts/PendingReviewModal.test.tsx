import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MovieResponse } from "../api/movieApi";
import { PendingReviewModal } from "./PendingReviewModal";

vi.mock("../hooks/useRole", () => ({
  useRole: () => ({ can: { approve: true, requestChanges: true } }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const readyMovie: MovieResponse = {
  movieId: 43,
  tmdbId: 1081003,
  imdbId: "tt8811026",
  originalTitle: "Supergirl",
  originalLanguage: "en",
  durationMinutes: 108,
  releaseDate: "2026-06-24",
  country: "United States",
  status: "PENDING_REVIEW",
  posterUrl: "https://image.tmdb.org/poster.jpg",
  thumbnailUrl: "https://image.tmdb.org/thumb.jpg",
  trailerUrl: "https://youtube.com/watch?v=example",
  synopsis: "Kara Zor-El begins a journey across the stars.",
  ageRating: { ratingId: 3, ratingCode: "T13", minAge: 13, description: "Suitable for viewers aged 13 and above" },
  genres: [{ genreId: 1, genreCode: "ACTION", genreName: "Action", status: "ACTIVE" }],
  formats: [{ formatId: 1, formatCode: "2D", formatName: "2D Standard", description: "Standard presentation", surcharge: 0 }],
  companies: [{ companyId: 1, name: "DC Studios", country: "US", logoUrl: "" }],
  translations: [
    { languageCode: "en", title: "Supergirl", synopsis: "Kara Zor-El begins a journey across the stars." },
    { languageCode: "vi", title: "Nữ Siêu Nhân", synopsis: "Kara Zor-El bắt đầu hành trình xuyên các vì sao." },
  ],
  cast: [
    { personId: 1, fullName: "Craig Gillespie", photoUrl: "", roleType: "DIRECTOR", characterName: "", billingOrder: 0 },
    { personId: 2, fullName: "Milly Alcock", photoUrl: "", roleType: "ACTOR", characterName: "Kara Zor-El", billingOrder: 1 },
  ],
  images: [
    { imageId: 1, imageUrl: "https://image.tmdb.org/poster.jpg", imageType: "POSTER", source: "TMDB", isDefault: true },
    { imageId: 2, imageUrl: "https://image.tmdb.org/backdrop.jpg", imageType: "BACKDROP", source: "TMDB", isDefault: true },
  ],
};

describe("PendingReviewModal", () => {
  it("preserves the active admin theme when the dialog is portaled to document.body", () => {
    const themeRoot = document.createElement("div");
    themeRoot.className = "theme-dark";
    document.body.appendChild(themeRoot);

    render(
      <PendingReviewModal
        open
        movie={readyMovie}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog").parentElement).toHaveClass("theme-dark");
    themeRoot.remove();
  });

  it("keeps the review compact and exposes supporting evidence through tabs", () => {
    render(
      <PendingReviewModal
        open
        movie={readyMovie}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Content approval review" })).toBeInTheDocument();
    expect(screen.getByText("Customer-facing content")).toBeInTheDocument();
    expect(screen.getByText("Classification & formats")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Media" }));
    expect(screen.getByText("Media evidence")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Credits" }));
    expect(screen.getByText("Credits & rights metadata")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Readiness" }));
    expect(screen.getByText("Ready for approval")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve content" })).toBeEnabled();
  });

  it("shows blockers and prevents approval when required content is missing", () => {
    render(
      <PendingReviewModal
        open
        movie={{
          ...readyMovie,
          ageRating: undefined,
          formats: [],
          posterUrl: undefined,
          images: [],
          synopsis: undefined,
          translations: [],
        }}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByText(/blocking issues/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve content" })).toBeDisabled();
  });

  it("requires a specific change note before sending it", () => {
    render(
      <PendingReviewModal
        open
        movie={readyMovie}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));
    const sendButton = screen.getByRole("button", { name: "Send change request" });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("What must the editor change?"), {
      target: { value: "Please add a higher-resolution poster." },
    });
    expect(sendButton).toBeEnabled();
  });
});
