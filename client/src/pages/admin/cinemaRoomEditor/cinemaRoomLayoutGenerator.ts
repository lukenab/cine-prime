import type {
  LayoutPosition, LayoutPositionType, NumberingDirectionValue, NumberingPolicyValue, SeatTypeValue,
} from "../../../api/movieApi";
import type { LayoutAssistantForm } from "./cinemaRoomEditor.types";

/** Excel-style row label: 0->A, 1->B, ..., 25->Z, 26->AA, 27->AB... — matches
 *  SeatService.rowLabel() on the backend. Not a source of truth — the backend
 *  recomputes/validates everything on save; this is purely for the live preview
 *  before the round-trip. */
export function excelRowLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function positionKey(rowIndex: number, columnIndex: number): string {
  return `${rowIndex}:${columnIndex}`;
}

/** Suggests physical aisle columns while keeping every contiguous Couple-seat
 * run even. Wide even grids use two symmetric side aisles; odd grids use one
 * near-centre aisle with even seat counts on both sides. */
export function suggestVerticalAisleColumns(maxPositionsPerRow: number, coupleLastRow: boolean): number[] {
  if (maxPositionsPerRow < 2) return [];
  if (!coupleLastRow) return maxPositionsPerRow >= 12 ? [Math.floor(maxPositionsPerRow / 2)] : [];
  if (maxPositionsPerRow % 2 === 0) {
    return maxPositionsPerRow >= 8 ? [2, maxPositionsPerRow - 3] : [];
  }
  const middle = Math.floor(maxPositionsPerRow / 2);
  return [middle % 2 === 0 ? middle : middle - 1];
}

/** Inverse of excelRowLabel: "A"->0, "B"->1, ..., "Z"->25, "AA"->26... Used when
 *  growing/shrinking a grid the user already edited, to keep appending row labels
 *  in the same sequence instead of hardcoding "A" as the start every time. */
export function parseRowLabelIndex(label: string): number {
  let n = 0;
  for (const ch of label.trim().toUpperCase()) {
    const digit = ch.charCodeAt(0) - 64; // 'A' -> 1
    if (digit < 1 || digit > 26) return 0;
    n = n * 26 + digit;
  }
  return Math.max(0, n - 1);
}

/** Adds or removes whole rows at the bottom of an existing grid to reach
 *  `targetRowCount`, preserving every other row untouched (unlike regenerating
 *  the whole grid). New rows are filled with plain Standard seats, numbered the
 *  same way generateInitialGrid would. Removing rows drops from the bottom. A
 *  Couple pair can never span two rows, so unlike column-shrink there's no
 *  stranded-partner case to guard against here. */
export function adjustRowCount(
  positions: LayoutPosition[],
  targetRowCount: number,
  direction: NumberingDirectionValue,
): LayoutPosition[] {
  if (positions.length === 0 || targetRowCount < 1) return positions;

  const rowIndices = [...new Set(positions.map((p) => p.rowIndex))].sort((a, b) => a - b);
  const currentRowCount = rowIndices.length;
  if (targetRowCount === currentRowCount) return positions;

  if (targetRowCount < currentRowCount) {
    const keepRowIndices = new Set(rowIndices.slice(0, targetRowCount));
    return positions.filter((p) => keepRowIndices.has(p.rowIndex));
  }

  const maxCol = Math.max(0, ...positions.map((p) => p.columnIndex));
  const maxPositionsPerRow = maxCol + 1;
  const firstRow = rowIndices[0];
  const firstRowLabel = positions.find((p) => p.rowIndex === firstRow)?.rowLabel ?? "A";
  const firstRowLabelIndex = parseRowLabelIndex(firstRowLabel) - firstRow;
  const lastRowIndex = rowIndices[rowIndices.length - 1];

  const newPositions: LayoutPosition[] = [];
  for (let r = lastRowIndex + 1; r < lastRowIndex + 1 + (targetRowCount - currentRowCount); r++) {
    const rowLabel = excelRowLabel(firstRowLabelIndex + r);
    for (let c = 0; c < maxPositionsPerRow; c++) {
      const seatNumber = direction === "RIGHT_TO_LEFT" ? maxPositionsPerRow - c : c + 1;
      newPositions.push({
        rowIndex: r,
        columnIndex: c,
        rowLabel,
        positionType: "SEAT",
        seatNumber,
        seatCode: `${rowLabel}${seatNumber}`,
        seatType: "STANDARD",
        manualOverride: false,
      });
    }
  }
  return [...positions, ...newPositions];
}

