import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RoomConfigurationTemplate } from "../../../api/movieApi";
import { RoomQuickStartSection } from "./RoomQuickStartSection";

const template: RoomConfigurationTemplate = {
  id: 1,
  code: "PREMIUM_LASER",
  name: "Premium Laser",
  description: "Premium quick start",
  auditoriumClassId: 2,
  projectionTechnologyId: 3,
  resolutionId: 4,
  audioFormatId: 5,
  supports2d: true,
  supports3d: true,
  numberOfRows: 12,
  maxPositionsPerRow: 16,
  layoutTemplateCode: "BALANCED",
  standardRowPercentage: 40,
  coupleLastRow: true,
  centerAisle: true,
  crossAisle: false,
};

const standardTemplate: RoomConfigurationTemplate = {
  ...template,
  id: 2,
  code: "STANDARD_DIGITAL",
  name: "Standard Digital",
  description: "Standard quick start",
  supports3d: false,
  layoutTemplateCode: "ALL_STANDARD",
  standardRowPercentage: 100,
  coupleLastRow: false,
  centerAisle: false,
};

describe("RoomQuickStartSection", () => {
  it("preselects Standard Digital without applying it automatically", () => {
    const onApply = vi.fn();
    render(<RoomQuickStartSection templates={[template, standardTemplate]} hasExistingWork={false} onApply={onApply} />);

    expect(screen.getByRole("combobox", { name: "Room configuration template" })).toHaveValue("2");
    expect(screen.getByRole("button", { name: "About the selected room template" })).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Standard quick start");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("applies an unused template in one action", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<RoomQuickStartSection templates={[template]} hasExistingWork={false} onApply={onApply} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Room configuration template" }), "1");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith(template);
  });

  it("asks before replacing technical configuration or layout work", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<RoomQuickStartSection templates={[template]} hasExistingWork onApply={onApply} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Room configuration template" }), "1");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Apply Premium Laser?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply Template" }));
    expect(onApply).toHaveBeenCalledWith(template);
  });
});
