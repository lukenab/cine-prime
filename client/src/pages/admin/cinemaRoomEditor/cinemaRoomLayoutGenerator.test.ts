import { describe, expect, it } from "vitest";
import type { LayoutPosition } from "../../../api/movieApi";
import {
  adjustColumnCount, adjustRowCount, applyAssignment, applySeatDistributionTemplate,
  computeLayoutStats, computeResizeImpact, computeTemplateAllocation,
  convertColumnToAisle, convertRowToCouple, copyRowPattern, excelRowLabel,
  expandToWholeCoupleGroups, generateInitialGrid, generateLayoutFromAssistant,
  mirrorRow, pasteRowPattern, positionKey, renumberLayout,
} from "./cinemaRoomLayoutGenerator";
import type { LayoutAssistantForm } from "./cinemaRoomEditor.types";

describe("excelRowLabel", () => {
  it("labels the first 26 rows A through Z", () => {
    expect(excelRowLabel(0)).toBe("A");
    expect(excelRowLabel(1)).toBe("B");
    expect(excelRowLabel(25)).toBe("Z");
  });

  it("continues past Z with AA, AB, ...", () => {
    expect(excelRowLabel(26)).toBe("AA");
    expect(excelRowLabel(27)).toBe("AB");
    expect(excelRowLabel(51)).toBe("AZ");
    expect(excelRowLabel(52)).toBe("BA");
  });

  it("does not limit the system to 26 rows", () => {
    expect(excelRowLabel(701)).toBe("ZZ");
    expect(excelRowLabel(702)).toBe("AAA");
  });
});

describe("generateInitialGrid", () => {
  it("builds a rows x columns grid of all-Standard seats, left-to-right", () => {
    const grid = generateInitialGrid(2, 3, 0, "LEFT_TO_RIGHT");
    expect(grid).toHaveLength(6);
    const rowA = grid.filter((p) => p.rowLabel === "A");
    expect(rowA.map((p) => p.seatNumber)).toEqual([1, 2, 3]);
    expect(rowA.every((p) => p.positionType === "SEAT" && p.seatType === "STANDARD")).toBe(true);
  });

  it("numbers right-to-left when requested", () => {
    const grid = generateInitialGrid(1, 3, 0, "RIGHT_TO_LEFT");
    const seatNumbers = grid.sort((a, b) => a.columnIndex - b.columnIndex).map((p) => p.seatNumber);
    expect(seatNumbers).toEqual([3, 2, 1]);
  });

  it("honors a non-zero starting row label index", () => {
    const grid = generateInitialGrid(1, 1, 26, "LEFT_TO_RIGHT"); // index 26 -> "AA"
    expect(grid[0].rowLabel).toBe("AA");
  });
});

describe("adjustRowCount", () => {
  it("appends new Standard rows at the bottom, continuing the row-label sequence", () => {
    const initial = generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT"); // A, B
    const next = adjustRowCount(initial, 3, "LEFT_TO_RIGHT");
    expect([...new Set(next.map((p) => p.rowLabel))]).toEqual(["A", "B", "C"]);
    const rowC = next.filter((p) => p.rowLabel === "C");
    expect(rowC.map((p) => p.seatType)).toEqual(["STANDARD", "STANDARD"]);
  });

  it("drops rows from the bottom when shrinking, preserving earlier rows' edits untouched", () => {
    const initial = generateInitialGrid(3, 1, 0, "LEFT_TO_RIGHT");
    const edited = applyAssignment(initial, new Set([positionKey(0, 0)]), "SEAT", "VIP", null);
    const next = adjustRowCount(edited, 1, "LEFT_TO_RIGHT");
    expect(next).toHaveLength(1);
    expect(next[0].seatType).toBe("VIP");
  });
});