/** Adds or removes whole columns at the right edge of every row to reach
 *  `targetColumnCount`, preserving other cells untouched. Seat numbers are always
 *  recomputed for every SEAT cell afterward (not just the new ones) because
 *  RIGHT_TO_LEFT numbering depends on the row's total width.
 *
 *  Shrinking can strand one half of a Couple pair when its partner's column gets
 *  dropped — a lone surviving half is no longer a valid pair, so it's converted
 *  to EMPTY_SPACE rather than left as a broken single "Couple" cell. */
export function adjustColumnCount(
  positions: LayoutPosition[],
  targetColumnCount: number,
  direction: NumberingDirectionValue,
): LayoutPosition[] {
  if (positions.length === 0 || targetColumnCount < 1) return positions;

  const maxCol = Math.max(0, ...positions.map((p) => p.columnIndex));
  const currentColumnCount = maxCol + 1;
  if (targetColumnCount === currentColumnCount) return positions;

  const isShrink = targetColumnCount < currentColumnCount;
  let next: LayoutPosition[];
  if (isShrink) {
    next = positions.filter((p) => p.columnIndex < targetColumnCount);
  } else {
    const rowLabelByIndex = new Map<number, string>();
    for (const p of positions) {
      if (!rowLabelByIndex.has(p.rowIndex)) rowLabelByIndex.set(p.rowIndex, p.rowLabel);
    }
    const additions: LayoutPosition[] = [];
    for (const [rowIndex, rowLabel] of rowLabelByIndex) {
      for (let c = currentColumnCount; c < targetColumnCount; c++) {
        additions.push({
          rowIndex, columnIndex: c, rowLabel, positionType: "SEAT",
          seatNumber: c + 1, seatCode: `${rowLabel}${c + 1}`, seatType: "STANDARD",
          manualOverride: false,
        });
      }
    }
    next = [...positions, ...additions];
  }

  if (isShrink) next = clearOrphanedCoupleHalves(next);

  return next.map((p) => {
    if (p.positionType !== "SEAT") return p;
    const seatNumber = direction === "RIGHT_TO_LEFT" ? targetColumnCount - p.columnIndex : p.columnIndex + 1;
    return { ...p, seatNumber, seatCode: `${p.rowLabel}${seatNumber}` };
  });
}

/** Converts any Couple position left without its partner (its `seatGroupId`
 *  appears exactly once) to EMPTY_SPACE — shared by every operation that can
 *  strand one half of a pair (column shrink, converting a column to Aisle,
 *  and painting over just one half of a pair in the seat editor). */
export function clearOrphanedCoupleHalves(positions: LayoutPosition[]): LayoutPosition[] {
  const groupCounts = new Map<string, number>();
  for (const p of positions) {
    if (p.positionType === "SEAT" && p.seatType === "COUPLE" && p.seatGroupId) {
      groupCounts.set(p.seatGroupId, (groupCounts.get(p.seatGroupId) ?? 0) + 1);
    }
  }
  return positions.map((p) => {
    if (p.positionType === "SEAT" && p.seatType === "COUPLE" && p.seatGroupId && groupCounts.get(p.seatGroupId) === 1) {
      return { ...p, positionType: "EMPTY_SPACE" as const, seatNumber: null, seatCode: null, seatType: null, seatGroupId: null, manualOverride: true };
    }
    return p;
  });
}

/** Reassigns every position in `columnIndex` to AISLE. Any Couple pair with
 *  its other half outside this column is left orphaned by the reassignment,
 *  so those strays are swept to EMPTY_SPACE too (never leave half a pair). */
export function convertColumnToAisle(positions: LayoutPosition[], columnIndex: number): LayoutPosition[] {
  const keys = new Set(
    positions.filter((p) => p.columnIndex === columnIndex).map((p) => positionKey(p.rowIndex, p.columnIndex)),
  );
  return clearOrphanedCoupleHalves(applyAssignment(positions, keys, "AISLE", null, null));
}

export type ResizeImpact = {
  /** Rows or columns that would be removed. */
  removedCount: number;
  /** SEAT positions (any type) that would be removed — the trigger for whether
   *  a confirmation dialog is needed at all. */
  removedSeatCount: number;
  affectedCoupleGroupIds: string[];
};

/** Impact preview for a row/column shrink (spec §8): a confirmation dialog is
 *  only warranted when the removed slice contains at least one configured SEAT
 *  — an all-AISLE/EMPTY_SPACE tail can resize silently. */
