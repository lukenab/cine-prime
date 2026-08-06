import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ShowtimeResponse } from "../api/showtimeApi";
import { ShowtimeTable } from "./ShowTimeTable";

const showtimes: ShowtimeResponse[] = Array.from({ length: 12 }, (_, index) => ({
  showTimeId: index + 1,
  movieId: 99,
  movieName: "Spider-Man: Brand New Day",
  cinemaRoomId: (index % 3) + 1,
  cinemaRoomName: `Room ${(index % 3) + 1}`,
  clusterId: 81,
  clusterName: "CinePrime Landmark 81",
  showDate: "2026-08-08",
  startTime: "10:00:00",
  endTime: "12:25:00",
  status: "SCHEDULED",
  formatCode: "2D",
  totalSeats: 120,
  availableSeats: 120,
}));

describe("ShowtimeTable bulk selection", () => {
  it("selects every matching showtime across pages from the header checkbox", () => {
    render(
      <ShowtimeTable
        showtimes={showtimes}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        searchQuery="Spider-Man"
        statusFilter="SCHEDULED"
        dateFilter=""
        roomFilter=""
        onBulkStatusChange={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /select all 12 matching showtimes/i }));

    expect(screen.getByText("12 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open sales/i })).toBeEnabled();
  });
});
