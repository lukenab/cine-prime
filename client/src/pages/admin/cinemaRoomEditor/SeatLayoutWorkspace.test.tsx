import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GridConfigForm } from "./cinemaRoomEditor.types";
import type { ValidationIssue } from "./cinemaRoomValidation";
import { applyAssignment, generateInitialGrid, positionKey } from "./cinemaRoomLayoutGenerator";
import { SeatLayoutWorkspace } from "./SeatLayoutWorkspace";
import { calculateRoomCapacityEnvelope } from "./cinemaRoomCapacity";

const gridConfig: GridConfigForm = { numberOfRows: 1, maxPositionsPerRow: 2, firstRowLabel: "A", numberingDirection: "LEFT_TO_RIGHT", numberingPolicy: "CONTIGUOUS_SEATS" };

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView — the validation panel's
  // jump-to-position action calls it, so stub it for these tests.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("SeatLayoutWorkspace", () => {
  it("supports undo after changing a selected seat from the contextual adjustment panel", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 1, 0, "LEFT_TO_RIGHT");
    const onChange = vi.fn();
    render(<SeatLayoutWorkspace positions={initial} onChange={onChange} gridConfig={gridConfig} onError={() => {}} layoutIssues={[]} />);

    await user.click(screen.getByTitle(/^A1 ·/));
    await user.click(screen.getByRole("button", { name: /^VIP$/i }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].seatType).toBe("VIP");

    await user.click(screen.getByRole("button", { name: /^Undo$/i }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].seatType).toBe("STANDARD");

    await user.click(screen.getByRole("button", { name: /^Redo$/i }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].seatType).toBe("VIP");
  });

  it("shows manual adjustments only after a seat or row is selected", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    render(<SeatLayoutWorkspace positions={initial} onChange={() => {}} gridConfig={gridConfig} onError={() => {}} layoutIssues={[]} />);

    expect(screen.queryByText("Manual adjustments")).not.toBeInTheDocument();
    await user.click(screen.getByTitle(/^A1 ·/));
    expect(screen.getByText("Manual adjustments")).toBeInTheDocument();
    expect(screen.getByText("Selected position")).toBeInTheDocument();
  });

  it("shows the Selection Inspector only once a position is selected", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    render(<SeatLayoutWorkspace positions={initial} onChange={() => {}} gridConfig={gridConfig} onError={() => {}} layoutIssues={[]} />);

    expect(screen.queryByText("No positions selected")).not.toBeInTheDocument();
    await user.click(screen.getByTitle(/^A1 ·/));
    expect(screen.getByText("Selected position")).toBeInTheDocument();
  });

  it("generates a fresh grid from gridConfig through Reset to Standard grid", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SeatLayoutWorkspace positions={[]} onChange={onChange} gridConfig={gridConfig} onError={() => {}} layoutIssues={[]} />);

    await user.click(screen.getByRole("button", { name: /Reset grid/i }));

    const next = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(next).toHaveLength(gridConfig.numberOfRows * gridConfig.maxPositionsPerRow);
  });

  it("asks for confirmation before clearing a non-empty layout, and only clears on confirm", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const onChange = vi.fn();
    render(<SeatLayoutWorkspace positions={initial} onChange={onChange} gridConfig={gridConfig} onError={() => {}} layoutIssues={[]} />);

    await user.click(screen.getByRole("button", { name: /^Clear$/i }));
    expect(screen.getByText("Clear Layout?")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    const clearButtons = screen.getAllByRole("button", { name: /Clear Layout/i });
    await user.click(clearButtons[clearButtons.length - 1]);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("cancelling the clear-layout confirmation leaves positions unchanged", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const onChange = vi.fn();
    render(<SeatLayoutWorkspace positions={initial} onChange={onChange} gridConfig={gridConfig} onError={() => {}} layoutIssues={[]} />);

    await user.click(screen.getByRole("button", { name: /^Clear$/i }));
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Clear Layout?")).not.toBeInTheDocument();
  });

  it("does not render zoom controls that do not change the authored layout", () => {
    const initial = generateInitialGrid(1, 1, 0, "LEFT_TO_RIGHT");
    render(<SeatLayoutWorkspace positions={initial} onChange={() => {}} gridConfig={gridConfig} onError={() => {}} layoutIssues={[]} />);

    expect(screen.queryByRole("button", { name: /Zoom in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Zoom out/i })).not.toBeInTheDocument();
  });

  it("keeps the live room capacity visible above the seat map", () => {
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const envelope = calculateRoomCapacityEnvelope(
      { cinemaRoomName: "Room", roomCode: "R01", auditoriumClassId: 1, lengthM: "20", widthM: "15", clearHeightM: "3" },
      { projectionTechnologyId: 1, resolutionId: 1, screenWidthM: "10", screenHeightM: "5", audioFormatId: 1, supports2d: true, supports3d: false },
      initial,
    );

    render(<SeatLayoutWorkspace positions={initial} onChange={() => {}} gridConfig={gridConfig} onError={() => {}} layoutIssues={[]} capacityEnvelope={envelope} />);

    expect(screen.getByLabelText("Planned capacity 2 of 225 people")).toBeInTheDocument();
  });

  it("renders a read-only empty state without the toolbar's editing controls or the Inspector", () => {
    render(<SeatLayoutWorkspace positions={[]} onChange={() => {}} gridConfig={gridConfig} onError={() => {}} layoutIssues={[]} readOnly />);
    expect(screen.getByText("This layout has no positions yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate Layout/i })).not.toBeInTheDocument();
    expect(screen.queryByText("No positions selected")).not.toBeInTheDocument();
  });

  it("toggles the validation panel from the toolbar badge and shows the issues", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const issues: ValidationIssue[] = [
      { message: "Couple seat A1 is missing its pair.", severity: "error", positionKeys: [positionKey(0, 0)] },
    ];
    render(<SeatLayoutWorkspace positions={initial} onChange={() => {}} gridConfig={gridConfig} onError={() => {}} layoutIssues={issues} />);

    expect(screen.queryByText("Layout Validation")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "1 validation issue" }));
    expect(screen.getByText("Layout Validation")).toBeInTheDocument();
    expect(screen.getByText("Couple seat A1 is missing its pair.")).toBeInTheDocument();
  });

  it("clicking an issue scrolls to and highlights the affected position", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const issues: ValidationIssue[] = [
      { message: "Couple seat A1 is missing its pair.", severity: "error", positionKeys: [positionKey(0, 0)] },
    ];
    render(<SeatLayoutWorkspace positions={initial} onChange={() => {}} gridConfig={gridConfig} onError={() => {}} layoutIssues={issues} />);

    await user.click(screen.getByRole("button", { name: "1 validation issue" }));
    await user.click(screen.getByText("Couple seat A1 is missing its pair."));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("copying a row in the Inspector and pasting it onto another row updates the layout", async () => {
    const user = userEvent.setup();
    const twoRowConfig: GridConfigForm = { ...gridConfig, numberOfRows: 2 };
    const base = generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT"); // A1,A2 / B1,B2 — row actions only
    // appear once a whole-row selection covers 2+ positions (the single-
    // position Inspector state has no row actions).
    const initial = applyAssignment(base, new Set([positionKey(0, 0), positionKey(0, 1)]), "SEAT", "VIP", null); // row A is VIP
    const onChange = vi.fn();
    render(<SeatLayoutWorkspace positions={initial} onChange={onChange} gridConfig={twoRowConfig} onError={() => {}} layoutIssues={[]} />);

    await user.click(screen.getByTitle("Select row A")); // Select mode is the default
    await user.click(screen.getByRole("button", { name: /Copy Row/i }));

    await user.click(screen.getByTitle("Select row B"));
    await user.click(screen.getByRole("button", { name: /Paste Row/i }));

    const pasted = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const rowB = pasted.filter((p: any) => p.rowLabel === "B");
    expect(rowB.every((p: any) => p.seatType === "VIP")).toBe(true);
  });
});
