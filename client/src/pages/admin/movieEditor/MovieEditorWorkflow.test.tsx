import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MovieEditorWorkflow, {
  MOVIE_EDITOR_SECTION_META,
  movieEditorSectionDomId,
  type MovieEditorContentSectionId,
  type MovieEditorSectionDefinition,
  type MovieEditorSectionId,
} from "./MovieEditorWorkflow";

const sections: MovieEditorSectionDefinition[] = MOVIE_EDITOR_SECTION_META.map(({ id, label, description }) => ({
  id,
  label,
  description,
}));

function Harness({
  onActiveSectionChange,
  sectionDefinitions = sections,
}: {
  onActiveSectionChange?: (id: MovieEditorSectionId) => void;
  sectionDefinitions?: MovieEditorSectionDefinition[];
} = {}) {
  const [title, setTitle] = useState("");
  return (
    <MovieEditorWorkflow sections={sectionDefinitions} onActiveSectionChange={onActiveSectionChange}>
      <section
        id={movieEditorSectionDomId("overview")}
        data-editor-section="overview"
        data-workflow-step="details"
        tabIndex={-1}
      >
        <label>
          Original title
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
      </section>
      <section
        id={movieEditorSectionDomId("media")}
        data-editor-section="media"
        data-workflow-step="media-credits"
        tabIndex={-1}
      >
        Media
      </section>
      <section
        id={movieEditorSectionDomId("screening-versions")}
        data-editor-section="screening-versions"
        data-workflow-step="screening-versions"
        tabIndex={-1}
      >
        Screening versions
      </section>
      <section
        id={movieEditorSectionDomId("review")}
        data-editor-section="review"
        data-workflow-step="review"
        tabIndex={-1}
      >
        Review
      </section>
    </MovieEditorWorkflow>
  );
}

describe("MovieEditorWorkflow", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/admin/movies/new/manual");
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("moves between focused steps without losing controlled form state", () => {
    const { container } = render(<Harness />);

    const title = screen.getByRole("textbox", { name: "Original title" });
    fireEvent.change(title, { target: { value: "The Last Screening" } });
    fireEvent.click(screen.getAllByRole("button", { name: /2\.\s*Media & credits/i })[0]);

    expect(window.location.hash).toBe("#media-credits");
    expect(container.querySelector("[data-movie-editor-workflow]")).toHaveAttribute("data-active-step", "media-credits");
    expect(title).toHaveValue("The Last Screening");
    expect(screen.getAllByRole("button", { name: /2\.\s*Media & credits/i })
      .some((button) => button.getAttribute("aria-current") === "step")).toBe(true);
  });

  it("supports previous and next step navigation", () => {
    const { container } = render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /Continue to Media & credits/i }));
    expect(container.querySelector("[data-movie-editor-workflow]")).toHaveAttribute("data-active-step", "media-credits");

    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));
    expect(container.querySelector("[data-movie-editor-workflow]")).toHaveAttribute("data-active-step", "details");
  });

  it("notifies the editor when the user enters screening versions", () => {
    const onActiveSectionChange = vi.fn();
    render(<Harness onActiveSectionChange={onActiveSectionChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: /3\.\s*Screening versions/i })[0]);

    expect(onActiveSectionChange).toHaveBeenLastCalledWith("screening-versions");
  });

  it.each<MovieEditorContentSectionId>([
    "overview",
    "classification-release",
    "screening-versions",
    "media",
    "credits",
    "review",
  ])("creates a stable DOM id for the %s content section", (id) => {
    expect(movieEditorSectionDomId(id)).toBe(`movie-editor-section-${id}`);
  });

  it("maps legacy deep links to the new focused steps", () => {
    window.history.replaceState(null, "", "/admin/movies/new/manual#credits");
    const { container } = render(<Harness />);
    expect(container.querySelector("[data-movie-editor-workflow]")).toHaveAttribute("data-active-step", "media-credits");
  });

  it("blocks review navigation when the screening-version step is not persisted", () => {
    window.history.replaceState(null, "", "/admin/movies/new/manual#screening-versions");
    const blockedSections = sections.map((section) => (
      section.id === "screening-versions"
        ? {
          ...section,
          blockNext: true,
          blockNextMessage: "Create and save at least one active screening version before review.",
        }
        : section
    ));

    const { container } = render(<Harness sectionDefinitions={blockedSections} />);

    const continueButton = screen.getByRole("button", { name: /Continue to Review & submit/i });
    expect(continueButton).toBeDisabled();
    expect(screen.getByText("Create and save at least one active screening version before review.")).toBeInTheDocument();
    fireEvent.click(continueButton);
    expect(container.querySelector("[data-movie-editor-workflow]")).toHaveAttribute("data-active-step", "screening-versions");
  });
});
