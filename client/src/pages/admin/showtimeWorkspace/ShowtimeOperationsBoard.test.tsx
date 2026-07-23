import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ShowtimeResponse } from "../../../api/showtimeApi";
import ShowtimeOperationsBoard from "./ShowtimeOperationsBoard";

const showtimes: ShowtimeResponse[] = [
  {
    showTimeId: 1,
    movieId: 10,
    movieName: "Customer Visible Movie",
    cinemaRoomId: 100,
    cinemaRoomName: "Room 1",
    clusterId: 20,
    clusterName: "CinePrime Central",
    showDate: "2026-07-26",
    startTime: "10:00:00",
    endTime: "12:05:00",
    status: "ON_SALE",
    formatCode: "2D",
    totalSeats: 100,
    availableSeats: 72,
  },
  {
    showTimeId: 2,
    movieId: 11,
    movieName: "Internal Draft Movie",
    cinemaRoomId: 100,
    cinemaRoomName: "Room 1",
    clusterId: 20,
    clusterName: "CinePrime Central",
    showDate: "2026-07-26",
    startTime: "13:00:00",
    endTime: "15:00:00",
    status: "SCHEDULED",
    formatCode: "3D",
    totalSeats: 100,
    availableSeats: 100,
  },
];

function renderBoard() {
  return render(
    <ShowtimeOperationsBoard
      showtimes={showtimes}
      onEdit={vi.fn()}
      onMove={vi.fn().mockResolvedValue(undefined)}
      onStatusChange={vi.fn().mockResolvedValue(undefined)}
    />,
  );
}

describe("ShowtimeOperationsBoard", () => {
  it("shows operational room rows and status-specific schedule blocks", () => {
    renderBoard();

    expect(screen.getByText("Daily schedule")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sun, jul 26/i })).toBeInTheDocument();
    expect(screen.getByText("Room 1")).toBeInTheDocument();
    expect(screen.getByText("Customer Visible Movie")).toBeInTheDocument();
    expect(screen.getByText("Internal Draft Movie")).toBeInTheDocument();
    expect(screen.getByText("On sale")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });

  it("customer preview exposes only ON_SALE sessions", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /customer preview/i }));

    const dialog = screen.getByRole("dialog", { name: /customer schedule preview/i });
    expect(within(dialog).getByText("Customer Visible Movie")).toBeInTheDocument();
    expect(within(dialog).queryByText("Internal Draft Movie")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/1 internal showtime is hidden/i)).toBeInTheDocument();
  });
});