export function computeResizeImpact(
  positions: LayoutPosition[],
  kind: "row" | "column",
  targetCount: number,
): ResizeImpact {
  const indices = [...new Set(positions.map((p) => (kind === "row" ? p.rowIndex : p.columnIndex)))].sort((a, b) => a - b);
  const currentCount = indices.length;
  if (targetCount >= currentCount) {
    return { removedCount: 0, removedSeatCount: 0, affectedCoupleGroupIds: [] };
  }
  const keptIndices = new Set(indices.slice(0, targetCount));
  const removed = positions.filter((p) => !keptIndices.has(kind === "row" ? p.rowIndex : p.columnIndex));
  const removedSeats = removed.filter((p) => p.positionType === "SEAT");
  const affectedGroups = new Set<string>();
  for (const p of removedSeats) {
    if (p.seatType === "COUPLE" && p.seatGroupId) affectedGroups.add(p.seatGroupId);
  }
  return {
    removedCount: currentCount - targetCount,
    removedSeatCount: removedSeats.length,
    affectedCoupleGroupIds: [...affectedGroups],
  };
}

export type TemplateAllocation = {
  standardRowCount: number;
  vipRowCount: number;
  coupleRowCount: number;
};

/** Pure row-count math for the "Seat Distribution Template" quick-fill (spec §7).
 *  Normalizes all three percentages to sum 100, splits `totalRows` proportionally,
 *  then uses the largest-remainder method (floor each share, hand out any leftover
 *  rows to whichever category has the biggest fractional remainder) so the three
 *  counts always add back up to exactly `totalRows` — no row is ever lost or
 *  duplicated to rounding, regardless of what the three percentages are. */
export function computeTemplateAllocation(
  totalRows: number,
  standardPct: number,
  vipPct: number,
  couplePct: number,
): TemplateAllocation {
  const sum = standardPct + vipPct + couplePct;
  if (totalRows <= 0 || sum <= 0) {
    return { standardRowCount: 0, vipRowCount: 0, coupleRowCount: 0 };
  }

  const raw = {
    standard: (totalRows * standardPct) / sum,
    vip: (totalRows * vipPct) / sum,
    couple: (totalRows * couplePct) / sum,
  };
  const floors = {
    standard: Math.floor(raw.standard),
    vip: Math.floor(raw.vip),
    couple: Math.floor(raw.couple),
  };
  let leftover = totalRows - (floors.standard + floors.vip + floors.couple);
  const byRemainder = (["standard", "vip", "couple"] as const)
    .map((key) => ({ key, remainder: raw[key] - floors[key] }))
    .sort((a, b) => b.remainder - a.remainder);

  const result = { ...floors };
  for (let i = 0; leftover > 0; i++, leftover--) {
    result[byRemainder[i % byRemainder.length].key] += 1;
  }

  return { standardRowCount: result.standard, vipRowCount: result.vip, coupleRowCount: result.couple };
}

/** Pairs a single row's SEAT positions into Couples, left to right, within each
 *  contiguous run (a run breaks at any AISLE/EXIT/EMPTY_SPACE, which are left
 *  untouched). An odd leftover seat at the end of a run becomes EMPTY_SPACE.
 *  Shared by `applySeatDistributionTemplate`'s Couple-row handling and the
 *  standalone `convertRowToCouple` row action so the pairing rule lives in
 *  exactly one place. `rowPositions` need not be pre-sorted. */
function pairRowIntoCouples(rowPositions: LayoutPosition[]): { positions: LayoutPosition[]; hadLeftover: boolean } {
  const sorted = [...rowPositions].sort((a, b) => a.columnIndex - b.columnIndex);
  const asCouple = (p: LayoutPosition, groupId: string): LayoutPosition => ({ ...p, seatType: "COUPLE", seatGroupId: groupId });
  const asEmpty = (p: LayoutPosition): LayoutPosition =>
    ({ ...p, positionType: "EMPTY_SPACE" as const, seatNumber: null, seatCode: null, seatType: null, seatGroupId: null });

  let carry: LayoutPosition | null = null;
  let hadLeftover = false;
  const result: LayoutPosition[] = [];
  for (const p of sorted) {
    if (p.positionType !== "SEAT") {
      if (carry) { hadLeftover = true; result.push(asEmpty(carry)); carry = null; }
      result.push(p);
      continue;
    }
    if (!carry) {
      carry = p;
    } else if (p.columnIndex === carry.columnIndex + 1) {
      const groupId = crypto.randomUUID();
      result.push(asCouple(carry, groupId), asCouple(p, groupId));
      carry = null;
    } else {
      hadLeftover = true;
      result.push(asEmpty(carry));
      carry = p;
    }
  }
  if (carry) { hadLeftover = true; result.push(asEmpty(carry)); }
  return { positions: result, hadLeftover };
}

/** Row action: converts every SEAT position in `rowIndex` into Couple pairs
 *  (spec §13) — overwrites whatever Standard/VIP/Accessible seats were there.
 *  Callers should confirm with the user first since this is destructive. */
