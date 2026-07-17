import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectionConfigurationSection } from "./ProjectionConfigurationSection";

const masterData = {
  projectionTechnologies: [{ id: 1, code: "LASER", name: "Laser", description: "Laser projection system" }],
  resolutions: [{ id: 1, code: "2K", name: "2K" }, { id: 2, code: "4K", name: "4K" }],
  presentationSystems: ["STANDARD", "IMAX", "DOLBY_CINEMA", "SCREENX"],
} as any;

const value = {
  projectionTechnologyId: 1,
  presentationSystem: "STANDARD" as const,
  resolutionId: 1,
  screenWidthM: "12",
  screenHeightM: "5",
  audioFormatId: 1,
  supports2d: true,
  supports3d: false,
};

describe("ProjectionConfigurationSection", () => {
  it("keeps presentation system separate from projection technology", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectionConfigurationSection masterData={masterData} value={value} onChange={onChange} issues={[]} />);

    const system = screen.getByRole("combobox", { name: "Presentation System" });
    expect(screen.getByRole("button", { name: "About Presentation System" })).toBeInTheDocument();
    expect(screen.queryByText(/One front screen/i)).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ScreenX" })).toBeInTheDocument();
    await user.selectOptions(system, "SCREENX");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ presentationSystem: "SCREENX", projectionTechnologyId: 1 }));
  });

  it("keeps each selected-option description available from its own field tooltip", async () => {
    const user = userEvent.setup();
    render(<ProjectionConfigurationSection masterData={masterData} value={value} onChange={() => {}} issues={[]} />);

    const presentationHelp = screen.getByRole("button", { name: "About Presentation System" });
    const projectionHelp = screen.getByRole("button", { name: "About Projection Technology" });
    expect(screen.queryByText(/Laser projection system/i)).not.toBeInTheDocument();

    await user.hover(presentationHelp);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/One front screen/i);
    await user.unhover(presentationHelp);

    await user.hover(projectionHelp);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/Laser projection system/i);
  });

  it("suggests Flat and Scope screen dimensions from the room envelope", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectionConfigurationSection masterData={masterData} value={value} onChange={onChange} issues={[]} roomWidthM="15" roomClearHeightM="6" />);

    const scopeSuggestion = screen.getByRole("button", { name: /Scope 2.39/i });
    expect(scopeSuggestion).toHaveTextContent("11.5 × 4.8 m");
    await user.click(scopeSuggestion);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ screenWidthM: "11.5", screenHeightM: "4.8" }));
  });

  it("shows two resolutions as a direct segmented choice", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectionConfigurationSection masterData={masterData} value={value} onChange={onChange} issues={[]} />);

    expect(screen.queryByRole("combobox", { name: "Resolution" })).not.toBeInTheDocument();
    const fourK = screen.getByRole("radio", { name: "4K" });
    expect(screen.getByRole("radio", { name: "2K" })).toHaveAttribute("aria-checked", "true");
    await user.click(fourK);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ resolutionId: 2 }));
  });

  it("renders 2D and 3D as clear multi-select cards and keeps at least one enabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectionConfigurationSection masterData={masterData} value={value} onChange={onChange} issues={[]} />);

    const twoD = screen.getByRole("button", { name: /2D Standard playback/i });
    const threeD = screen.getByRole("button", { name: /3D Stereoscopic playback/i });
    expect(twoD).toHaveAttribute("aria-pressed", "true");
    expect(threeD).toHaveAttribute("aria-pressed", "false");

    await user.click(twoD);
    expect(onChange).not.toHaveBeenCalled();
    await user.click(threeD);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ supports2d: true, supports3d: true }));
  });
});