describe("adjustColumnCount", () => {
  it("appends new Standard columns at the right edge and renumbers every seat afterward", () => {
    const initial = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT"); // A1, A2
    const next = adjustColumnCount(initial, 3, "LEFT_TO_RIGHT");
    const seatCodes = [...next].sort((a, b) => a.columnIndex - b.columnIndex).map((p) => p.seatCode);
    expect(seatCodes).toEqual(["A1", "A2", "A3"]);
  });

  it("renumbers right-to-left after growing so the leftmost seat keeps the highest number", () => {
    const initial = generateInitialGrid(1, 2, 0, "RIGHT_TO_LEFT"); // A2, A1
    const next = adjustColumnCount(initial, 3, "RIGHT_TO_LEFT");
    const byCol = [...next].sort((a, b) => a.columnIndex - b.columnIndex);
    expect(byCol.map((p) => p.seatNumber)).toEqual([3, 2, 1]);
  });

  it("drops columns from the right when shrinking", () => {
    const initial = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const next = adjustColumnCount(initial, 2, "LEFT_TO_RIGHT");
    expect(next).toHaveLength(2);
    expect(next.map((p) => p.columnIndex).sort()).toEqual([0, 1]);
  });

  it("converts a Couple pair's stranded survivor to EMPTY_SPACE instead of leaving a broken pair", () => {
    const base = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT"); // A1, A2, A3
    const paired = applyAssignment(base, new Set([positionKey(0, 1), positionKey(0, 2)]), "SEAT", "COUPLE", "g1"); // A2+A3 couple
    const next = adjustColumnCount(paired, 2, "LEFT_TO_RIGHT"); // drops column 2 (A3), stranding A2's pair
    const survivor = next.find((p) => p.columnIndex === 1)!;
    expect(survivor.positionType).toBe("EMPTY_SPACE");
    expect(survivor.seatType).toBeNull();
    expect(survivor.seatGroupId).toBeNull();
  });

  it("keeps an intact Couple pair as-is when shrinking doesn't touch either half", () => {
    const base = generateInitialGrid(1, 4, 0, "LEFT_TO_RIGHT"); // A1..A4
    const paired = applyAssignment(base, new Set([positionKey(0, 0), positionKey(0, 1)]), "SEAT", "COUPLE", "g1"); // A1+A2 couple
    const next = adjustColumnCount(paired, 3, "LEFT_TO_RIGHT"); // drops column 3 only, pair untouched
    const a1 = next.find((p) => p.columnIndex === 0)!;
    const a2 = next.find((p) => p.columnIndex === 1)!;
    expect(a1.seatType).toBe("COUPLE");
    expect(a2.seatType).toBe("COUPLE");
    expect(a1.seatGroupId).toBe(a2.seatGroupId);
  });
});

describe("computeResizeImpact", () => {
  it("reports zero impact when growing", () => {
    const positions = generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT");
    expect(computeResizeImpact(positions, "row", 5)).toEqual({ removedCount: 0, removedSeatCount: 0, affectedCoupleGroupIds: [] });
  });

  it("reports zero impact when the removed slice has no seats", () => {
    const base = generateInitialGrid(2, 1, 0, "LEFT_TO_RIGHT");
    const withEmptyRow = applyAssignment(base, new Set([positionKey(1, 0)]), "EMPTY_SPACE", null, null);
    const impact = computeResizeImpact(withEmptyRow, "row", 1);
    expect(impact.removedCount).toBe(1);
    expect(impact.removedSeatCount).toBe(0);
  });

  it("counts removed seats and affected Couple groups when shrinking through configured seats", () => {
    const base = generateInitialGrid(1, 4, 0, "LEFT_TO_RIGHT");
    const paired = applyAssignment(base, new Set([positionKey(0, 2), positionKey(0, 3)]), "SEAT", "COUPLE", "g1");
    const impact = computeResizeImpact(paired, "column", 2);
    expect(impact.removedCount).toBe(2);
    expect(impact.removedSeatCount).toBe(2);
    expect(impact.affectedCoupleGroupIds).toEqual(["g1"]);
  });
});