export function convertRowToCouple(positions: LayoutPosition[], rowIndex: number): { positions: LayoutPosition[]; warning: string | null } {
  const rowPositions = positions.filter((p) => p.rowIndex === rowIndex);
  if (rowPositions.length === 0) return { positions, warning: null };

  const { positions: paired, hadLeftover } = pairRowIntoCouples(rowPositions);
  const pairedByKey = new Map(paired.map((p) => [positionKey(p.rowIndex, p.columnIndex), p]));
  const next = positions.map((p) => {
    if (p.rowIndex !== rowIndex) return p;
    const pairedPosition = pairedByKey.get(positionKey(p.rowIndex, p.columnIndex));
    return pairedPosition ? { ...pairedPosition, manualOverride: true } : p;
  });
  const rowLabel = rowPositions[0]?.rowLabel ?? "";
  const warning = hadLeftover
    ? `Row ${rowLabel} has an odd number of positions — the last position was marked as empty space.`
    : null;
  return { positions: next, warning };
}

export type RowPatternCell = {
  columnIndex: number;
  positionType: LayoutPositionType;
  seatType: SeatTypeValue | null;
  /** Marks cells that were paired together in the copied row — paste uses this
   *  only to know which cells to re-group, generating brand-new seatGroupIds so
   *  a pasted Couple pair never collides with a group elsewhere in the layout. */
  localGroupKey: string | null;
};

/** Captures `rowIndex`'s layout as a column-relative pattern (no coordinates or
 *  seat codes baked in) so it can be pasted onto a different row. */
export function copyRowPattern(positions: LayoutPosition[], rowIndex: number): RowPatternCell[] {
  return positions
    .filter((p) => p.rowIndex === rowIndex)
    .sort((a, b) => a.columnIndex - b.columnIndex)
    .map((p) => ({
      columnIndex: p.columnIndex,
      positionType: p.positionType,
      seatType: p.seatType ?? null,
      localGroupKey: p.seatGroupId ?? null,
    }));
}

/** Applies a previously-copied row pattern onto `targetRowIndex`, matching by
 *  column index. Columns in the target row that the pattern doesn't cover
 *  (target row is wider than the source) are left untouched. */
export function pasteRowPattern(positions: LayoutPosition[], targetRowIndex: number, pattern: RowPatternCell[]): LayoutPosition[] {
  const patternByColumn = new Map(pattern.map((c) => [c.columnIndex, c]));
  const freshGroupIds = new Map<string, string>();
  return positions.map((p) => {
    if (p.rowIndex !== targetRowIndex) return p;
    const cell = patternByColumn.get(p.columnIndex);
    if (!cell) return p;
    if (cell.positionType !== "SEAT") {
      return { ...p, positionType: cell.positionType, seatNumber: null, seatCode: null, seatType: null, seatGroupId: null, manualOverride: true };
    }
    let seatGroupId: string | null = null;
    if (cell.seatType === "COUPLE" && cell.localGroupKey) {
      if (!freshGroupIds.has(cell.localGroupKey)) freshGroupIds.set(cell.localGroupKey, crypto.randomUUID());
      seatGroupId = freshGroupIds.get(cell.localGroupKey)!;
    }
    const seatNumber = p.seatNumber ?? p.columnIndex + 1;
    return { ...p, positionType: "SEAT" as const, seatNumber, seatCode: `${p.rowLabel}${seatNumber}`, seatType: cell.seatType, seatGroupId, manualOverride: true };
  });
}

/** Mirrors one complete row around its center while keeping Couple groups
 * atomic. Seat codes are deliberately recomputed by `renumberLayout` in the
 * workspace after this operation. */
export function mirrorRow(positions: LayoutPosition[], rowIndex: number): LayoutPosition[] {
  const row = positions.filter((p) => p.rowIndex === rowIndex);
  if (row.length === 0) return positions;
  const maxColumn = Math.max(...row.map((p) => p.columnIndex));
  const sourceByColumn = new Map(row.map((p) => [p.columnIndex, p]));
  return positions.map((target) => {
    if (target.rowIndex !== rowIndex) return target;
    const source = sourceByColumn.get(maxColumn - target.columnIndex);
    if (!source) return target;
    return {
      ...target,
      positionType: source.positionType,
      seatNumber: source.positionType === "SEAT" ? target.seatNumber : null,
      seatCode: source.positionType === "SEAT" ? target.seatCode : null,
      seatType: source.positionType === "SEAT" ? source.seatType : null,
      seatGroupId: source.positionType === "SEAT" ? source.seatGroupId : null,
      manualOverride: true,
    };
  });
}

/** Given a candidate selection, adds every position that shares a Couple group
 *  with an already-selected position — used before showing bulk-selection
 *  aggregates/actions so a Couple group is never left half-selected (and thus
 *  never half-edited by a bulk action). */
