import { describe, expect, it } from "vitest";
import { generateInitialGrid } from "./cinemaRoomLayoutGenerator";
import { calculateRoomCapacityEnvelope } from "./cinemaRoomCapacity";

describe("calculateRoomCapacityEnvelope", () => {
  it("limits capacity by both floor area and room volume", () => {
    const envelope = calculateRoomCapacityEnvelope(
      { cinemaRoomName: "Room 1", roomCode: "R01", auditoriumClassId: 1, lengthM: "20", widthM: "15", clearHeightM: "3" },
      { projectionTechnologyId: 1, resolutionId: 1, screenWidthM: "10", screenHeightM: "5", audioFormatId: 1, supports2d: true, supports3d: false },
      generateInitialGrid(8, 10, 0, "LEFT_TO_RIGHT"),
    );

    expect(envelope.areaSqm).toBe(300);
    expect(envelope.volumeCbm).toBe(900);
    expect(envelope.maxPersonCapacity).toBe(225);
    expect(envelope.maxRowsByDepth).toBe(12);
    expect(envelope.maxPositionsPerRowByWidth).toBe(30);
    expect(envelope.exceedsCapacity).toBe(false);
  });

  it("detects an over-capacity and over-depth grid", () => {
    const envelope = calculateRoomCapacityEnvelope(
      { cinemaRoomName: "Tiny", roomCode: "R02", auditoriumClassId: 1, lengthM: "5", widthM: "5", clearHeightM: "3" },
      { projectionTechnologyId: 1, resolutionId: 1, screenWidthM: "2", screenHeightM: "1", audioFormatId: 1, supports2d: true, supports3d: false },
      generateInitialGrid(10, 10, 0, "LEFT_TO_RIGHT"),
    );

    expect(envelope.maxPersonCapacity).toBe(18);
    expect(envelope.plannedPersonCapacity).toBe(100);
    expect(envelope.exceedsCapacity).toBe(true);
    expect(envelope.exceedsDepth).toBe(true);
  });
});