describe("computeTemplateAllocation", () => {
  it("matches the spec-worked example: 10 rows, 30/60/10 -> 3/6/1", () => {
    expect(computeTemplateAllocation(10, 30, 60, 10)).toEqual({ standardRowCount: 3, vipRowCount: 6, coupleRowCount: 1 });
  });

  it("matches the spec-worked example: 12 rows, 30/60/10 -> 4/7/1 (largest remainder wins the leftover row)", () => {
    expect(computeTemplateAllocation(12, 30, 60, 10)).toEqual({ standardRowCount: 4, vipRowCount: 7, coupleRowCount: 1 });
  });

  it("normalizes percentages that don't sum to 100", () => {
    // 20/20/0 normalizes to 50/50/0 of the rows.
    const result = computeTemplateAllocation(8, 20, 20, 0);
    expect(result).toEqual({ standardRowCount: 4, vipRowCount: 4, coupleRowCount: 0 });
  });

  it("never loses or duplicates a row regardless of rounding", () => {
    for (let rows = 1; rows <= 15; rows++) {
      const result = computeTemplateAllocation(rows, 33, 47, 20);
      expect(result.standardRowCount + result.vipRowCount + result.coupleRowCount).toBe(rows);
    }
  });

  it("handles very small row counts safely", () => {
    expect(computeTemplateAllocation(0, 30, 60, 10)).toEqual({ standardRowCount: 0, vipRowCount: 0, coupleRowCount: 0 });
    // A single row goes to whichever category has the largest proportional share (VIP, at 60%).
    expect(computeTemplateAllocation(1, 30, 60, 10)).toEqual({ standardRowCount: 0, vipRowCount: 1, coupleRowCount: 0 });
  });

  it("can set the Couple percentage to zero to disable Couple rows entirely", () => {
    const result = computeTemplateAllocation(10, 30, 60, 0);
    expect(result.coupleRowCount).toBe(0);
    expect(result.standardRowCount + result.vipRowCount).toBe(10);
  });

  it("treats an all-zero split as no allocation at all", () => {
    expect(computeTemplateAllocation(10, 0, 0, 0)).toEqual({ standardRowCount: 0, vipRowCount: 0, coupleRowCount: 0 });
  });
});

describe("applySeatDistributionTemplate", () => {
  it("assigns front rows to Standard, the middle to VIP, and pairs the trailing row(s) into Couples", () => {
    const initial = generateInitialGrid(4, 2, 0, "LEFT_TO_RIGHT"); // rows A,B,C,D
    // 50/25/25 of 4 rows -> exactly 2 Standard, 1 VIP, 1 Couple, no rounding involved.
    const { positions: next, warnings } = applySeatDistributionTemplate(initial, 50, 25, 25);
    const byRow = (label: string) => next.filter((p) => p.rowLabel === label);
    expect(byRow("A").every((p) => p.seatType === "STANDARD")).toBe(true);
    expect(byRow("B").every((p) => p.seatType === "STANDARD")).toBe(true);
    expect(byRow("C").every((p) => p.seatType === "VIP")).toBe(true);
    const rowD = byRow("D");
    expect(rowD.every((p) => p.seatType === "COUPLE")).toBe(true);
    expect(rowD[0].seatGroupId).toBe(rowD[1].seatGroupId);
    expect(warnings).toEqual([]);
  });

  it("converts an odd Couple-row leftover to EMPTY_SPACE and reports a warning", () => {
    const initial = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT"); // single row, odd width
    const { positions: next, warnings } = applySeatDistributionTemplate(initial, 0, 0, 100);
    const sorted = [...next].sort((a, b) => a.columnIndex - b.columnIndex);
    expect(sorted[0].seatType).toBe("COUPLE");
    expect(sorted[1].seatType).toBe("COUPLE");
    expect(sorted[2].positionType).toBe("EMPTY_SPACE");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/odd number of positions/i);
  });

  it("leaves AISLE/EXIT/EMPTY_SPACE cells untouched", () => {
    const initial: LayoutPosition[] = [
      { rowIndex: 0, columnIndex: 0, rowLabel: "A", positionType: "SEAT", seatNumber: 1, seatCode: "A1", seatType: "STANDARD" },
      { rowIndex: 0, columnIndex: 1, rowLabel: "A", positionType: "AISLE" },
      { rowIndex: 0, columnIndex: 2, rowLabel: "A", positionType: "SEAT", seatNumber: 2, seatCode: "A2", seatType: "STANDARD" },
    ];
    const { positions: next } = applySeatDistributionTemplate(initial, 100, 0, 0);
    expect(next.find((p) => p.positionType === "AISLE")).toBeTruthy();
  });
});

