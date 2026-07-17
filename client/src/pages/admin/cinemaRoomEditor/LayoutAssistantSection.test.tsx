import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { GridConfigForm, LayoutAssistantForm } from "./cinemaRoomEditor.types";
import { generateInitialGrid } from "./cinemaRoomLayoutGenerator";
import { LayoutAssistantSection } from "./LayoutAssistantSection";

const gridConfig: GridConfigForm = {
  numberOfRows: 4, maxPositionsPerRow: 6, firstRowLabel: "A",
  numberingDirection: "LEFT_TO_RIGHT", numberingPolicy: "CONTIGUOUS_SEATS",
};

const value: LayoutAssistantForm = {
  templateCode: "BALANCED", templateVersion: 1,
  zones: [
    { id: "standard", fromRow: 0, toRow: 1, seatType: "STANDARD" },
    { id: "vip", fromRow: 2, toRow: 2, seatType: "VIP" },
    { id: "couple", fromRow: 3, toRow: 3, seatType: "COUPLE" },
  ],
  verticalAisleColumns: [], horizontalAisleRows: [], preserveManualOverrides: true,
};

function renderAssistant(overrides: Partial<React.ComponentProps<typeof LayoutAssistantSection>> = {}) {
  const props: React.ComponentProps<typeof LayoutAssistantSection> = {
    value, onChange: vi.fn(), gridConfig,
    positions: generateInitialGrid(4, 6, 0, "LEFT_TO_RIGHT"),
    onApply: vi.fn(), onPreview: vi.fn(), onWarnings: vi.fn(),
    ...overrides,
  };
  render(<LayoutAssistantSection {...props} />);
  return props;
}

describe("LayoutAssistantSection", () => {
  it("shows only the guided operational controls and no raw advanced zone editor", async () => {
    const user = userEvent.setup();
    const props = renderAssistant();

    expect(screen.queryByText(/Choose a starting layout/i)).not.toBeInTheDocument();
    expect(screen.getByText("Seat allocation")).toBeInTheDocument();
    expect(screen.getByText("Walkways")).toBeInTheDocument();
    expect(screen.queryByText("Advanced options")).not.toBeInTheDocument();
    expect(screen.queryByText("Custom row zones")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Increase Standard rows" }));
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ templateCode: "CUSTOM" }));
  });

  it("keeps manual walkways compact and adds an aisle using one combined selector", async () => {
    const user = userEvent.setup();
    const props = renderAssistant();

    expect(screen.queryByRole("combobox", { name: "Add walkway" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add manually" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Add walkway" }), "vertical:2");
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ verticalAisleColumns: [2] }));
  });

  it("recommends paired side aisles for a wide room with a Couple last row", async () => {
    const user = userEvent.setup();
    const wideGrid = { ...gridConfig, numberOfRows: 11, maxPositionsPerRow: 14 };
    const wideValue: LayoutAssistantForm = {
      ...value,
      zones: [
        { id: "standard", fromRow: 0, toRow: 3, seatType: "STANDARD" },
        { id: "vip", fromRow: 4, toRow: 9, seatType: "VIP" },
        { id: "couple", fromRow: 10, toRow: 10, seatType: "COUPLE" },
      ],
    };
    const props = renderAssistant({ value: wideValue, gridConfig: wideGrid, positions: generateInitialGrid(11, 14, 0, "LEFT_TO_RIGHT") });

    await user.click(screen.getByRole("button", { name: "Apply recommended walkways" }));

    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ verticalAisleColumns: [2, 11] }));
  });

  it("previews inline and applies only after explicit confirmation", async () => {
    const user = userEvent.setup();
    const props = renderAssistant();

    await user.click(screen.getByRole("button", { name: "Preview Layout" }));
    expect(screen.getByText("Preview ready")).toBeInTheDocument();
    await waitFor(() => expect(props.onPreview).toHaveBeenCalledWith(expect.any(Array)));
    expect(props.onApply).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Apply Layout" }));
    expect(props.onApply).toHaveBeenCalledWith(expect.any(Array));
    expect(props.onPreview).toHaveBeenLastCalledWith(null);
  });

});
