import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { format } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickBooking } from "./QuickBooking";

const mocks = vi.hoisted(() => ({
  getClusters: vi.fn(),
  getShowtimes: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("../../api/movieApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/movieApi")>();
  return { ...actual, movieApi: { ...actual.movieApi, getClusters: mocks.getClusters } };
});

vi.mock("../../api/showtimeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/showtimeApi")>();
  return { ...actual, showtimeApi: { ...actual.showtimeApi, getShowtimes: mocks.getShowtimes } };
});

const cluster = {
  clusterId: 11,
  clusterCode: "CP-Q1",
  clusterName: "CinePrime District 1",
  venueType: "MALL" as const,
  countryCode: "VN",
  province: "Ho Chi Minh City",
  address: "182 Cinema Street",
  timezone: "Asia/Ho_Chi_Minh",
  operatingHours: [],
  status: "ACTIVE" as const,
};

describe("QuickBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getClusters.mockResolvedValue({ result: [cluster] });
    mocks.getShowtimes.mockResolvedValue({
      result: [
        {
          showTimeId: 91,
          movieId: 7,
          movieName: "Interstellar",
          cinemaRoomId: 3,
          cinemaRoomName: "Room 3",
          clusterId: 11,
          clusterName: "CinePrime District 1",
          showDate: format(new Date(), "yyyy-MM-dd"),
          startTime: "23:59:00",
          endTime: "02:48:00",
          status: "ON_SALE",
          availableSeats: 42,
          totalSeats: 100,
          price: 95000,
        },
      ],
    });
  });

  it("enforces cinema, movie and showtime selection before navigating to seats", async () => {
    render(<QuickBooking />);

    const cinemaSelect = await screen.findByLabelText("1. Cinema");
    const movieSelect = screen.getByLabelText("3. Movie");
    const continueButton = screen.getByRole("button", { name: /Choose seats/i });

    expect(movieSelect).toBeDisabled();
    expect(continueButton).toBeDisabled();

    fireEvent.click(cinemaSelect);
    fireEvent.click(screen.getByRole("option", { name: /CinePrime District 1/i }));
    await waitFor(() => expect(movieSelect).not.toBeDisabled());
    fireEvent.click(movieSelect);
    fireEvent.click(screen.getByRole("option", { name: "Interstellar" }));
    fireEvent.click(screen.getByLabelText("4. Showtime"));
    fireEvent.click(screen.getByRole("option", { name: /23:59/i }));

    expect(continueButton).not.toBeDisabled();
    fireEvent.click(continueButton);

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/booking/91",
      expect.objectContaining({
        state: expect.objectContaining({
          showtime: expect.objectContaining({
            movieTitle: "Interstellar",
            cinemaName: "CinePrime District 1",
            hall: "Room 3",
          }),
        }),
      })
    );
  });

  it("shows a real empty state when the selected cinema has no schedule", async () => {
    mocks.getShowtimes.mockResolvedValue({ result: [] });
    render(<QuickBooking />);

    fireEvent.click(await screen.findByLabelText("1. Cinema"));
    fireEvent.click(screen.getByRole("option", { name: /CinePrime District 1/i }));

    expect(screen.getByLabelText("3. Movie")).toHaveTextContent("No movies available");
    expect(screen.getByLabelText("3. Movie")).toBeDisabled();
  });
});
