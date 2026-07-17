import type { LayoutPosition } from "../../../api/movieApi";
import type { RoomInfoForm, TechConfigForm } from "./cinemaRoomEditor.types";
import { computeLayoutStats } from "./cinemaRoomLayoutGenerator";

/** Planning thresholds from QCVN 01:2013/BVHTTDL. They are an early design
 * guard, not a substitute for an approved architectural/fire-safety design. */
export const CINEMA_PLANNING_LIMITS = {
  areaPerPersonSqm: 0.8,
  volumePerPersonCbm: 4,
  rowPitchM: 0.95,
  seatWidthM: 0.5,
  wideScreenFirstRowFactor: 0.84,
} as const;

export type RoomCapacityEnvelope = {
  areaSqm: number | null;
  volumeCbm: number | null;
  maxPersonCapacity: number | null;
  maxRowsByDepth: number | null;
  maxPositionsPerRowByWidth: number | null;
  firstRowClearanceM: number | null;
  plannedPersonCapacity: number;
  minimumLayoutWidthM: number | null;
  minimumLayoutDepthM: number | null;
  exceedsCapacity: boolean;
  exceedsWidth: boolean;
  exceedsDepth: boolean;
};

function positiveNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Estimates the smallest regulatory planning envelope for the authored grid.
 * Actual seat models, egress widths, wheelchair turning space, risers and local
 * fire approval can only make the final permitted capacity lower. */
export function calculateRoomCapacityEnvelope(
  roomInfo: RoomInfoForm,
  techConfig: TechConfigForm,
  positions: LayoutPosition[],
): RoomCapacityEnvelope {
  const lengthM = positiveNumber(roomInfo.lengthM);
  const widthM = positiveNumber(roomInfo.widthM);
  const heightM = positiveNumber(roomInfo.clearHeightM);
  const screenWidthM = positiveNumber(techConfig.screenWidthM);

  const areaSqm = lengthM != null && widthM != null ? lengthM * widthM : null;
  const volumeCbm = areaSqm != null && heightM != null ? areaSqm * heightM : null;
  const areaCapacity = areaSqm != null
    ? Math.floor(areaSqm / CINEMA_PLANNING_LIMITS.areaPerPersonSqm)
    : null;
  const volumeCapacity = volumeCbm != null
    ? Math.floor(volumeCbm / CINEMA_PLANNING_LIMITS.volumePerPersonCbm)
    : null;
  const maxPersonCapacity = areaCapacity != null && volumeCapacity != null
    ? Math.max(0, Math.min(areaCapacity, volumeCapacity))
    : null;

  // Do not cascade an already-invalid screen width into a second, misleading
  // depth error. Screen-vs-room validation owns that case.
  const firstRowClearanceM = screenWidthM != null && (widthM == null || screenWidthM <= widthM)
    ? screenWidthM * CINEMA_PLANNING_LIMITS.wideScreenFirstRowFactor
    : null;
  const availableSeatingDepthM = lengthM != null
    ? Math.max(0, lengthM - (firstRowClearanceM ?? 0))
    : null;
  const maxRowsByDepth = availableSeatingDepthM != null
    ? Math.max(0, Math.floor(availableSeatingDepthM / CINEMA_PLANNING_LIMITS.rowPitchM))
    : null;
  const maxPositionsPerRowByWidth = widthM != null
    ? Math.max(0, Math.floor(widthM / CINEMA_PLANNING_LIMITS.seatWidthM))
    : null;

  const rowIndices = new Set(positions.map((position) => position.rowIndex));
  const positionsByRow = new Map<number, number>();
  for (const position of positions) {
    if (position.positionType === "EMPTY_SPACE" || position.positionType === "EXIT") continue;
    positionsByRow.set(position.rowIndex, (positionsByRow.get(position.rowIndex) ?? 0) + 1);
  }
  const widestPhysicalRow = Math.max(0, ...positionsByRow.values());
  const minimumLayoutWidthM = positions.length > 0
    ? widestPhysicalRow * CINEMA_PLANNING_LIMITS.seatWidthM
    : null;
  const minimumLayoutDepthM = positions.length > 0
    ? rowIndices.size * CINEMA_PLANNING_LIMITS.rowPitchM + (firstRowClearanceM ?? 0)
    : null;
  const plannedPersonCapacity = computeLayoutStats(positions).sellableCapacity;

  return {
    areaSqm,
    volumeCbm,
    maxPersonCapacity,
    maxRowsByDepth,
    maxPositionsPerRowByWidth,
    firstRowClearanceM,
    plannedPersonCapacity,
    minimumLayoutWidthM,
    minimumLayoutDepthM,
    exceedsCapacity: maxPersonCapacity != null && plannedPersonCapacity > maxPersonCapacity,
    exceedsWidth: widthM != null && minimumLayoutWidthM != null && minimumLayoutWidthM > widthM,
    exceedsDepth: lengthM != null && minimumLayoutDepthM != null && minimumLayoutDepthM > lengthM,
  };
}
