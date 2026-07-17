import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DistributionTemplateForm } from "./cinemaRoomEditor.types";
import { generateInitialGrid } from "./cinemaRoomLayoutGenerator";
import { SeatDistributionSection } from "./SeatDistributionSection";

const value: DistributionTemplateForm = { standardPct: 50, vipPct: 25, couplePct: 25 };

describe("SeatDistributionSection", () => {
  it("previews the row allocation for all three percentages, including Couple", () => {
    const positions = generateInitialGrid(4, 2, 0, "LEFT_TO_RIGHT");
    render(
      <SeatDistributionSection value={value} onChange={() => {}} positions={positions} onApply={() => {}} onWarnings={() => {}} />,
    );

    expect(screen.getByText("2 Standard row(s)")).toBeInTheDocument();
    expect(screen.getByText("1 VIP row(s)")).toBeInTheDocument();
    expect(screen.getByText("1 Couple row(s)")).toBeInTheDocument();
  });

  it("applies immediately when the layout has no manual customization yet", async () => {
    const user = userEvent.setup();
    const positions = generateInitialGrid(4, 2, 0, "LEFT_TO_RIGHT"); // fresh, all-Standard grid
    const onApply = vi.fn();
    render(
      <SeatDistributionSection value={value} onChange={() => {}} positions={positions} onApply={onApply} onWarnings={() => {}} />,
    );

    await user.click(screen.getByRole("button", { name: /Apply Template/i }));

    expect(onApply).toHaveBeenCalled();
    expect(screen.queryByText("Overwrite the current layout?")).not.toBeInTheDocument();
  });

  it("asks for confirmation before overwriting a manually customized layout", async () => {
    const user = userEvent.setup();
    const positions = generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT").map((p, i) => (i === 0 ? { ...p, seatType: "VIP" as const } : p));
    const onApply = vi.fn();
    render(
      <SeatDistributionSection value={value} onChange={() => {}} positions={positions} onApply={onApply} onWarnings={() => {}} />,
    );

    await user.click(screen.getByRole("button", { name: /Apply Template/i }));
    expect(screen.getByText("Overwrite the current layout?")).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();

    // Two "Apply Template" buttons are now on screen: the section's trigger and
    // the dialog's confirm button — the confirm button is the second one rendered.
    const applyButtons = screen.getAllByRole("button", { name: /Apply Template/i });
    await user.click(applyButtons[applyButtons.length - 1]);
    expect(onApply).toHaveBeenCalled();
  });

  it("lets the user type the Couple percentage independently of Standard/VIP", () => {
    const onChange = vi.fn();
    const positions = generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT");
    render(
      <SeatDistributionSection value={value} onChange={onChange} positions={positions} onApply={() => {}} onWarnings={() => {}} />,
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "Couple percentage" }), { target: { value: "40" } });

    expect(onChange).toHaveBeenCalledWith({ ...value, couplePct: 40 });
  });

  it("clamps typed percentages to the 0-100 range", () => {
    const onChange = vi.fn();
    const positions = generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT");
    render(
      <SeatDistributionSection value={value} onChange={onChange} positions={positions} onApply={() => {}} onWarnings={() => {}} />,
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "Standard percentage" }), { target: { value: "150" } });
    expect(onChange).toHaveBeenCalledWith({ ...value, standardPct: 100 });

    fireEvent.change(screen.getByRole("spinbutton", { name: "VIP percentage" }), { target: { value: "-20" } });
    expect(onChange).toHaveBeenCalledWith({ ...value, vipPct: 0 });
  });

  it("flags when the three percentages add up to more than 100% and blocks Apply", () => {
    const onApply = vi.fn();
    const positions = generateInitialGrid(4, 2, 0, "LEFT_TO_RIGHT");
    const overBudget: DistributionTemplateForm = { standardPct: 60, vipPct: 60, couplePct: 0 };
    render(
      <SeatDistributionSection value={overBudget} onChange={() => {}} positions={positions} onApply={onApply} onWarnings={() => {}} />,
    );

    expect(screen.getByText(/Total is 120% — Standard \+ VIP \+ Couple can't add up to more than 100%\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply Template/i })).toBeDisabled();
  });
});
