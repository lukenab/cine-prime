import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MovieEditorActionBar } from "./MovieEditorActionBar";

describe("MovieEditorActionBar", () => {
  it("shows dirty state and exposes separate draft and review commands", () => {
    render(
      <MovieEditorActionBar
        status="dirty"
        operation="idle"
        canSave
        canSubmit
        onSaveDraft={vi.fn()}
        onSubmitForReview={vi.fn()}
      />,
    );

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Submit for Review" })).toBeEnabled();
  });

  it("communicates save progress and prevents duplicate actions", () => {
    const onSaveDraft = vi.fn();
    const { rerender } = render(
      <MovieEditorActionBar
        status="dirty"
        operation="idle"
        canSave
        canSubmit
        onSaveDraft={onSaveDraft}
        onSubmitForReview={vi.fn()}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Save Draft" });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    expect(onSaveDraft).toHaveBeenCalledOnce();

    rerender(
      <MovieEditorActionBar
        status="dirty"
        operation="saving-draft"
        canSave
        canSubmit
        onSaveDraft={onSaveDraft}
        onSubmitForReview={vi.fn()}
      />,
    );
    expect(screen.getByText("Saving draft…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit for Review" })).toBeDisabled();
  });

  it("hides commands that the current permission or lifecycle state does not allow", () => {
    render(
      <MovieEditorActionBar
        status="submitted"
        operation="idle"
        canSave={false}
        canSubmit={false}
        onSaveDraft={vi.fn()}
        onSubmitForReview={vi.fn()}
      />,
    );

    expect(screen.getByText("Submitted for review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for Review" })).not.toBeInTheDocument();
  });
});
