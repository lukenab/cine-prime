import { describe, expect, it } from "vitest";
import type { LayoutPosition } from "../../../api/movieApi";
import type { CinemaRoomEditorValidationInput } from "./cinemaRoomValidation";
import { getFieldError, validateCinemaRoomEditor } from "./cinemaRoomValidation";
import { applyAssignment, generateInitialGrid, positionKey } from "./cinemaRoomLayoutGenerator";

function baseInput(overrides: Partial<CinemaRoomEditorValidationInput> = {}): CinemaRoomEditorValidationInput {
  return {
    clusterId: 1,
    roomInfo: { cinemaRoomName: "Room 1", roomCode: "R01", auditoriumClassId: 1, lengthM: "20", widthM: "15", clearHeightM: "6" },
    techConfig: { projectionTechnologyId: 1, resolutionId: 1, screenWidthM: "10", screenHeightM: "5", audioFormatId: 1, supports2d: true, supports3d: false },
    gridConfig: { numberOfRows: 2, maxPositionsPerRow: 2, firstRowLabel: "A", numberingDirection: "LEFT_TO_RIGHT", numberingPolicy: "CONTIGUOUS_SEATS" },
    positions: generateInitialGrid(2, 2, 0, "LEFT_TO_RIGHT"),
    ...overrides,
  };
}