describe("computeLayoutStats", () => {
  function seat(row: number, col: number, seatType: LayoutPosition["seatType"], groupId?: string): LayoutPosition {
    return {
      rowIndex: row, columnIndex: col, rowLabel: "A",
      positionType: "SEAT", seatNumber: col + 1, seatCode: `A${col + 1}`,
      seatType, seatGroupId: groupId ?? null,
    };
  }

  it("counts standard/VIP/accessible as 1 person + 1 sellable unit each", () => {
    const stats = computeLayoutStats([
      seat(0, 0, "STANDARD"),
      seat(0, 1, "VIP"),
      seat(0, 2, "ACCESSIBLE"),
    ]);
    expect(stats.standardCount).toBe(1);
    expect(stats.vipCount).toBe(1);
    expect(stats.accessibleCount).toBe(1);
    expect(stats.sellableCapacity).toBe(3);
    expect(stats.sellableUnitCount).toBe(3);
    expect(stats.physicalSeatPositionCount).toBe(3);
  });

  it("counts a Couple group as 2 people but only 1 sellable unit, not double-counted", () => {
    const stats = computeLayoutStats([
      seat(0, 0, "COUPLE", "g1"),
      seat(0, 1, "COUPLE", "g1"),
    ]);
    expect(stats.coupleGroupCount).toBe(1);
    expect(stats.coupleCapacity).toBe(2);
    expect(stats.sellableCapacity).toBe(2);
    expect(stats.sellableUnitCount).toBe(1);
    expect(stats.physicalSeatPositionCount).toBe(2);
    expect(stats.incompleteCoupleGroupIds).toEqual([]);
  });

  it("excludes an incomplete/stray Couple half from capacity, but still counts it as a physical seat position", () => {
    const stats = computeLayoutStats([
      seat(0, 0, "COUPLE", "g1"), // no partner with this groupId
      seat(0, 1, "STANDARD"),
    ]);
    expect(stats.coupleGroupCount).toBe(0);
    expect(stats.coupleCapacity).toBe(0);
    expect(stats.incompleteCoupleGroupIds).toEqual(["g1"]);
    expect(stats.physicalSeatPositionCount).toBe(2); // the stray half still physically exists
    expect(stats.sellableCapacity).toBe(1); // only the Standard seat — the stray Couple half contributes nothing
  });

  it("counts AISLE and EXIT positions (previously silently excluded from the total)", () => {
    const stats = computeLayoutStats([
      { rowIndex: 0, columnIndex: 0, rowLabel: "A", positionType: "AISLE" },
      { rowIndex: 0, columnIndex: 1, rowLabel: "A", positionType: "EXIT" },
      { rowIndex: 0, columnIndex: 2, rowLabel: "A", positionType: "EMPTY_SPACE" },
    ]);
    expect(stats.aisleCount).toBe(1);
    expect(stats.exitCount).toBe(1);
    expect(stats.emptySpaceCount).toBe(1);
    expect(stats.gridPositionCount).toBe(3);
    expect(stats.physicalSeatPositionCount).toBe(0);
    expect(stats.sellableCapacity).toBe(0);
    expect(stats.sellableUnitCount).toBe(0);
  });

  it("gridPositionCount includes every position regardless of type", () => {
    const stats = computeLayoutStats(generateInitialGrid(2, 3, 0, "LEFT_TO_RIGHT"));
    expect(stats.gridPositionCount).toBe(6);
  });
});

