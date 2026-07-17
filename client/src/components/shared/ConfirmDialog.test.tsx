import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders outside sticky panels with an opaque fallback background", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { container } = render(
      <div style={{ position: "sticky", overflow: "auto" }}>
        <ConfirmDialog title="Apply generated layout preview?" body="Preview details" onConfirm={onConfirm} onCancel={vi.fn()} />
      </div>,
    );

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeVisible();
    expect(dialog).toHaveStyle({ backgroundColor: "var(--bg-card, #ffffff)", opacity: "1" });
    expect(dialog.parentElement).toHaveStyle({ zIndex: "1000", pointerEvents: "auto" });
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
