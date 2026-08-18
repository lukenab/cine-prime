import { render, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SeatBookingPage from "./SeatBookingPage";

const mocks = vi.hoisted(() => ({
  createBooking: vi.fn(),
  getSeatHoldPolicy: vi.fn(),
  getSeatMapByShowtime: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("../../api/bookingApi", () => ({
  bookingApi: {
    createBooking: mocks.createBooking,
    getSeatHoldPolicy: mocks.getSeatHoldPolicy,
    getSeatMapByShowtime: mocks.getSeatMapByShowtime,
  },
  seatInventoryWebSocketUrl: () => "ws://localhost/seat-inventory",
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { accountId: "member-1", role: "ROLE_MEMBER" },
    needsProfileSetup: false,
    profileCheckPending: false,
  }),
}));

vi.mock("../../components/booking/CheckoutProgress", () => ({
  default: () => null,
}));

vi.mock("../../components/booking/BookingSummaryCard", () => ({
  default: () => <div data-testid="booking-summary" />,
}));

vi.mock("../auth/CompleteProfilePage", () => ({
  default: () => null,
}));

vi.mock("../admin/cinemaRoomEditor/AuditoriumVisualization", () => ({
  AudioCoverageFrame: ({ children }: { children: React.ReactNode }) => children,
  ProjectionBeamOverlay: () => null,
  ProjectionScreenVisualization: () => null,
}));

vi.mock("../../lib/notifications", () => ({
  notify: { error: mocks.notifyError },
}));

class FakeWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }
}

describe("SeatBookingPage login resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    mocks.getSeatHoldPolicy.mockResolvedValue({
      channel: "WEB",
      ttlSeconds: 600,
      maxSeatsPerBooking: 8,
    });
    mocks.getSeatMapByShowtime.mockResolvedValue({
      seats: [
        {
          seatId: 501,
          seatCode: "A1",
          row: "A",
          number: 1,
          type: "STANDARD",
          status: "AVAILABLE",
          price: 90000,
        },
      ],
      positions: [
        {
          positionId: 1,
          rowIndex: 0,
          columnIndex: 0,
          rowLabel: "A",
          positionType: "SEAT",
          seatNumber: 1,
          seatCode: "A1",
          seatType: "STANDARD",
        },
      ],
    });
    mocks.createBooking.mockResolvedValue({
      bookingId: "booking-1",
      lockedUntil: "2026-08-18T17:00:00Z",
    });
  });

  it("revalidates the restored seats and continues automatically after login", async () => {
    const router = createMemoryRouter(
      [
        { path: "/booking/:showtimeId", element: <SeatBookingPage /> },
        { path: "/checkout/:bookingId/concessions", element: <div>Checkout resumed</div> },
      ],
      {
        initialEntries: [
          {
            pathname: "/booking/91",
            state: {
              resumeSeatIds: [501],
              resumeAfterLogin: true,
              showtime: {
                movieTitle: "Interstellar",
                cinemaName: "CinePrime District 1",
                hall: "Room 3",
                dateTime: "2026-08-18T19:30:00",
                duration: 169,
              },
            },
          },
        ],
      },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(mocks.createBooking).toHaveBeenCalledTimes(1);
    });
    expect(mocks.createBooking).toHaveBeenCalledWith({
      showtimeId: 91,
      seatIds: [501],
      idempotencyKey: expect.any(String),
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/checkout/booking-1/concessions");
    });
    expect(sessionStorage.getItem("seat-hold-draft:91")).toBeNull();
  });

  it("stops on the seat map when a restored seat is no longer available", async () => {
    mocks.getSeatMapByShowtime.mockResolvedValue({
      seats: [
        {
          seatId: 501,
          seatCode: "A1",
          row: "A",
          number: 1,
          type: "STANDARD",
          status: "BOOKED",
          price: 90000,
        },
      ],
      positions: [
        {
          positionId: 1,
          rowIndex: 0,
          columnIndex: 0,
          rowLabel: "A",
          positionType: "SEAT",
          seatNumber: 1,
          seatCode: "A1",
          seatType: "STANDARD",
        },
      ],
    });

    const router = createMemoryRouter(
      [{ path: "/booking/:showtimeId", element: <SeatBookingPage /> }],
      {
        initialEntries: [{
          pathname: "/booking/91",
          state: { resumeSeatIds: [501], resumeAfterLogin: true },
        }],
      },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(mocks.notifyError).toHaveBeenCalledWith(
        "Seats could not be reserved",
        "Seat availability changed. Please review the highlighted positions and select again.",
        { id: "seat-reservation-error" },
      );
    });
    expect(mocks.createBooking).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/booking/91");
  });
});
