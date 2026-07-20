import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { applyAssignment, copyRowPattern, generateInitialGrid, positionKey } from "./cinemaRoomLayoutGenerator";
import { SelectionInspector } from "./SelectionInspector";

describe("SelectionInspector — no selection", () => {
  it("shows a hint and keyboard shortcuts", () => {
    const positions = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    render(
      <SelectionInspector positions={positions} selected={new Set()} onCommit={vi.fn()} onClearSelection={vi.fn()} copiedRowPattern={null} onCopyRow={vi.fn()} />,
    );
    expect(screen.getByText("No positions selected")).toBeInTheDocument();
    expect(screen.getByText(/Escape clears the selection/i)).toBeInTheDocument();
  });
});

describe("SelectionInspector — single position", () => {
  it("shows seat details for a single SEAT position", () => {
    const positions = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    render(
      <SelectionInspector
        positions={positions} selected={new Set([positionKey(0, 0)])}
        onCommit={vi.fn()} onClearSelection={vi.fn()} copiedRowPattern={null} onCopyRow={vi.fn()}
      />,
    );
    expect(screen.getByText("Selected position")).toBeInTheDocument();
    expect(screen.getByText("Manual adjustments")).toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getAllByText("Standard").length).toBeGreaterThanOrEqual(1);
    // "1" appears twice (Column and Sellable capacity) — just confirm the count.
    expect(screen.getAllByText("1")).toHaveLength(2);
  });

  it("shows a non-seat position (Aisle) with zero sellable capacity", () => {
    const base = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const positions = applyAssignment(base, new Set([positionKey(0, 0)]), "AISLE", null, null);
    render(
      <SelectionInspector
        positions={positions} selected={new Set([positionKey(0, 0)])}
        onCommit={vi.fn()} onClearSelection={vi.fn()} copiedRowPattern={null} onCopyRow={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Aisle").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("clears the selection via the close button", async () => {
    const user = userEvent.setup();
    const positions = generateInitialGrid(1, 1, 0, "LEFT_TO_RIGHT");
    const onClearSelection = vi.fn();
    render(
      <SelectionInspector
        positions={positions} selected={new Set([positionKey(0, 0)])}
        onCommit={vi.fn()} onClearSelection={onClearSelection} copiedRowPattern={null} onCopyRow={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Clear selection/i }));
    expect(onClearSelection).toHaveBeenCalled();
  });
});

describe("SelectionInspector — Couple group", () => {
  it("shows the display code, both position codes, and capacity 2 for a complete pair", () => {
    const base = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const positions = applyAssignment(base, new Set([positionKey(0, 0), positionKey(0, 1)]), "SEAT", "COUPLE", "g1");
    render(
      <SelectionInspector
        positions={positions} selected={new Set([positionKey(0, 0), positionKey(0, 1)])}
        onCommit={vi.fn()} onClearSelection={vi.fn()} copiedRowPattern={null} onCopyRow={vi.fn()}
      />,
    );
    expect(screen.getByText("Selected Couple Group")).toBeInTheDocument();
    expect(screen.getByText("A1–A2")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    // The full UUID is tucked away, not shown as the headline value.
    expect(screen.queryByText("g1")).not.toBeInTheDocument();
  });
});

describe("SelectionInspector — multi-selection", () => {
  it("aggregates counts by type and computes total sellable capacity", () => {
    const base = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const positions = applyAssignment(base, new Set([positionKey(0, 1)]), "SEAT", "VIP", null);
    const selected = new Set([positionKey(0, 0), positionKey(0, 1), positionKey(0, 2)]);
    render(
      <SelectionInspector positions={positions} selected={selected} onCommit={vi.fn()} onClearSelection={vi.fn()} copiedRowPattern={null} onCopyRow={vi.fn()} />,
    );
    expect(screen.getByText("3 positions selected")).toBeInTheDocument();
    expect(screen.getAllByText("Standard").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 Standard
    expect(screen.getAllByText("VIP").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("3")).toBeInTheDocument(); // sellable capacity: 2 standard + 1 VIP
  });

  it("bulk-assigns the selection and clears it afterward", async () => {
    const user = userEvent.setup();
    const positions = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const onCommit = vi.fn();
    const onClearSelection = vi.fn();
    const selected = new Set([positionKey(0, 0), positionKey(0, 1)]);
    render(
      <SelectionInspector positions={positions} selected={selected} onCommit={onCommit} onClearSelection={onClearSelection} copiedRowPattern={null} onCopyRow={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /^VIP$/i }));

    expect(onCommit).toHaveBeenCalled();
    const next = onCommit.mock.calls[0][0];
    expect(next.find((p: any) => p.columnIndex === 0).seatType).toBe("VIP");
    expect(next.find((p: any) => p.columnIndex === 1).seatType).toBe("VIP");
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("does not offer row/column actions for a partial (non-whole-row) selection", () => {
    const positions = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const selected = new Set([positionKey(0, 0), positionKey(0, 1)]); // 2 of 3 in the row
    render(
      <SelectionInspector positions={positions} selected={selected} onCommit={vi.fn()} onClearSelection={vi.fn()} copiedRowPattern={null} onCopyRow={vi.fn()} />,
    );
    expect(screen.queryByText(/Row .* actions/i)).not.toBeInTheDocument();
  });

  it("offers row actions when the whole row is selected", () => {
    const positions = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const selected = new Set([positionKey(0, 0), positionKey(0, 1)]);
    render(
      <SelectionInspector positions={positions} selected={selected} onCommit={vi.fn()} onClearSelection={vi.fn()} copiedRowPattern={null} onCopyRow={vi.fn()} />,
    );
    expect(screen.getByText("Row A actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Convert Row to Couple/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy Row/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Paste Row/i })).not.toBeInTheDocument(); // nothing copied yet
  });

  it("offers column actions when the whole column is selected", () => {
    const positions = generateInitialGrid(2, 1, 0, "LEFT_TO_RIGHT");
    const selected = new Set([positionKey(0, 0), positionKey(1, 0)]);
    render(
      <SelectionInspector positions={positions} selected={selected} onCommit={vi.fn()} onClearSelection={vi.fn()} copiedRowPattern={null} onCopyRow={vi.fn()} />,
    );
    expect(screen.getByText("Column 1 actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Convert Column to Aisle/i })).toBeInTheDocument();
  });

  it("shows Paste Row once a row has been copied", () => {
    const positions = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const selected = new Set([positionKey(0, 0), positionKey(0, 1)]);
    const pattern = copyRowPattern(positions, 0);
    render(
      <SelectionInspector positions={positions} selected={selected} onCommit={vi.fn()} onClearSelection={vi.fn()} copiedRowPattern={pattern} onCopyRow={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /Paste Row/i })).toBeInTheDocument();
  });

  it("asks for confirmation before converting a row to Couple, and reports the odd-leftover warning via onNotice", async () => {
    const user = userEvent.setup();
    const positions = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT"); // odd width
    const selected = new Set([positionKey(0, 0), positionKey(0, 1), positionKey(0, 2)]);
    const onCommit = vi.fn();
    const onNotice = vi.fn();
    render(
      <SelectionInspector
        positions={positions} selected={selected} onCommit={onCommit} onClearSelection={vi.fn()}
        copiedRowPattern={null} onCopyRow={vi.fn()} onNotice={onNotice}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Convert Row to Couple/i }));
    expect(screen.getByText("Convert row to Couple seats?")).toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Convert to Couple/i }));
    expect(onCommit).toHaveBeenCalled();
    expect(onNotice).toHaveBeenCalledWith(expect.stringContaining("odd number of positions"));
  });
});
