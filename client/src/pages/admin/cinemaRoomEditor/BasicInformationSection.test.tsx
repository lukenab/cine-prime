import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CinemaRoomMasterData } from "../../../api/movieApi";
import { BasicInformationSection } from "./BasicInformationSection";
import type { RoomInfoForm } from "./cinemaRoomEditor.types";

const masterData: CinemaRoomMasterData = {
  auditoriumClasses: [
    { id: 1, code: "STANDARD", name: "Standard", description: "Standard commercial service tier" },
    { id: 2, code: "PREMIUM", name: "Premium", description: "Enhanced comfort and service tier" },
    { id: 3, code: "LUXURY", name: "Luxury", description: "Luxury low-density service tier" },
    { id: 4, code: "PRIVATE", name: "Private", description: "Private screening or event service tier" },
  ],
  projectionTechnologies: [], resolutions: [], audioFormats: [],
  seatTypes: [], numberingDirections: [], layoutPositionTypes: [], roomStatuses: [], layoutStatuses: [],
};

const value: RoomInfoForm = {
  cinemaRoomName: "Room 1", roomCode: "R01", auditoriumClassId: null,
  lengthM: "20", widthM: "15", clearHeightM: "6",
};

describe("BasicInformationSection", () => {
  it("renders commercial tiers from master data without hard-coding options", () => {
    render(<BasicInformationSection masterData={masterData} value={value} onChange={() => {}} issues={[]} />);

    expect(screen.getByText("Service Tier")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About Service Tier" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /private/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /plf/i })).not.toBeInTheDocument();
  });

  it("shows the selected service-tier description on demand without an inline card", async () => {
    const user = userEvent.setup();
    render(<BasicInformationSection masterData={masterData} value={{ ...value, auditoriumClassId: 2 }} onChange={() => {}} issues={[]} />);

    expect(screen.queryByText(/Enhanced comfort and service tier/i)).not.toBeInTheDocument();
    await user.hover(screen.getByRole("button", { name: "About Service Tier" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/Enhanced comfort and service tier/i);
  });

  it("returns the selected service-tier id", async () => {
    const onChange = vi.fn();
    render(<BasicInformationSection masterData={masterData} value={value} onChange={onChange} issues={[]} />);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: /service tier/i }), "2");

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ auditoriumClassId: 2 }));
  });

  it("shows an inline error message next to the room code field", () => {
    render(
      <BasicInformationSection
        masterData={masterData} value={value} onChange={() => {}}
        issues={[{ field: "roomCode", message: "Room Code is required.", severity: "error" }]}
      />,
    );
    expect(screen.getByText("Room Code is required.")).toBeInTheDocument();
  });

  it("disables inputs when read-only", () => {
    render(<BasicInformationSection masterData={masterData} value={value} onChange={() => {}} issues={[]} disabled />);
    expect(screen.getByPlaceholderText("e.g. R01")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /service tier/i })).toBeDisabled();
  });
});
