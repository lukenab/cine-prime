import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LayoutToolsPalette } from "./LayoutToolsPalette";

describe("LayoutToolsPalette", () => {
  it("keeps only day-to-day tools visible in the primary toolbar", () => {
    render(<LayoutToolsPalette mode="SELECT" onModeChange={vi.fn()} />);
    expect(screen.getByText("Manual adjustments")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Select \/ Edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Standard$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^VIP$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Couple$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Aisle$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Accessible$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More manual tools" })).toBeInTheDocument();
  });

  it("moves occasional tools into a compact More menu", async () => {
    const user = userEvent.setup();
    render(<LayoutToolsPalette mode="SELECT" onModeChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "More manual tools" }));
    expect(screen.getByRole("button", { name: /^Accessible$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Exit$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clear position/i })).toBeInTheDocument();
  });

  it("marks the active tool and changes mode", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<LayoutToolsPalette mode="SELECT" onModeChange={onModeChange} />);
    expect(screen.getByRole("button", { name: /Select \/ Edit/i })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /^VIP$/i }));
    expect(onModeChange).toHaveBeenCalledWith("VIP");
  });

  it("shows a practical instruction for Couple pairing", () => {
    render(<LayoutToolsPalette mode="COUPLE" onModeChange={vi.fn()} />);
    expect(screen.getByText(/two adjacent positions/i)).toBeInTheDocument();
  });

  it("disables primary and More controls in read-only state", () => {
    render(<LayoutToolsPalette mode="SELECT" onModeChange={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: /^VIP$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Select \/ Edit/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "More manual tools" })).toBeDisabled();
  });
});
