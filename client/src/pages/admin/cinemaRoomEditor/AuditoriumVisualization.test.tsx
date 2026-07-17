import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AudioCoverageFrame, ProjectionBeamOverlay, ProjectionScreenVisualization } from "./AuditoriumVisualization";

describe("AuditoriumVisualization", () => {
  it("renders ScreenX as three screen surfaces without changing the projector taxonomy", () => {
    render(<ProjectionScreenVisualization config={{
      presentationSystem: "SCREENX",
      projectionTechnologyCode: "LASER",
      projectionTechnologyName: "Laser",
      resolutionCode: "4K",
    }} />);

    const visualization = screen.getByLabelText("ScreenX screen visualization");
    expect(visualization).toHaveAttribute("data-screen-surface-count", "3");
    expect(visualization).toHaveAttribute("data-display-mode", "PROJECTED");
    expect(visualization.querySelector('[data-projection-effect="LASER"]')).toBeInTheDocument();
    expect(screen.getByText("ScreenX")).toBeInTheDocument();
    expect(screen.queryByText(/3 screens|270°|Laser|4K/i)).not.toBeInTheDocument();
  });

  it("renders Direct View LED as one non-projected display surface", () => {
    render(<ProjectionScreenVisualization config={{
      presentationSystem: "STANDARD",
      projectionTechnologyCode: "DIRECT_VIEW_LED",
      projectionTechnologyName: "Direct View LED",
    }} />);

    const visualization = screen.getByLabelText("Standard screen visualization");
    expect(visualization).toHaveAttribute("data-screen-surface-count", "1");
    expect(visualization).toHaveAttribute("data-display-mode", "DIRECT_VIEW");
    expect(visualization.querySelector('[data-projection-effect="DIRECT_VIEW_LED"]')).toBeInTheDocument();
    expect(visualization.querySelector('[data-projection-effect="LASER"], [data-projection-effect="XENON"]')).not.toBeInTheDocument();
  });

  it("renders Xenon as a wider warm projection beam", () => {
    render(<ProjectionScreenVisualization config={{ presentationSystem: "STANDARD", projectionTechnologyCode: "XENON" }} />);
    expect(screen.getByLabelText("Standard screen visualization").querySelector('[data-projection-effect="XENON"]')).toBeInTheDocument();
  });

  it("identifies the legacy projector marker semantically", () => {
    render(<ProjectionBeamOverlay technologyCode="LASER" />);
    const projector = screen.getByRole("img", { name: /Laser projector behind the audience/i });
    expect(projector).toHaveAttribute("data-equipment", "projector");
  });

  it("shows Dolby Atmos speaker zones without explanatory labels", () => {
    render(
      <AudioCoverageFrame config={{ presentationSystem: "STANDARD", audioFormatCode: "DOLBY_ATMOS", audioFormatName: "Dolby Atmos" }}>
        <div>Seat map</div>
      </AudioCoverageFrame>,
    );

    expect(screen.getByLabelText("Dolby Atmos conceptual speaker coverage")).toBeInTheDocument();
    expect(screen.queryByText("Front audio")).not.toBeInTheDocument();
    expect(screen.queryByText("Overhead layer")).not.toBeInTheDocument();
    expect(screen.queryByText("Rear audio")).not.toBeInTheDocument();
    expect(screen.queryByText(/not an engineering installation plan/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-equipment="speaker"]').length).toBeGreaterThan(0);
  });
});
