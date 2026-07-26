import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { movieApi, type ScreeningFormatResponse } from "../../../api/movieApi";
import ScreeningVersionsSection from "./ScreeningVersionsSection";

vi.mock("../../../api/movieApi", () => ({
  movieApi: {
    getRoomMasterData: vi.fn(),
    listMovieScreeningVersions: vi.fn(),
    createMovieScreeningVersion: vi.fn(),
    updateMovieScreeningVersion: vi.fn(),
    activateMovieScreeningVersion: vi.fn(),
    deactivateMovieScreeningVersion: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

const formats: ScreeningFormatResponse[] = [
  {
    formatId: 1,
    formatCode: "2D",
    formatName: "2D Standard",
    description: "Standard presentation",
    surcharge: 0,
  },
];

describe("ScreeningVersionsSection draft preparation flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(movieApi.getRoomMasterData).mockResolvedValue({
      result: {
        audioFormats: [{ id: 10, code: "5.1", name: "Digital 5.1" }],
      },
    } as Awaited<ReturnType<typeof movieApi.getRoomMasterData>>);
    vi.mocked(movieApi.listMovieScreeningVersions).mockResolvedValue({
      result: [],
    });
  });

  it("creates the movie draft in the background before opening the first version editor", async () => {
    const onPrepareMovieDraft = vi.fn().mockResolvedValue(41);

    render(
      <ScreeningVersionsSection
        movieId={null}
        originalLanguage="en"
        formats={formats}
        canManage
        movieEditable
        hasUnsavedMovieChanges
        onPrepareMovieDraft={onPrepareMovieDraft}
      />,
    );

    const addButton = screen.getByRole("button", { name: "Add version" });
    await waitFor(() => expect(addButton).toBeEnabled());
    fireEvent.click(addButton);

    await waitFor(() => expect(onPrepareMovieDraft).toHaveBeenCalledOnce());
    expect(await screen.findByText("New screening version")).toBeInTheDocument();
    expect(movieApi.listMovieScreeningVersions).toHaveBeenCalledWith(41);
    expect(screen.queryByText("Save the movie draft first")).not.toBeInTheDocument();
  });

  it("does not persist again when an existing movie has no unsaved changes", async () => {
    const onPrepareMovieDraft = vi.fn().mockResolvedValue(41);

    render(
      <ScreeningVersionsSection
        movieId={41}
        originalLanguage="en"
        formats={formats}
        canManage
        movieEditable
        hasUnsavedMovieChanges={false}
        onPrepareMovieDraft={onPrepareMovieDraft}
      />,
    );

    const addButton = screen.getByRole("button", { name: "Add version" });
    await waitFor(() => expect(addButton).toBeEnabled());
    fireEvent.click(addButton);

    expect(await screen.findByText("New screening version")).toBeInTheDocument();
    expect(onPrepareMovieDraft).not.toHaveBeenCalled();
  });
});
