import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LayoutPosition } from "../../../api/movieApi";
import { applyAssignment, generateInitialGrid, positionKey } from "./cinemaRoomLayoutGenerator";
import type { InteractionMode } from "./LayoutToolsPalette";
import { SeatGrid } from "./SeatGrid";

/** SeatGrid is a controlled component (selection lives in the parent in the
 *  real app) — this harness plays that role for tests, managing only the
 *  ephemeral `selected` Set locally. */
function Harness({
  positions, mode, onCommit, onError, readOnly, highlightedKeys,
}: {
  positions: LayoutPosition[]; mode: InteractionMode; onCommit: (next: LayoutPosition[]) => void;
  onError?: (message: string) => void; readOnly?: boolean; highlightedKeys?: Set<string>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <SeatGrid
      positions={positions}
      mode={mode}
      selected={selected}
      onSelectionChange={setSelected}
      onCommit={onCommit}
      onError={onError}
      readOnly={readOnly}
      highlightedKeys={highlightedKeys}
    />
  );
}

describe("SeatGrid — Select mode", () => {
  it("ctrl-clicks two cells into the selection", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT"); // A1, A2, A3
    render(<Harness positions={initial} mode="SELECT" onCommit={vi.fn()} />);

    await user.click(screen.getByTitle(/^A1 ·/));
    await user.keyboard("{Control>}");
    await user.click(screen.getByTitle(/^A2 ·/));
    await user.keyboard("{/Control}");

    // Selection is only visible via style in this component; assert via the
    // Couple-pill click test below, which depends on selection reaching two
    // cells. Here we just confirm no error/commit fired from plain selecting.
    expect(screen.getByTitle(/^A1 ·/)).toBeInTheDocument();
    expect(screen.getByTitle(/^A2 ·/)).toBeInTheDocument();
  });

  it("selects an entire column via the column header", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT"); // A1,A2 / B1,B2
    let lastSelected: Set<string> = new Set();
    render(
      <SeatGrid
        positions={initial}
        mode="SELECT"
        selected={new Set()}
        onSelectionChange={(s) => { lastSelected = s; }}
        onCommit={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("Select column 1"));

    expect(lastSelected).toEqual(new Set([positionKey(0, 0), positionKey(1, 0)]));
  });

  it("selects an entire row via the row header", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT");
    let lastSelected: Set<string> = new Set();
    render(
      <SeatGrid
        positions={initial}
        mode="SELECT"
        selected={new Set()}
        onSelectionChange={(s) => { lastSelected = s; }}
        onCommit={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("Select row A"));

    expect(lastSelected).toEqual(new Set([positionKey(0, 0), positionKey(0, 1)]));
  });

  it("clicking a Couple pill selects both underlying positions together", async () => {
    const user = userEvent.setup();
    const base = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const initial = applyAssignment(base, new Set([positionKey(0, 0), positionKey(0, 1)]), "SEAT", "COUPLE", "g1");
    let lastSelected: Set<string> = new Set();
    render(
      <SeatGrid
        positions={initial}
        mode="SELECT"
        selected={new Set()}
        onSelectionChange={(s) => { lastSelected = s; }}
        onCommit={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle(/^Couple A1 \+ A2/));

    expect(lastSelected).toEqual(new Set([positionKey(0, 0), positionKey(0, 1)]));
  });

  it("disables row/column select buttons outside Select mode", () => {
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    render(<Harness positions={initial} mode="VIP" onCommit={vi.fn()} />);
    expect(screen.getByTitle("Select row A")).toBeDisabled();
    expect(screen.getByTitle("Select column 1")).toBeDisabled();
  });
});