describe("convertRowToCouple", () => {
  it("pairs an even row left to right into Couple groups", () => {
    const initial = generateInitialGrid(1, 4, 0, "LEFT_TO_RIGHT");
    const { positions: next, warning } = convertRowToCouple(initial, 0);
    const sorted = [...next].sort((a, b) => a.columnIndex - b.columnIndex);
    expect(sorted.every((p) => p.seatType === "COUPLE")).toBe(true);
    expect(sorted[0].seatGroupId).toBe(sorted[1].seatGroupId);
    expect(sorted[2].seatGroupId).toBe(sorted[3].seatGroupId);
    expect(sorted[0].seatGroupId).not.toBe(sorted[2].seatGroupId);
    expect(warning).toBeNull();
  });

  it("converts an odd leftover seat to EMPTY_SPACE and returns a warning", () => {
    const initial = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const { positions: next, warning } = convertRowToCouple(initial, 0);
    const sorted = [...next].sort((a, b) => a.columnIndex - b.columnIndex);
    expect(sorted[0].seatType).toBe("COUPLE");
    expect(sorted[1].seatType).toBe("COUPLE");
    expect(sorted[2].positionType).toBe("EMPTY_SPACE");
    expect(warning).toMatch(/odd number of positions/i);
  });

  it("pairs each side of an Aisle independently instead of spanning across it", () => {
    const initial: LayoutPosition[] = [
      { rowIndex: 0, columnIndex: 0, rowLabel: "A", positionType: "SEAT", seatNumber: 1, seatCode: "A1", seatType: "STANDARD" },
      { rowIndex: 0, columnIndex: 1, rowLabel: "A", positionType: "SEAT", seatNumber: 2, seatCode: "A2", seatType: "STANDARD" },
      { rowIndex: 0, columnIndex: 2, rowLabel: "A", positionType: "AISLE" },
      { rowIndex: 0, columnIndex: 3, rowLabel: "A", positionType: "SEAT", seatNumber: 3, seatCode: "A3", seatType: "STANDARD" },
    ];
    const { positions: next, warning } = convertRowToCouple(initial, 0);
    const sorted = [...next].sort((a, b) => a.columnIndex - b.columnIndex);
    expect(sorted[0].seatType).toBe("COUPLE");
    expect(sorted[1].seatType).toBe("COUPLE");
    expect(sorted[2].positionType).toBe("AISLE");
    expect(sorted[3].positionType).toBe("EMPTY_SPACE"); // lone seat after the aisle, no partner
    expect(warning).toMatch(/odd number of positions/i);
  });

  it("leaves other rows untouched", () => {
    const initial = generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT");
    const { positions: next } = convertRowToCouple(initial, 0);
    const rowB = next.filter((p) => p.rowLabel === "B");
    expect(rowB.every((p) => p.seatType === "STANDARD")).toBe(true);
  });
});

describe("convertColumnToAisle", () => {
  it("reassigns every position in the column to AISLE", () => {
    const initial = generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT");
    const next = convertColumnToAisle(initial, 0);
    const col0 = next.filter((p) => p.columnIndex === 0);
    const col1 = next.filter((p) => p.columnIndex === 1);
    expect(col0.every((p) => p.positionType === "AISLE")).toBe(true);
    expect(col1.every((p) => p.positionType === "SEAT")).toBe(true);
  });

  it("clears the other half of a Couple pair left stranded outside the column", () => {
    const base = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const paired = applyAssignment(base, new Set([positionKey(0, 1), positionKey(0, 2)]), "SEAT", "COUPLE", "g1");
    const next = convertColumnToAisle(paired, 2); // removes A3, stranding A2
    const survivor = next.find((p) => p.columnIndex === 1)!;
    expect(survivor.positionType).toBe("EMPTY_SPACE");
    expect(survivor.seatGroupId).toBeNull();
  });
});

