import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeatLegend } from "./SeatLegend";

describe("SeatLegend", () => {
  it("keeps swatches visible without a redundant Legend heading", () => {
    const { container } = render(<SeatLegend />);

    expect(screen.queryByText("Legend")).not.toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeVisible();
    expect(screen.getByText("VIP")).toBeVisible();
    expect(container.querySelector("details")).toBeNull();
  });
});
