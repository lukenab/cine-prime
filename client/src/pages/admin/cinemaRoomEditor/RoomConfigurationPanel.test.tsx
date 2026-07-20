import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoomConfigurationPanel } from "./RoomConfigurationPanel";

describe("RoomConfigurationPanel", () => {
  it("keeps required feedback at field level instead of showing section counters", () => {
    render(
      <RoomConfigurationPanel
        basic={<div>Basic fields</div>} dimensions={<div>Dimension fields</div>}
        projection={<div>Projection fields</div>} audio={<div>Audio fields</div>}
        grid={<div>Grid fields</div>} distribution={<div>Distribution fields</div>}
      />,
    );

    expect(screen.getByText("Room specifications")).toBeInTheDocument();
    expect(screen.queryByText(/fields? left/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/setup progress/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/setup sections complete/i)).not.toBeInTheDocument();
  });
});