describe("copyRowPattern / pasteRowPattern", () => {
  it("round-trips a row's type pattern onto another row with fresh Couple group ids", () => {
    const base = generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT");
    const withCouple = applyAssignment(base, new Set([positionKey(0, 0), positionKey(0, 1)]), "SEAT", "COUPLE", "original-group");

    const pattern = copyRowPattern(withCouple, 0);
    const pasted = pasteRowPattern(withCouple, 1, pattern);

    const rowB = pasted.filter((p) => p.rowLabel === "B").sort((a, b) => a.columnIndex - b.columnIndex);
    expect(rowB.every((p) => p.seatType === "COUPLE")).toBe(true);
    expect(rowB[0].seatGroupId).toBe(rowB[1].seatGroupId);
    expect(rowB[0].seatGroupId).not.toBe("original-group");

    // Source row is untouched by pasting elsewhere.
    const rowA = pasted.filter((p) => p.rowLabel === "A");
    expect(rowA.every((p) => p.seatGroupId === "original-group")).toBe(true);
  });

  it("leaves target columns the pattern doesn't cover untouched", () => {
    const base = generateInitialGrid(2, 3, 0, "LEFT_TO_RIGHT");
    const narrowPattern = copyRowPattern(base, 0).slice(0, 1); // only column 0
    const pasted = pasteRowPattern(base, 1, narrowPattern);
    const rowB = pasted.filter((p) => p.rowLabel === "B");
    expect(rowB.find((p) => p.columnIndex === 1)?.seatType).toBe("STANDARD");
    expect(rowB.find((p) => p.columnIndex === 2)?.seatType).toBe("STANDARD");
  });
});

describe("expandToWholeCoupleGroups", () => {
  it("adds the other half of a Couple group when only one half is in the selection", () => {
    const base = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const paired = applyAssignment(base, new Set([positionKey(0, 0), positionKey(0, 1)]), "SEAT", "COUPLE", "g1");
    const expanded = expandToWholeCoupleGroups(paired, new Set([positionKey(0, 0)]));
    expect(expanded.has(positionKey(0, 0))).toBe(true);
    expect(expanded.has(positionKey(0, 1))).toBe(true);
  });

  it("leaves a selection with no Couple positions unchanged", () => {
    const positions = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const selected = new Set([positionKey(0, 0)]);
    expect(expandToWholeCoupleGroups(positions, selected)).toEqual(selected);
  });
});

describe("applyAssignment", () => {
  it("assigns SEAT/seatType to the selected keys only, leaving others untouched", () => {
    const positions = generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT");
    const keys = new Set([positionKey(0, 1)]);
    const next = applyAssignment(positions, keys, "SEAT", "VIP", null);
    expect(next.find((p) => p.columnIndex === 1)?.seatType).toBe("VIP");
    expect(next.find((p) => p.columnIndex === 0)?.seatType).toBe("STANDARD");
  });

  it("clears seat fields when reassigning to a non-SEAT position type", () => {
    const positions = generateInitialGrid(1, 1, 0, "LEFT_TO_RIGHT");
    const keys = new Set([positionKey(0, 0)]);
    const next = applyAssignment(positions, keys, "AISLE", null, null);
    expect(next[0]).toMatchObject({ positionType: "AISLE", seatNumber: null, seatCode: null, seatType: null, seatGroupId: null });
  });
});