export function expandToWholeCoupleGroups(positions: LayoutPosition[], selected: Set<string>): Set<string> {
  const keysByGroup = new Map<string, string[]>();
  for (const p of positions) {
    if (p.positionType === "SEAT" && p.seatType === "COUPLE" && p.seatGroupId) {
      const key = positionKey(p.rowIndex, p.columnIndex);
      if (!keysByGroup.has(p.seatGroupId)) keysByGroup.set(p.seatGroupId, []);
      keysByGroup.get(p.seatGroupId)!.push(key);
    }
  }
  const next = new Set(selected);
  for (const keys of keysByGroup.values()) {
    if (keys.some((k) => next.has(k))) keys.forEach((k) => next.add(k));
  }
  return next;
}

/** Applies the template allocation to whole rows (front rows first): Standard,
 *  then VIP, then Couple pairs for the trailing rows. AISLE/EXIT/EMPTY_SPACE
 *  cells are left untouched — only SEAT cells within each affected row are
 *  reassigned. A leftover unpaired seat in a Couple row (odd width, or split by
 *  an aisle) becomes EMPTY_SPACE, and its row is reported in `warnings` so the
 *  caller can surface it to the user. */
export function applySeatDistributionTemplate(
  positions: LayoutPosition[],
  standardPct: number,
  vipPct: number,
  couplePct: number,
): { positions: LayoutPosition[]; warnings: string[] } {
  const rowIndices = [...new Set(positions.map((p) => p.rowIndex))].sort((a, b) => a - b);
  const totalRows = rowIndices.length;
  if (totalRows === 0) return { positions, warnings: [] };

  const { standardRowCount, vipRowCount } = computeTemplateAllocation(totalRows, standardPct, vipPct, couplePct);

  const rowKind = new Map<number, "STANDARD" | "VIP" | "COUPLE_ROW">();
  rowIndices.forEach((r, i) => {
    if (i < standardRowCount) rowKind.set(r, "STANDARD");
    else if (i < standardRowCount + vipRowCount) rowKind.set(r, "VIP");
    else rowKind.set(r, "COUPLE_ROW");
  });

  const byRow = new Map<number, LayoutPosition[]>();
  for (const p of positions) {
    if (!byRow.has(p.rowIndex)) byRow.set(p.rowIndex, []);
    byRow.get(p.rowIndex)!.push(p);
  }

  const warnings: string[] = [];
  const result: LayoutPosition[] = [];
  for (const [rowIndex, rowPositions] of byRow) {
    const kind = rowKind.get(rowIndex);
    const sorted = [...rowPositions].sort((a, b) => a.columnIndex - b.columnIndex);

    if (kind === "COUPLE_ROW") {
      const { positions: paired, hadLeftover } = pairRowIntoCouples(sorted);
      result.push(...paired);
      if (hadLeftover) {
        const rowLabel = sorted[0]?.rowLabel ?? "";
        warnings.push(`Row ${rowLabel} has an odd number of positions — the last position was marked as empty space.`);
      }
    } else if (kind === "STANDARD" || kind === "VIP") {
      for (const p of sorted) {
        result.push(p.positionType === "SEAT" ? { ...p, seatType: kind, seatGroupId: null } : p);
      }
    } else {
      result.push(...sorted);
    }
  }
  return { positions: result, warnings };
}

/** Builds a fresh all-Standard-seat grid from the generator inputs. The user
 *  then edits individual cells or applies a distribution template from here. */
export function generateInitialGrid(
  numberOfRows: number,
  maxPositionsPerRow: number,
  firstRowLabelIndex: number,
  direction: NumberingDirectionValue,
): LayoutPosition[] {
  const positions: LayoutPosition[] = [];
  for (let r = 0; r < numberOfRows; r++) {
    const rowLabel = excelRowLabel(firstRowLabelIndex + r);
    for (let c = 0; c < maxPositionsPerRow; c++) {
      const seatNumber = direction === "RIGHT_TO_LEFT" ? maxPositionsPerRow - c : c + 1;
      positions.push({
        rowIndex: r,
        columnIndex: c,
        rowLabel,
        positionType: "SEAT",
        seatNumber,
        seatCode: `${rowLabel}${seatNumber}`,
        seatType: "STANDARD",
        manualOverride: false,
      });
    }
  }
  return positions;
}

/** Recomputes every visible seat code from the selected numbering policy.
 * Non-seat positions never retain stale seat fields. */
