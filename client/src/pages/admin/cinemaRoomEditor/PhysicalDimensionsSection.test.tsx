import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhysicalDimensionsSection } from "./PhysicalDimensionsSection";

describe("PhysicalDimensionsSection", () => {
  it("moves planning guidance into an accessible help tooltip", () => {
    render(
      <PhysicalDimensionsSection
        value={{ cinemaRoomName: "Room", roomCode: "R01", auditoriumClassId: 1, lengthM: "20", widthM: "15", clearHeightM: "6" }}
        onChange={() => {}}
        issues={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "How room dimensions affect seat capacity" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("0.80 m²");
    expect(screen.getByText("300.0 m²")).toBeInTheDocument();
    expect(screen.queryByText(/Planning guard:/i)).not.toBeInTheDocument();
  });
});
