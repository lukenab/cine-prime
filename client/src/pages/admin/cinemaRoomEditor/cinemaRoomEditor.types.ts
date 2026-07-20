import type { NumberingDirectionValue, NumberingPolicyValue, PresentationSystemValue, SeatTypeValue } from "../../../api/movieApi";

export type RoomInfoForm = {
  cinemaRoomName: string;
  roomCode: string;
  auditoriumClassId: number | null;
  lengthM: string;
  widthM: string;
  clearHeightM: string;
};

export type TechConfigForm = {
  projectionTechnologyId: number | null;
  presentationSystem?: PresentationSystemValue;
  resolutionId: number | null;
  screenWidthM: string;
  screenHeightM: string;
  audioFormatId: number | null;
  supports2d: boolean;
  supports3d: boolean;
};

export type AuditoriumVisualizationConfig = {
  presentationSystem: PresentationSystemValue;
  projectionTechnologyCode?: string;
  projectionTechnologyName?: string;
  resolutionCode?: string;
  audioFormatCode?: string;
  audioFormatName?: string;
};

/** Rows / positions-per-row / numbering — drives the seat grid, independent from
 *  the room-info/technical forms above. Changing these never autosaves; it only
 *  reshapes local `positions` state until the user explicitly saves. */
export type GridConfigForm = {
  numberOfRows: number;
  maxPositionsPerRow: number;
  firstRowLabel: string;
  numberingDirection: NumberingDirectionValue;
  numberingPolicy: NumberingPolicyValue;
};

/** "Seat Distribution Template" quick-fill inputs (Section 7 of the spec) — a
 *  one-shot generator the user can re-apply, not persisted form state. The three
 *  percentages are normalized to sum 100 before being converted into row counts. */
export type DistributionTemplateForm = {
  standardPct: number;
  vipPct: number;
  couplePct: number;
};

export type SeatZoneRule = {
  id: string;
  fromRow: number;
  toRow: number;
  seatType: Extract<SeatTypeValue, "STANDARD" | "VIP" | "COUPLE">;
};

/** Versioned, deterministic input for the rule-based Layout Assistant. It is
 *  persisted as JSON metadata on RoomLayout; generated LayoutPositions remain
 *  the authoritative physical layout. */
export type LayoutAssistantForm = {
  templateCode: string;
  templateVersion: number;
  zones: SeatZoneRule[];
  /** Zero-based grid columns converted to vertical aisles. */
  verticalAisleColumns: number[];
  /** Zero-based row indices that become full-width horizontal aisles. */
  horizontalAisleRows: number[];
  preserveManualOverrides: boolean;
};