export function renumberLayout(
  positions: LayoutPosition[],
  policy: NumberingPolicyValue,
  direction: NumberingDirectionValue,
): LayoutPosition[] {
  const byRow = new Map<number, LayoutPosition[]>();
  for (const p of positions) {
    if (!byRow.has(p.rowIndex)) byRow.set(p.rowIndex, []);
    byRow.get(p.rowIndex)!.push(p);
  }
  const replacements = new Map<string, LayoutPosition>();
  for (const row of byRow.values()) {
    const ordered = [...row].sort((a, b) =>
      direction === "RIGHT_TO_LEFT" ? b.columnIndex - a.columnIndex : a.columnIndex - b.columnIndex,
    );
    let contiguousNumber = 0;
    const maxColumn = Math.max(...row.map((p) => p.columnIndex));
    for (const p of ordered) {
      if (p.positionType !== "SEAT") {
        replacements.set(positionKey(p.rowIndex, p.columnIndex), {
          ...p, seatNumber: null, seatCode: null, seatType: null, seatGroupId: null,
        });
        continue;
      }
      contiguousNumber += 1;
      const seatNumber = policy === "CONTIGUOUS_SEATS"
        ? contiguousNumber
        : direction === "RIGHT_TO_LEFT" ? maxColumn - p.columnIndex + 1 : p.columnIndex + 1;
      replacements.set(positionKey(p.rowIndex, p.columnIndex), {
        ...p, seatNumber, seatCode: `${p.rowLabel}${seatNumber}`,
      });
    }
  }
  return positions.map((p) => replacements.get(positionKey(p.rowIndex, p.columnIndex)) ?? p);
}

export type LayoutAssistantResult = {
  positions: LayoutPosition[];
  warnings: string[];
  preservedOverrideCount: number;
};

/** Deterministic P0 rule-based generator. Structural aisle rules run before
 * row zones, Couple pairing runs last, and explicit operator exceptions may be
 * overlaid by coordinate. */
export function generateLayoutFromAssistant(
  current: LayoutPosition[],
  grid: { numberOfRows: number; maxPositionsPerRow: number; firstRowLabel: string; numberingDirection: NumberingDirectionValue; numberingPolicy: NumberingPolicyValue },
  config: LayoutAssistantForm,
): LayoutAssistantResult {
  const firstRowLabelIndex = parseRowLabelIndex(grid.firstRowLabel);
  let generated = generateInitialGrid(
    grid.numberOfRows, grid.maxPositionsPerRow, firstRowLabelIndex, grid.numberingDirection,
  );
  const warnings: string[] = [];
  const aisleColumns = new Set(config.verticalAisleColumns);
  const aisleRows = new Set(config.horizontalAisleRows);

  generated = generated.map((p) => {
    if (aisleColumns.has(p.columnIndex) || aisleRows.has(p.rowIndex)) {
      return {
        ...p, positionType: "AISLE" as const, seatNumber: null, seatCode: null,
        seatType: null, seatGroupId: null, manualOverride: false,
      };
    }
    const matching = config.zones.filter((z) => p.rowIndex >= z.fromRow && p.rowIndex <= z.toRow);
    if (matching.length > 1) {
      warnings.push(`Row ${p.rowLabel} is covered by overlapping seat zones; the last zone wins.`);
    }
    const zone = matching[matching.length - 1];
    return { ...p, seatType: zone?.seatType === "COUPLE" ? "STANDARD" : zone?.seatType ?? "STANDARD" };
  });

  const coupleRows = new Set<number>();
  for (const zone of config.zones) {
    if (zone.seatType !== "COUPLE") continue;
    for (let rowIndex = zone.fromRow; rowIndex <= zone.toRow; rowIndex++) coupleRows.add(rowIndex);
  }
  for (const rowIndex of coupleRows) {
    if (aisleRows.has(rowIndex)) continue;
    const row = generated.filter((p) => p.rowIndex === rowIndex);
    const sorted = [...row].sort((a, b) => a.columnIndex - b.columnIndex);
    let pending: LayoutPosition | null = null;
    const replacements = new Map<string, LayoutPosition>();
    let leftover = false;
    for (const p of sorted) {
      if (p.positionType !== "SEAT") {
        if (pending) {
          replacements.set(positionKey(pending.rowIndex, pending.columnIndex), {
            ...pending, positionType: "EMPTY_SPACE", seatNumber: null, seatCode: null,
            seatType: null, seatGroupId: null,
          });
          pending = null;
          leftover = true;
        }
        continue;
      }
      if (!pending) {
        pending = p;
      } else if (p.columnIndex === pending.columnIndex + 1) {
        const groupId = `gen-r${rowIndex}-c${pending.columnIndex}`;
        replacements.set(positionKey(pending.rowIndex, pending.columnIndex), { ...pending, seatType: "COUPLE", seatGroupId: groupId });
        replacements.set(positionKey(p.rowIndex, p.columnIndex), { ...p, seatType: "COUPLE", seatGroupId: groupId });
        pending = null;
      } else {
        replacements.set(positionKey(pending.rowIndex, pending.columnIndex), {
          ...pending, positionType: "EMPTY_SPACE", seatNumber: null, seatCode: null,
          seatType: null, seatGroupId: null,
        });
        pending = p;
        leftover = true;
      }
    }
    if (pending) {
      replacements.set(positionKey(pending.rowIndex, pending.columnIndex), {
        ...pending, positionType: "EMPTY_SPACE", seatNumber: null, seatCode: null,
        seatType: null, seatGroupId: null,
      });
      leftover = true;
    }
    generated = generated.map((p) => replacements.get(positionKey(p.rowIndex, p.columnIndex)) ?? p);
    if (leftover) warnings.push(`Row ${sorted[0]?.rowLabel ?? rowIndex + 1} has an unpaired Couple position; it became Empty Space.`);
  }

  let preservedOverrideCount = 0;
  if (config.preserveManualOverrides) {
    const currentByKey = new Map(current.map((p) => [positionKey(p.rowIndex, p.columnIndex), p]));
    generated = generated.map((p) => {
      const existing = currentByKey.get(positionKey(p.rowIndex, p.columnIndex));
      const isLegacyCustomization = existing?.manualOverride == null &&
        (existing?.positionType !== "SEAT" || existing?.seatType !== "STANDARD");
      if (!existing || (!existing.manualOverride && !isLegacyCustomization)) return p;
      preservedOverrideCount += 1;
      const { positionId: _positionId, seatStatus: _seatStatus, ...portable } = existing;
      return { ...p, ...portable, rowLabel: p.rowLabel, manualOverride: true };
    });
  }

  generated = clearOrphanedCoupleHalves(generated);
  return {
    positions: renumberLayout(generated, grid.numberingPolicy, grid.numberingDirection),
    warnings: [...new Set(warnings)],
    preservedOverrideCount,
  };
}