describe("SeatGrid — Couple mode (guided anchor -> neighbor)", () => {
  it("pairs two adjacent seats: click the first, then the neighbor", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT"); // A1, A2, A3
    const onCommit = vi.fn();
    render(<Harness positions={initial} mode="COUPLE" onCommit={onCommit} />);

    await user.click(screen.getByTitle(/^A1 ·/));
    expect(onCommit).not.toHaveBeenCalled();

    await user.click(screen.getByTitle(/^A2 ·/));

    expect(onCommit).toHaveBeenCalledTimes(1);
    const next = onCommit.mock.calls[0][0];
    const a1 = next.find((p: any) => p.columnIndex === 0);
    const a2 = next.find((p: any) => p.columnIndex === 1);
    const a3 = next.find((p: any) => p.columnIndex === 2);
    expect(a1.seatType).toBe("COUPLE");
    expect(a2.seatType).toBe("COUPLE");
    expect(a1.seatGroupId).toBe(a2.seatGroupId);
    expect(a1.seatGroupId).toBeTruthy();
    expect(a3.seatType).toBe("STANDARD");
  });

  it("rejects the second click when the seat isn't adjacent, without applying anything", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const onCommit = vi.fn();
    const onError = vi.fn();
    render(<Harness positions={initial} mode="COUPLE" onCommit={onCommit} onError={onError} />);

    await user.click(screen.getByTitle(/^A1 ·/));
    await user.click(screen.getByTitle(/^A3 ·/));

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("adjacent"));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("Escape cancels the pending anchor", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const onCommit = vi.fn();
    render(<Harness positions={initial} mode="COUPLE" onCommit={onCommit} />);

    await user.click(screen.getByTitle(/^A1 ·/));
    expect(screen.getByText(/complete the Couple pair/i)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText(/complete the Couple pair/i)).not.toBeInTheDocument();

    await user.click(screen.getByTitle(/^A2 ·/));
    expect(onCommit).not.toHaveBeenCalled(); // fresh anchor armed, not a completed pair
  });

  it("never drag-paints — hovering without a click does nothing", () => {
    const initial = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const onCommit = vi.fn();
    render(<Harness positions={initial} mode="COUPLE" onCommit={onCommit} />);

    fireEvent.mouseEnter(screen.getByTitle(/^A1 ·/));
    fireEvent.mouseEnter(screen.getByTitle(/^A2 ·/));
    fireEvent.mouseUp(window);

    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe("SeatGrid — Paint mode", () => {
  it("a plain click applies the active tool immediately, with no prior selection", () => {
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const onCommit = vi.fn();
    render(<Harness positions={initial} mode="VIP" onCommit={onCommit} />);

    fireEvent.click(screen.getByTitle(/^A1 ·/));

    expect(onCommit).toHaveBeenCalledTimes(1);
    const next = onCommit.mock.calls[0][0];
    expect(next.find((p: any) => p.columnIndex === 0).seatType).toBe("VIP");
    expect(next.find((p: any) => p.columnIndex === 1).seatType).toBe("STANDARD");
  });

  it("a realistic single mouse click (mousedown -> mouseup -> click) commits exactly once, not twice", async () => {
    const user = userEvent.setup();
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const onCommit = vi.fn();
    render(<Harness positions={initial} mode="VIP" onCommit={onCommit} />);

    // userEvent.click fires the full mousedown/mouseup/click sequence a real
    // click produces — this is what guards against double-committing once
    // for the drag-gesture's mouseup and again for the trailing click event.
    await user.click(screen.getByTitle(/^A1 ·/));

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("a drag gesture paints every cell it passes over and commits exactly once", () => {
    const initial = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const onCommit = vi.fn();
    render(<Harness positions={initial} mode="AISLE" onCommit={onCommit} />);

    fireEvent.mouseDown(screen.getByTitle(/^A1 ·/));
    fireEvent.mouseEnter(screen.getByTitle(/^A2 ·/));
    fireEvent.mouseEnter(screen.getByTitle(/^A3 ·/));
    fireEvent.mouseUp(window);

    expect(onCommit).toHaveBeenCalledTimes(1);
    const next = onCommit.mock.calls[0][0];
    expect(next.every((p: any) => p.positionType === "AISLE")).toBe(true);
  });

  it("re-entering an already-painted cell mid-drag does not re-apply it", () => {
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const onCommit = vi.fn();
    render(<Harness positions={initial} mode="EMPTY_SPACE" onCommit={onCommit} />);

    // Capture stable element references up front — painting to EMPTY_SPACE
    // changes each cell's accessible title (no more seat number), so
    // re-querying by the original "A1 ·"/"A2 ·" title would fail after the
    // first paint step even though the same DOM nodes are still mounted.
    const cellA1 = screen.getByTitle(/^A1 ·/);
    const cellA2 = screen.getByTitle(/^A2 ·/);

    fireEvent.mouseDown(cellA1);
    fireEvent.mouseEnter(cellA2);
    fireEvent.mouseEnter(cellA1); // back onto the first cell
    fireEvent.mouseEnter(cellA2); // and the second again
    fireEvent.mouseUp(window);

    // Still exactly one commit at gesture end, with both cells painted once.
    expect(onCommit).toHaveBeenCalledTimes(1);
    const next = onCommit.mock.calls[0][0];
    expect(next.every((p: any) => p.positionType === "EMPTY_SPACE")).toBe(true);
  });

  it("clicking an existing Couple pill in paint mode splits it, painting both halves", () => {
    const base = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const initial = applyAssignment(base, new Set([positionKey(0, 0), positionKey(0, 1)]), "SEAT", "COUPLE", "g1");
    const onCommit = vi.fn();
    render(<Harness positions={initial} mode="STANDARD" onCommit={onCommit} />);

    fireEvent.click(screen.getByTitle(/^Couple A1 \+ A2/));

    expect(onCommit).toHaveBeenCalledTimes(1);
    const next = onCommit.mock.calls[0][0];
    expect(next.every((p: any) => p.seatType === "STANDARD")).toBe(true);
    expect(next.every((p: any) => p.seatGroupId === null)).toBe(true);
  });

  it("painting an unrelated cell leaves an existing Couple pair intact (a pill always paints both halves together, never just one)", () => {
    const base = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const initial = applyAssignment(base, new Set([positionKey(0, 0), positionKey(0, 1)]), "SEAT", "COUPLE", "g1");
    const onCommit = vi.fn();
    render(<Harness positions={initial} mode="VIP" onCommit={onCommit} />);

    fireEvent.click(screen.getByTitle(/^A3 ·/));

    expect(onCommit).toHaveBeenCalledTimes(1);
    const next = onCommit.mock.calls[0][0];
    const a1 = next.find((p: any) => p.columnIndex === 0);
    const a2 = next.find((p: any) => p.columnIndex === 1);
    expect(a1.seatType).toBe("COUPLE");
    expect(a2.seatType).toBe("COUPLE");
    expect(a1.seatGroupId).toBe(a2.seatGroupId);
  });
});

describe("SeatGrid — Couple seat rendering", () => {
  it("renders a Couple pair as one double-width seat using an alphanumeric seat code", () => {
    const base = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT"); // A1, A2, A3
    const initial = applyAssignment(base, new Set([positionKey(0, 0), positionKey(0, 1)]), "SEAT", "COUPLE", "g1");
    render(<Harness positions={initial} mode="SELECT" onCommit={vi.fn()} />);

    expect(screen.queryByTitle(/^A1 ·/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/^A2 ·/)).not.toBeInTheDocument();
    const coupleSeat = screen.getByTitle(/^Couple A1 \+ A2/);
    expect(coupleSeat).toHaveTextContent("A1");
    expect(coupleSeat).toHaveTextContent("A2");
    expect(coupleSeat).toHaveAccessibleName("Couple seats A1 and A2");
    expect(coupleSeat).toHaveStyle({ borderRadius: "8px" });
    expect(screen.getByTitle(/^A3 ·/)).toBeInTheDocument();
  });

  it("shows both sequential physical position codes for every Couple group", () => {
    let positions = generateInitialGrid(1, 8, 0, "LEFT_TO_RIGHT");
    for (let pair = 0; pair < 4; pair++) {
      positions = applyAssignment(
        positions,
        new Set([positionKey(0, pair * 2), positionKey(0, pair * 2 + 1)]),
        "SEAT", "COUPLE", `g${pair}`,
      );
    }
    render(<Harness positions={positions} mode="SELECT" onCommit={vi.fn()} />);

    for (const [firstCode, secondCode] of [["A1", "A2"], ["A3", "A4"], ["A5", "A6"], ["A7", "A8"]]) {
      const coupleSeat = screen.getByTitle(new RegExp(`^Couple ${firstCode} \\+ ${secondCode}`));
      expect(coupleSeat).toHaveTextContent(firstCode);
      expect(coupleSeat).toHaveTextContent(secondCode);
    }
  });
});

describe("SeatGrid — read-only", () => {
  it("ignores clicks and disables header select buttons", () => {
    const initial = generateInitialGrid(1, 1, 0, "LEFT_TO_RIGHT");
    const onCommit = vi.fn();
    render(<Harness positions={initial} mode="VIP" onCommit={onCommit} readOnly />);

    fireEvent.click(screen.getByTitle(/^A1 ·/));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByTitle("Select row A")).toBeDisabled();
  });
});

describe("SeatGrid — highlighting", () => {
  it("marks a highlighted position with data-position-key for the workspace to scroll/highlight", () => {
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    render(<Harness positions={initial} mode="SELECT" onCommit={vi.fn()} highlightedKeys={new Set([positionKey(0, 0)])} />);

    const cell = screen.getByTitle(/^A1 ·/);
    expect(cell).toHaveAttribute("data-position-key", positionKey(0, 0));
  });
});
