import axiosClient from "./api";

export interface Seat {
  seatId: number;
  /** Stable code from the active room-layout snapshot, for example A1. */
  seatCode?: string;
  /** Atomic inventory group for couple/sofa seating. */
  seatGroupId?: string;
  row: string;
  number: number;
  type: "STANDARD" | "VIP" | "COUPLE" | "ACCESSIBLE";
  colSpan?: number;
  aisleAfter?: boolean;
  status: "AVAILABLE" | "LOCKED" | "BOOKED";
  price: number;
}

/** A physical cell in the room-layout version snapped to a showtime. */
export interface SeatMapPosition {
  positionId?: number;
  rowIndex: number;
  columnIndex: number;
  rowLabel: string;
  positionType: "SEAT" | "AISLE" | "EXIT" | "EMPTY_SPACE";
  seatNumber?: number;
  seatCode?: string;
  seatType?: Seat["type"];
  seatGroupId?: string;
}

/**
 * Customer inventory and its immutable auditorium geometry.
 * A public showtime without positions is invalid and must not fall back to a
 * synthetic grid.
 */
export interface ShowtimeSeatMap {
  seats: Seat[];
  positions: SeatMapPosition[];
  presentationSystem?: "STANDARD" | "IMAX" | "DOLBY_CINEMA" | "SCREENX" | "FOUR_DX";
  projectionTechnologyCode?: string;
  audioFormatCode?: string;
  audioFormatName?: string;
}

export interface BookingPayload {
  showtimeId: number;
  seatIds: number[];
  /** Stable for retries of the same seat selection. */
  idempotencyKey: string;
}

export interface BookingConfirmation {
  bookingId: string;
  holdId?: string;
  lockedUntil: string;
}

export const bookingApi = {
  getSeatMapByShowtime: async (showtimeId: string | number): Promise<ShowtimeSeatMap> => {
    const res: any = await axiosClient.get(`/api/showtimes/${showtimeId}/seat-map`);
    return res.result || res;
  },

  getSeatsByShowtime: async (showtimeId: string | number): Promise<Seat[]> => {
    const res: any = await axiosClient.get(`/api/showtimes/${showtimeId}/seats`);
    return res.result || res;
  },

  createBooking: async (payload: BookingPayload): Promise<BookingConfirmation> => {
    const { idempotencyKey, ...requestBody } = payload;
    const res: any = await axiosClient.post("/api/bookings", requestBody, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return res.result || res;
  },
};
