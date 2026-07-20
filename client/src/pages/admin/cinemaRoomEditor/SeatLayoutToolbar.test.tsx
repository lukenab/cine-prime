import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LayoutStats } from "./cinemaRoomLayoutGenerator";
import { SeatLayoutToolbar } from "./SeatLayoutToolbar";

const stats: LayoutStats = {
  gridPositionCount: 11,
  physicalSeatPositionCount: 10,
  standardCount: 6,
  vipCount: 2,
  coupleGroupCount: 1,
  coupleCapacity: 2,
  incompleteCoupleGroupIds: [],
  accessibleCount: 0,
  wheelchairCount: 0,
  aisleCount: 0,
  exitCount: 0,
  emptySpaceCount: 1,
  sellableCapacity: 10,
  sellableUnitCount: 9,
};

const baseProps = {
  canUndo: false, canRedo: false, onUndo: vi.fn(), onRedo: vi.fn(),
  onGenerate: vi.fn(), onClear: vi.fn(), stats,
  issueCount: 0, validationPanelOpen: false, onToggleValidationPanel: vi.fn(),
};

describe("SeatLayoutToolbar", () => {
  it("shows ticket capacity without exposing internal physical-position counters", () => {
    const withStray: LayoutStats = { ...stats, sellableCapacity: 9, incompleteCoupleGroupIds: ["stray"] };
    render(<SeatLayoutToolbar {...baseProps} stats={withStray} />);

    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Sellable seats")).toBeInTheDocument();
    expect(screen.queryByText("Physical Positions")).not.toBeInTheDocument();
    expect(screen.queryByText("Non-seat")).not.toBeInTheDocument();
  });

  it("shows Couple inventory as seats and familiar pairs instead of internal groups", () => {
    render(<SeatLayoutToolbar {...baseProps} />);
    expect(screen.getByText("2 seats (1 pair)")).toBeInTheDocument();
  });

  it("keeps technical empty/aisle/exit counters out of the compact overview", () => {
    const withAislesAndExits: LayoutStats = { ...stats, aisleCount: 3, exitCount: 2, emptySpaceCount: 4 };
    render(<SeatLayoutToolbar {...baseProps} stats={withAislesAndExits} />);
    expect(screen.queryByText(/4 empty/)).not.toBeInTheDocument();
  });

  it("renders a validation issues badge that reflects the count and toggles the panel on click", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<SeatLayoutToolbar {...baseProps} issueCount={3} onToggleValidationPanel={onToggle} />);

    const badge = screen.getByRole("button", { name: "3 validation issues" });
    expect(badge).toHaveAttribute("aria-expanded", "false");
    await user.click(badge);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("reflects validationPanelOpen via aria-expanded", () => {
    render(<SeatLayoutToolbar {...baseProps} validationPanelOpen />);
    expect(screen.getByRole("button", { name: "0 validation issues" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps seat-type counts visible at the top instead of hiding them in details", () => {
    render(<SeatLayoutToolbar {...baseProps} />);
    expect(screen.queryByText("Seat mix")).not.toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.queryByLabelText("Seat type distribution")).not.toBeInTheDocument();
  });

  it("shows zero-count seat types so the operator always sees the complete inventory summary", () => {
    render(<SeatLayoutToolbar {...baseProps} />);
    expect(screen.getByText("Accessible")).toBeInTheDocument();
  });

  it("keeps reset and destructive operations visible without an overflow menu", async () => {
    const user = userEvent.setup();
    render(<SeatLayoutToolbar {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /Reset grid/i }));
    await user.click(screen.getByRole("button", { name: /^Clear$/i }));
    expect(baseProps.onGenerate).toHaveBeenCalled();
    expect(baseProps.onClear).toHaveBeenCalled();
  });

  it("hides layout-modifying actions in read-only mode and does not render zoom controls", () => {
    render(<SeatLayoutToolbar {...baseProps} readOnly />);

    expect(screen.queryByRole("button", { name: /Reset grid/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Clear$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Zoom in/i })).not.toBeInTheDocument();
    expect(screen.getByText("Seat layout overview")).toBeInTheDocument();
  });
});
