import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TmdbCatalogPage from "./TmdbCatalogPage";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  tmdbNowPlaying: vi.fn(),
  tmdbUpcoming: vi.fn(),
  tmdbSearch: vi.fn(),
  tmdbDetails: vi.fn(),
  tmdbImport: vi.fn(),
  createMovie: vi.fn(),
  updateMovie: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("../../api/movieApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/movieApi")>();
  return {
    ...actual,
    movieApi: {
      ...actual.movieApi,
      tmdbNowPlaying: mocks.tmdbNowPlaying,
      tmdbUpcoming: mocks.tmdbUpcoming,
      tmdbSearch: mocks.tmdbSearch,
      tmdbDetails: mocks.tmdbDetails,
      tmdbImport: mocks.tmdbImport,
      createMovie: mocks.createMovie,
      updateMovie: mocks.updateMovie,
    },
  };
});

const movie = {
  tmdbId: 42,
  title: "Catalog Movie",
  originalTitle: "Catalog Movie",
  releaseDate: "2026-07-24",
  posterUrl: "https://image.example/poster.jpg",
};

const details = {
  tmdbId: 42,
  originalTitle: "Catalog Movie",
  originalLanguage: "en",
  durationMinutes: 118,
  releaseDate: "2026-07-24",
  overview: "A read-only catalog preview.",
  translations: [],
  cast: [],
  genres: [],
  warnings: [],
};

describe("TmdbCatalogPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tmdbNowPlaying.mockResolvedValue({ result: [movie] });
    mocks.tmdbUpcoming.mockResolvedValue({ result: [] });
    mocks.tmdbSearch.mockResolvedValue({ result: [] });
    mocks.tmdbDetails.mockResolvedValue({ result: details });
  });

  it("previews catalog details without writing a local movie, then opens the populated editor", async () => {
    render(<TmdbCatalogPage />);

    const movieCard = await screen.findByRole("button", { name: /Catalog Movie/i });
    fireEvent.click(movieCard);

    expect(await screen.findByText("A read-only catalog preview.")).toBeInTheDocument();
    expect(mocks.tmdbDetails).toHaveBeenCalledWith(42);
    expect(mocks.tmdbImport).not.toHaveBeenCalled();
    expect(mocks.createMovie).not.toHaveBeenCalled();
    expect(mocks.updateMovie).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Use this movie/i }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/admin/movies/new/manual?tmdbId=42",
      { state: { tmdbItem: movie, tmdbDetails: details } },
    );
  });

  it("keeps API failure distinct from an empty catalog and supports retry", async () => {
    mocks.tmdbNowPlaying
      .mockRejectedValueOnce({ response: { status: 503, data: { message: "Catalog unavailable" } } })
      .mockResolvedValueOnce({ result: [] });

    render(<TmdbCatalogPage />);
    expect(await screen.findByText("Catalog unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(mocks.tmdbNowPlaying).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No movies found for this catalog page.")).toBeInTheDocument();
  });
});