describe("rule-based Layout Assistant", () => {
  const config: LayoutAssistantForm = {
    templateCode: "BALANCED",
    templateVersion: 1,
    zones: [
      { id: "front", fromRow: 0, toRow: 0, seatType: "STANDARD" },
      { id: "middle", fromRow: 1, toRow: 1, seatType: "VIP" },
      { id: "rear", fromRow: 2, toRow: 2, seatType: "COUPLE" },
    ],
    verticalAisleColumns: [2],
    horizontalAisleRows: [],
    preserveManualOverrides: true,
  };

  const grid = {
    numberOfRows: 3, maxPositionsPerRow: 6, firstRowLabel: "A",
    numberingDirection: "LEFT_TO_RIGHT" as const,
    numberingPolicy: "CONTIGUOUS_SEATS" as const,
  };

  it("applies row zones, structural aisles and atomic Couple groups", () => {
    const result = generateLayoutFromAssistant([], grid, config);
    const rowA = result.positions.filter((p) => p.rowIndex === 0);
    const rowB = result.positions.filter((p) => p.rowIndex === 1);
    const rowC = result.positions.filter((p) => p.rowIndex === 2);

    expect(rowA.find((p) => p.columnIndex === 2)?.positionType).toBe("AISLE");
    expect(rowA.filter((p) => p.positionType === "SEAT").every((p) => p.seatType === "STANDARD")).toBe(true);
    expect(rowB.filter((p) => p.positionType === "SEAT").every((p) => p.seatType === "VIP")).toBe(true);
    expect(rowC.filter((p) => p.positionType === "SEAT").every((p) => p.seatType === "COUPLE")).toBe(true);
    const groups = rowC.filter((p) => p.seatType === "COUPLE").reduce<Record<string, number>>((acc, p) => {
      acc[p.seatGroupId!] = (acc[p.seatGroupId!] ?? 0) + 1;
      return acc;
    }, {});
    expect(Object.values(groups).every((count) => count === 2)).toBe(true);
  });

  it("preserves explicit operator overrides when requested", () => {
    const current = generateInitialGrid(3, 6, 0, "LEFT_TO_RIGHT").map((p) =>
      p.rowIndex === 0 && p.columnIndex === 0 ? { ...p, seatType: "VIP" as const, manualOverride: true } : p,
    );
    const result = generateLayoutFromAssistant(current, grid, config);
    expect(result.positions.find((p) => p.rowIndex === 0 && p.columnIndex === 0)?.seatType).toBe("VIP");
    expect(result.preservedOverrideCount).toBe(1);
  });

  it("replaces operator overrides when preservation is disabled", () => {
    const current = generateInitialGrid(3, 6, 0, "LEFT_TO_RIGHT").map((p) =>
      p.rowIndex === 0 && p.columnIndex === 0 ? { ...p, seatType: "VIP" as const, manualOverride: true } : p,
    );
    const result = generateLayoutFromAssistant(current, grid, { ...config, preserveManualOverrides: false });
    expect(result.positions.find((p) => p.rowIndex === 0 && p.columnIndex === 0)?.seatType).toBe("STANDARD");
    expect(result.preservedOverrideCount).toBe(0);
  });
});

describe("numbering policy and row mirroring", () => {
  it("supports contiguous numbering and physical-position numbering across an aisle", () => {
    const withAisle = applyAssignment(generateInitialGrid(1, 4, 0, "LEFT_TO_RIGHT"), new Set([positionKey(0, 1)]), "AISLE", null, null);
    expect(renumberLayout(withAisle, "CONTIGUOUS_SEATS", "LEFT_TO_RIGHT").map((p) => p.seatCode)).toEqual(["A1", null, "A2", "A3"]);
    expect(renumberLayout(withAisle, "PHYSICAL_POSITION", "LEFT_TO_RIGHT").map((p) => p.seatCode)).toEqual(["A1", null, "A3", "A4"]);
  });

  it("mirrors the complete row and marks it as a manual exception", () => {
    const source = applyAssignment(generateInitialGrid(1, 3, 0, "LEFT_TO_RIGHT"), new Set([positionKey(0, 0)]), "AISLE", null, null);
    const mirrored = mirrorRow(source, 0);
    expect(mirrored.find((p) => p.columnIndex === 2)?.positionType).toBe("AISLE");
    expect(mirrored.every((p) => p.manualOverride)).toBe(true);
  });
});