export type LayoutDiff = {
  changedPositionCount: number;
  addedPositionCount: number;
  removedPositionCount: number;
};

export function computeLayoutDiff(current: LayoutPosition[], next: LayoutPosition[]): LayoutDiff {
  const comparable = (p: LayoutPosition) => JSON.stringify({
    positionType: p.positionType, seatType: p.seatType ?? null, seatGroupId: p.seatGroupId ?? null,
    seatNumber: p.seatNumber ?? null, seatCode: p.seatCode ?? null,
  });
  const currentByKey = new Map(current.map((p) => [positionKey(p.rowIndex, p.columnIndex), p]));
  const nextByKey = new Map(next.map((p) => [positionKey(p.rowIndex, p.columnIndex), p]));
  let changedPositionCount = 0;
  let addedPositionCount = 0;
  for (const [key, p] of nextByKey) {
    const before = currentByKey.get(key);
    if (!before) addedPositionCount += 1;
    else if (comparable(before) !== comparable(p)) changedPositionCount += 1;
  }
  let removedPositionCount = 0;
  for (const key of currentByKey.keys()) if (!nextByKey.has(key)) removedPositionCount += 1;
  return { changedPositionCount, addedPositionCount, removedPositionCount };
}

export type LayoutStats = {
  /** Every LayoutPosition record, regardless of type (spec §10.1). */
  gridPositionCount: number;
  /** Every position where positionType === SEAT, complete or not — a Couple
   *  pair contributes 2 (spec §10.2). */
  physicalSeatPositionCount: number;
  standardCount: number;
  vipCount: number;
  /** Only Couple groups with exactly 2 positions — an incomplete/orphaned half
   *  is excluded here and reported separately (spec §10.3). */
  coupleGroupCount: number;
  coupleCapacity: number;
  /** seatGroupIds whose position count isn't exactly 2 — surfaced so callers
   *  (validation, the Inspector) can flag them without re-deriving group sizes. */
  incompleteCoupleGroupIds: string[];
  accessibleCount: number;
  wheelchairCount: number;
  aisleCount: number;
  exitCount: number;
  emptySpaceCount: number;
  /** People-capacity-equivalent sellable places — Standard/VIP/Accessible = 1
   *  each, a *complete* Couple group = 2. Never includes Aisle/Exit/Empty
   *  Space, and never counts an incomplete Couple group's phantom capacity. */
  sellableCapacity: number;
  /** Sellable *units* (what you'd sell a ticket to) — a Couple group counts as
   *  1 unit here even though it's 2 people of sellableCapacity. */
  sellableUnitCount: number;
};

/** Client-side mirror of RoomLayoutService.recomputeCapacity() — for immediate
 *  feedback only. The backend recomputes and is the authoritative value on save. */
