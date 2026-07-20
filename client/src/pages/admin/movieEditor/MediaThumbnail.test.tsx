import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaThumbnail } from "./MediaThumbnail";

describe("MediaThumbnail", () => {
  it("renders the selected asset", () => {
    render(<MediaThumbnail src="https://example.com/poster.jpg" alt="Poster" emptyLabel="No poster yet" />);
    const img = screen.getByAltText("Poster") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/poster.jpg");
  });

  it("shows the empty-state placeholder when there is no asset selected", () => {
    render(<MediaThumbnail src={undefined} alt="Poster" emptyLabel="No poster selected yet" />);
    expect(screen.getByText("No poster selected yet")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Poster" })).not.toBeInTheDocument();
  });

  it("falls back to a clear broken-preview state instead of a broken image icon", () => {
    render(<MediaThumbnail src="https://example.com/does-not-load.jpg" alt="Backdrop" emptyLabel="No backdrop yet" />);
    const img = screen.getByAltText("Backdrop");
    fireEvent.error(img);
    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
    expect(screen.queryByAltText("Backdrop")).not.toBeInTheDocument();
  });

  it("gives a fresh asset a new chance to load instead of staying stuck in the broken state", () => {
    const { rerender, getByAltText, getByText } = render(
      <MediaThumbnail src="https://example.com/bad.jpg" alt="Poster" emptyLabel="No poster yet" />,
    );
    fireEvent.error(getByAltText("Poster"));
    expect(getByText("Preview unavailable")).toBeInTheDocument();

    rerender(<MediaThumbnail src="https://example.com/good.jpg" alt="Poster" emptyLabel="No poster yet" />);
    expect(getByAltText("Poster")).toBeInTheDocument();
  });
});