describe("validateCinemaRoomEditor", () => {
  it("returns no issues for a fully valid configuration", () => {
    expect(validateCinemaRoomEditor(baseInput())).toEqual([]);
  });

  it("requires a cluster", () => {
    const issues = validateCinemaRoomEditor(baseInput({ clusterId: null }));
    expect(getFieldError(issues, "clusterId")).toMatch(/cluster/i);
  });

  it("requires a room code", () => {
    const input = baseInput();
    input.roomInfo.roomCode = "  ";
    expect(getFieldError(validateCinemaRoomEditor(input), "roomCode")).toMatch(/room code/i);
  });

  it("requires a room name", () => {
    const input = baseInput();
    input.roomInfo.cinemaRoomName = "R";
    expect(getFieldError(validateCinemaRoomEditor(input), "cinemaRoomName")).toMatch(/room name/i);
  });

  it("requires a service tier", () => {
    const input = baseInput();
    input.roomInfo.auditoriumClassId = null;
    expect(getFieldError(validateCinemaRoomEditor(input), "auditoriumClassId")).toMatch(/service tier/i);
  });

  it("requires length, width, and height to be greater than zero", () => {
    const lengthInput = baseInput(); lengthInput.roomInfo.lengthM = "0";
    const widthInput = baseInput(); widthInput.roomInfo.widthM = "-1";
    const heightInput = baseInput(); heightInput.roomInfo.clearHeightM = "";
    expect(getFieldError(validateCinemaRoomEditor(lengthInput), "lengthM")).toMatch(/length/i);
    expect(getFieldError(validateCinemaRoomEditor(widthInput), "widthM")).toMatch(/width/i);
    expect(getFieldError(validateCinemaRoomEditor(heightInput), "clearHeightM")).toMatch(/height/i);
  });

  it("requires projection technology and resolution", () => {
    const projInput = baseInput(); projInput.techConfig.projectionTechnologyId = null;
    const resInput = baseInput(); resInput.techConfig.resolutionId = null;
    expect(getFieldError(validateCinemaRoomEditor(projInput), "projectionTechnologyId")).toMatch(/projection/i);
    expect(getFieldError(validateCinemaRoomEditor(resInput), "resolutionId")).toMatch(/resolution/i);
  });

  it("requires valid (positive) screen dimensions", () => {
    const input = baseInput();
    input.techConfig.screenWidthM = "0";
    expect(getFieldError(validateCinemaRoomEditor(input), "screen")).toMatch(/screen dimensions/i);
  });

  it("warns (without blocking) when the screen exceeds the room's dimensions", () => {
    const input = baseInput();
    input.techConfig.screenWidthM = "999";
    const issues = validateCinemaRoomEditor(input);
    expect(issues.some((i) => i.field === "screen" && i.severity === "warning")).toBe(true);
    expect(issues.some((i) => i.severity === "error")).toBe(false);
  });

  it("requires an audio format", () => {
    const input = baseInput();
    input.techConfig.audioFormatId = null;
    expect(getFieldError(validateCinemaRoomEditor(input), "audioFormatId")).toMatch(/audio format/i);
  });

  it("requires at least one presentation format", () => {
    const input = baseInput();
    input.techConfig.supports2d = false;
    input.techConfig.supports3d = false;
    expect(getFieldError(validateCinemaRoomEditor(input), "presentationFormats")).toMatch(/at least one/i);
  });

  it("requires rows and positions per row to be greater than zero", () => {
    const rowsInput = baseInput(); rowsInput.gridConfig.numberOfRows = 0;
    const posInput = baseInput(); posInput.gridConfig.maxPositionsPerRow = 0;
    expect(getFieldError(validateCinemaRoomEditor(rowsInput), "numberOfRows")).toMatch(/rows/i);
    expect(getFieldError(validateCinemaRoomEditor(posInput), "maxPositionsPerRow")).toMatch(/positions per row/i);
  });

  it("rejects a layout whose capacity exceeds the room area and volume envelope", () => {
    const input = baseInput({
      roomInfo: { cinemaRoomName: "Tiny", roomCode: "R02", auditoriumClassId: 1, lengthM: "5", widthM: "5", clearHeightM: "3" },
      techConfig: { projectionTechnologyId: 1, resolutionId: 1, screenWidthM: "2", screenHeightM: "1", audioFormatId: 1, supports2d: true, supports3d: false },
      gridConfig: { numberOfRows: 10, maxPositionsPerRow: 10, firstRowLabel: "A", numberingDirection: "LEFT_TO_RIGHT", numberingPolicy: "CONTIGUOUS_SEATS" },
      positions: generateInitialGrid(10, 10, 0, "LEFT_TO_RIGHT"),
    });

    expect(getFieldError(validateCinemaRoomEditor(input), "positions")).toMatch(/exceeds the room planning limit/i);
  });

  it("requires the layout to have at least one position", () => {
    const input = baseInput({ positions: [] });
    expect(getFieldError(validateCinemaRoomEditor(input), "positions")).toMatch(/no positions|generate a layout/i);
  });

  it("requires at least one sellable seat when positions exist", () => {
    const positions: LayoutPosition[] = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT").map((p) => ({ ...p, positionType: "AISLE" as const }));
    const input = baseInput({ positions });
    expect(getFieldError(validateCinemaRoomEditor(input), "positions")).toMatch(/at least one valid seat/i);
  });

  it("flags a Couple group that has only one position", () => {
    const positions = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT").map((p) =>
      p.columnIndex === 0 ? { ...p, seatType: "COUPLE" as const, seatGroupId: "g1" } : p,
    );
    const input = baseInput({ positions });
    const issues = validateCinemaRoomEditor(input);
    expect(issues.some((i) => i.severity === "error" && /missing its pair/i.test(i.message))).toBe(true);
  });

  it("flags duplicate seat codes", () => {
    const positions = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT").map((p) => ({ ...p, seatCode: "A1" }));
    const input = baseInput({ positions });
    const issues = validateCinemaRoomEditor(input);
    expect(issues.some((i) => i.severity === "error" && /unique/i.test(i.message))).toBe(true);
  });

  it("does not flag a properly paired Couple group", () => {
    const base = generateInitialGrid(1, 2, 0, "LEFT_TO_RIGHT");
    const positions = applyAssignment(base, new Set([positionKey(0, 0), positionKey(0, 1)]), "SEAT", "COUPLE", "g1");
    const input = baseInput({ positions });
    const issues = validateCinemaRoomEditor(input);
    expect(issues.some((i) => /missing its pair/i.test(i.message))).toBe(false);
  });
});
