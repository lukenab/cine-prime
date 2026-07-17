import type { LayoutPosition } from "../../../api/movieApi";
import { computeLayoutStats } from "./cinemaRoomLayoutGenerator";
import type { GridConfigForm, RoomInfoForm, TechConfigForm } from "./cinemaRoomEditor.types";
import { calculateRoomCapacityEnvelope } from "./cinemaRoomCapacity";

export type ValidationIssue = {
  /** Form field this issue is about, if any — lets the UI show it inline next
   *  to the offending input instead of only in a summary list. */
  field?: string;
  /** Layout position keys ("row:col") this issue is about, if any — plural
   *  since e.g. a duplicate seat code can implicate more than one position.
   *  Used by the seat editor's validation panel to jump to/highlight them. */
  positionKeys?: string[];
  message: string;
  /** Only 'error' blocks Submit; 'warning' is informational (e.g. screen wider
   *  than the room — still physically odd but not something we hard-block). */
  severity: "error" | "warning";
};

export type CinemaRoomEditorValidationInput = {
  clusterId: number | null;
  roomInfo: RoomInfoForm;
  techConfig: TechConfigForm;
  gridConfig: GridConfigForm;
  positions: LayoutPosition[];
};

/** Full validation rule set for the Cinema Room editor (spec §10). Pure and
 *  synchronous — reused both for inline field messages and to gate the Submit
 *  button (blocked only by `severity: 'error'` issues; warnings never block). */
export function validateCinemaRoomEditor(input: CinemaRoomEditorValidationInput): ValidationIssue[] {
  const { clusterId, roomInfo, techConfig, gridConfig, positions } = input;
  const issues: ValidationIssue[] = [];

  if (clusterId == null) {
    issues.push({ field: "clusterId", message: "Cinema Cluster is required.", severity: "error" });
  }
  if (!roomInfo.roomCode.trim()) {
    issues.push({ field: "roomCode", message: "Room Code is required.", severity: "error" });
  }
  if (roomInfo.cinemaRoomName.trim().length < 2) {
    issues.push({ field: "cinemaRoomName", message: "Room Name is required.", severity: "error" });
  }
  if (roomInfo.auditoriumClassId == null) {
    issues.push({ field: "auditoriumClassId", message: "Room Service Tier is required.", severity: "error" });
  }
  if (!(Number(roomInfo.lengthM) > 0)) {
    issues.push({ field: "lengthM", message: "Room Length must be greater than zero.", severity: "error" });
  }
  if (!(Number(roomInfo.widthM) > 0)) {
    issues.push({ field: "widthM", message: "Room Width must be greater than zero.", severity: "error" });
  }
  if (!(Number(roomInfo.clearHeightM) > 0)) {
    issues.push({ field: "clearHeightM", message: "Room Height must be greater than zero.", severity: "error" });
  }

  if (techConfig.projectionTechnologyId == null) {
    issues.push({ field: "projectionTechnologyId", message: "Projection Technology is required.", severity: "error" });
  }
  if (techConfig.resolutionId == null) {
    issues.push({ field: "resolutionId", message: "Resolution is required.", severity: "error" });
  }
  const screenWidth = Number(techConfig.screenWidthM);
  const screenHeight = Number(techConfig.screenHeightM);
  if (!(screenWidth > 0) || !(screenHeight > 0)) {
    issues.push({ field: "screen", message: "Screen dimensions must be valid (greater than zero).", severity: "error" });
  } else {
    const roomWidth = Number(roomInfo.widthM);
    const roomHeight = Number(roomInfo.clearHeightM);
    if (roomWidth > 0 && screenWidth > roomWidth) {
      issues.push({ field: "screen", message: "Screen width exceeds the room width.", severity: "warning" });
    }
    if (roomHeight > 0 && screenHeight > roomHeight) {
      issues.push({ field: "screen", message: "Screen height exceeds the room's clear height.", severity: "warning" });
    }
  }
  if (techConfig.audioFormatId == null) {
    issues.push({ field: "audioFormatId", message: "Audio Format is required.", severity: "error" });
  }
  if (!techConfig.supports2d && !techConfig.supports3d) {
    issues.push({
      field: "presentationFormats",
      message: "Select at least one supported presentation format.",
      severity: "error",
    });
  }

  if (!(gridConfig.numberOfRows > 0)) {
    issues.push({ field: "numberOfRows", message: "Number of rows must be greater than zero.", severity: "error" });
  }
  if (!(gridConfig.maxPositionsPerRow > 0)) {
    issues.push({ field: "maxPositionsPerRow", message: "Positions per row must be greater than zero.", severity: "error" });
  }

  if (positions.length === 0) {
    issues.push({ field: "positions", message: "The seat layout has no positions — generate a layout first.", severity: "error" });
  } else {
    const stats = computeLayoutStats(positions);
    if (stats.sellableUnitCount === 0) {
      issues.push({ field: "positions", message: "The layout must contain at least one valid seat.", severity: "error" });
    }

    // Reuses computeLayoutStats' own group-size accounting (single source of
    // truth) instead of re-deriving Couple group sizes here.
    for (const groupId of stats.incompleteCoupleGroupIds) {
      const strays = positions.filter((p) => p.seatGroupId === groupId);
      const stray = strays[0];
      issues.push({
        positionKeys: strays.map((p) => `${p.rowIndex}:${p.columnIndex}`),
        message: `Couple seat ${stray?.seatCode ?? ""} is missing its pair — no Couple group may contain only one position.`,
        severity: "error",
      });
    }

    const seenCodes = new Map<string, string[]>();
    for (const p of positions) {
      if (p.positionType !== "SEAT" || !p.seatCode) continue;
      const key = `${p.rowIndex}:${p.columnIndex}`;
      if (!seenCodes.has(p.seatCode)) seenCodes.set(p.seatCode, []);
      seenCodes.get(p.seatCode)!.push(key);
    }
    for (const [code, keys] of seenCodes) {
      if (keys.length > 1) {
        issues.push({
          positionKeys: keys,
          message: `Seat code "${code}" is used ${keys.length} times — seat codes must be unique.`,
          severity: "error",
        });
      }
    }

    const envelope = calculateRoomCapacityEnvelope(roomInfo, techConfig, positions);
    if (envelope.exceedsCapacity) {
      issues.push({
        field: "positions",
        message: `Layout capacity (${envelope.plannedPersonCapacity}) exceeds the room planning limit (${envelope.maxPersonCapacity}) derived from floor area and volume.`,
        severity: "error",
      });
    }
    if (envelope.exceedsWidth) {
      issues.push({
        field: "positions",
        message: `The layout needs at least ${envelope.minimumLayoutWidthM?.toFixed(1)} m of width at the minimum seat module.`,
        severity: "error",
      });
    }
    if (envelope.exceedsDepth) {
      issues.push({
        field: "positions",
        message: `The layout needs at least ${envelope.minimumLayoutDepthM?.toFixed(1)} m of depth for screen clearance and row pitch.`,
        severity: "error",
      });
    }
  }

  return issues;
}

/** First error-severity message for a given field, if any — used by form
 *  sections to show inline validation messages next to the offending input. */
export function getFieldError(issues: ValidationIssue[], field: string): string | undefined {
  return issues.find((i) => i.field === field && i.severity === "error")?.message;
}

/** First warning-severity message for a given field, if any. */
export function getFieldWarning(issues: ValidationIssue[], field: string): string | undefined {
  return issues.find((i) => i.field === field && i.severity === "warning")?.message;
}