export function computeLayoutStats(positions: LayoutPosition[]): LayoutStats {
  let standardCount = 0;
  let vipCount = 0;
  let accessibleCount = 0;
  let emptySpaceCount = 0;
  let aisleCount = 0;
  let exitCount = 0;
  let physicalSeatPositionCount = 0;
  const coupleGroupSizes = new Map<string, number>();

  for (const p of positions) {
    if (p.positionType === "EMPTY_SPACE") {
      emptySpaceCount++;
    } else if (p.positionType === "AISLE") {
      aisleCount++;
    } else if (p.positionType === "EXIT") {
      exitCount++;
    } else if (p.positionType === "SEAT") {
      physicalSeatPositionCount++;
      if (!p.seatType) continue;
      if (p.seatType === "COUPLE") {
        if (p.seatGroupId) coupleGroupSizes.set(p.seatGroupId, (coupleGroupSizes.get(p.seatGroupId) ?? 0) + 1);
      } else if (p.seatType === "VIP") {
        vipCount++;
      } else if (p.seatType === "ACCESSIBLE") {
        accessibleCount++;
      } else {
        standardCount++;
      }
    }
  }

  let coupleGroupCount = 0;
  const incompleteCoupleGroupIds: string[] = [];
  for (const [groupId, size] of coupleGroupSizes) {
    if (size === 2) coupleGroupCount++;
    else incompleteCoupleGroupIds.push(groupId);
  }
  const coupleCapacity = coupleGroupCount * 2;

  return {
    gridPositionCount: positions.length,
    physicalSeatPositionCount,
    standardCount,
    vipCount,
    coupleGroupCount,
    coupleCapacity,
    incompleteCoupleGroupIds,
    accessibleCount,
    wheelchairCount: accessibleCount,
    aisleCount,
    exitCount,
    emptySpaceCount,
    sellableCapacity: standardCount + vipCount + accessibleCount + coupleCapacity,
    sellableUnitCount: standardCount + vipCount + accessibleCount + coupleGroupCount,
  };
}

/** Shared seat-cell dimensions — SeatCell, CoupleSeatGroup, and SeatGrid's row/
 *  column headers all size off these so everything stays pixel-aligned. */
export const SEAT_CELL_WIDTH = 48;
export const SEAT_CELL_HEIGHT = 38;
export const SEAT_CELL_GAP = 6;
export const ROW_HEADER_WIDTH = 30;

export const POSITION_TYPE_LABELS: Record<LayoutPositionType, string> = {
  SEAT: "Seat",
  AISLE: "Aisle",
  EXIT: "Exit",
  EMPTY_SPACE: "Empty space",
};

/** User-facing seat-type labels, kept consistent across the toolbar,
 *  legend, palette, and Selection Inspector (spec §4: one label per API
 *  value throughout the editor — payload values are untouched). */
export const SEAT_TYPE_LABELS: Record<SeatTypeValue, string> = {
  STANDARD: "Standard",
  VIP: "VIP",
  COUPLE: "Couple",
  ACCESSIBLE: "Wheelchair / Accessible",
};

export const SEAT_TYPE_COLORS: Record<SeatTypeValue, { bg: string; border: string; text: string }> = {
  STANDARD:   { bg: "rgba(59,130,246,0.14)",  border: "rgba(59,130,246,0.4)",  text: "#3b82f6" },
  VIP:        { bg: "rgba(251,191,36,0.16)",  border: "rgba(251,191,36,0.5)",  text: "#d97706" },
  COUPLE:     { bg: "rgba(168,85,247,0.14)",  border: "rgba(168,85,247,0.4)",  text: "#9333ea" },
  ACCESSIBLE: { bg: "rgba(20,184,166,0.14)",  border: "rgba(20,184,166,0.45)", text: "#0d9488" },
};

/** Assigns a position type/seat type to every position matching one of `keys`.
 *  For COUPLE, `keys` must contain exactly 2 adjacent same-row cells — caller
 *  validates this before invoking. Returns a new array (immutable update). */
export function applyAssignment(
  positions: LayoutPosition[],
  keys: Set<string>,
  positionType: LayoutPositionType,
  seatType: SeatTypeValue | null,
  seatGroupId: string | null,
): LayoutPosition[] {
  return positions.map((p) => {
    if (!keys.has(positionKey(p.rowIndex, p.columnIndex))) return p;
    if (positionType !== "SEAT") {
      return {
        ...p,
        positionType,
        seatNumber: null,
        seatCode: null,
        seatType: null,
        seatGroupId: null,
        manualOverride: true,
      };
    }
    const seatNumber = p.seatNumber ?? p.columnIndex + 1;
    return {
      ...p,
      positionType: "SEAT",
      seatNumber,
      seatCode: `${p.rowLabel}${seatNumber}`,
      seatType,
      seatGroupId,
      manualOverride: true,
    };
  });
}
