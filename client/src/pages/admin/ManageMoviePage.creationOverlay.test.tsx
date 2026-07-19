import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManageMoviePage from "./ManageMoviePage";
import MovieCreationStartPage from "./MovieCreationStartPage";

const mocks = vi.hoisted(() => ({
  getAllMovies: vi.fn(),
  getGenres: vi.fn(),
}));

vi.mock("../../api/movieApi", () => ({
  movieApi: {
    getAllMovies: mocks.getAllMovies,
    getGenres: mocks.getGenres,
  },
}));

vi.mock("../../hooks/useRole", () => ({ useRole: () => ({ isAdmin: true }) }));
vi.mock("../../layouts/MovieStatsCards", () => ({ MovieStatsCards: () => <div>Movie statistics</div> }));
vi.mock("../../layouts/MovieTable", () => ({ MovieTable: () => <div>Movie list table</div> }));
vi.mock("../../layouts/MovieDetailModal", () => ({ MovieDetailModal: () => null }));
vi.mock("../../layouts/PendingReviewModal", () => ({ PendingReviewModal: () => null }));

function AdminLayoutHarness() {
  return <Outlet context={{ isDarkMode: false }} />;
}

describe("ManageMoviePage creation overlay route", () => {
  beforeEach(() => {
    mocks.getAllMovies.mockResolvedValue({ result: [] });
    mocks.getGenres.mockResolvedValue({ result: [] });
  });

  it("keeps movie management mounted behind the creation method dialog", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/movies/new"]}>
        <Routes>
          <Route element={<AdminLayoutHarness />}>
            <Route path="/admin/movies" element={<ManageMoviePage />}>
              <Route path="new" element={<MovieCreationStartPage />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Movie Management" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /How would you like to create this movie/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close movie creation options" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Movie Management" })).toBeInTheDocument();
    expect(screen.getByText("Movie list table")).toBeInTheDocument();
  });
});
