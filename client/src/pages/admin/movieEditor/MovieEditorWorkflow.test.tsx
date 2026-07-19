import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MovieEditorWorkflow, {
  MOVIE_EDITOR_SECTION_META,
  movieEditorSectionDomId,
  type MovieEditorSectionDefinition,
  type MovieEditorSectionId,
} from "./MovieEditorWorkflow";

const sections: MovieEditorSectionDefinition[] = MOVIE_EDITOR_SECTION_META.map(({ id, label, description }) => ({
  id,
  label,
  description,
}));

let observerCallback: IntersectionObserverCallback | undefined;

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
}

function Harness() {
  const [title, setTitle] = useState("");
  return (
    <MovieEditorWorkflow sections={sections}>
      {sections.map((section) => (
        <section
          key={section.id}
          id={movieEditorSectionDomId(section.id)}
          data-editor-section={section.id}
          tabIndex={-1}
        >
          <h2>{section.label}</h2>
          {section.id === "overview" && (
            <label>
              Original title
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
          )}
        </section>
      ))}
    </MovieEditorWorkflow>
  );
}

describe("MovieEditorWorkflow", () => {
  beforeEach(() => {
    observerCallback = undefined;
    window.history.replaceState(null, "", "/admin/movies/new/manual");
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  });

  it("navigates by section, updates the URL hash and preserves controlled form state", () => {
    render(<Harness />);

    const title = screen.getByRole("textbox", { name: "Original title" });
    fireEvent.change(title, { target: { value: "The Last Screening" } });

    fireEvent.click(screen.getAllByRole("button", { name: /3\.\s*Media/i })[0]);

    expect(window.location.hash).toBe("#media");
    expect(document.activeElement).toBe(document.getElementById(movieEditorSectionDomId("media")));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(title).toHaveValue("The Last Screening");
    expect(screen.getAllByRole("button", { name: /3\.\s*Media/i }).some((button) => button.getAttribute("aria-current") === "step")).toBe(true);
  });

  it("tracks the active section while the editor is scrolled", () => {
    render(<Harness />);

    const credits = document.getElementById(movieEditorSectionDomId("credits"))!;
    act(() => {
      observerCallback?.([
        {
          target: credits,
          isIntersecting: true,
          boundingClientRect: { top: 12 } as DOMRectReadOnly,
        } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });

    expect(window.location.hash).toBe("#credits");
    expect(screen.getAllByRole("button", { name: /4\.\s*Credits/i }).some((button) => button.getAttribute("aria-current") === "step")).toBe(true);
  });

  it.each<MovieEditorSectionId>(["overview", "classification-release", "media", "credits", "review"])(
    "renders a stable target for the %s section",
    (id) => {
      render(<Harness />);
      expect(document.getElementById(movieEditorSectionDomId(id))).toHaveAttribute("data-editor-section", id);
    },
  );
});
