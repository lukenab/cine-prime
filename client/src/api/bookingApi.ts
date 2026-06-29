import axiosClient from "./api";

export interface Seat {
  seatId: number;
  row: string;
  number: number;
  type: "STANDARD" | "VIP";
  status: "AVAILABLE" | "LOCKED" | "BOOKED";
  price: number;
}

export interface BookingPayload {
  showtimeId: number;
  seatIds: number[];
}

export interface BookingConfirmation {
  bookingId: string;
  lockedUntil: string;
}

export const bookingApi = {
  getSeatsByShowtime: async (showtimeId: string | number): Promise<Seat[]> => {
    console.warn("🚀 USING MOCK API for getSeatsByShowtime");
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockSeats: Seat[] = [];
        const rows = ["A", "B", "C", "D", "E"];
        let idCounter = 1;
        
        for (const row of rows) {
          for (let num = 1; num <= 10; num++) {
            const isVip = row === "C" || row === "D"; // Hàng C, D là VIP
            const randomStatus = Math.random();
            let status: "AVAILABLE" | "LOCKED" | "BOOKED" = "AVAILABLE";
            if (randomStatus > 0.9) status = "BOOKED";
            else if (randomStatus > 0.85) status = "LOCKED";

            mockSeats.push({
              seatId: idCounter++,
              row: row,
              number: num,
              type: isVip ? "VIP" : "STANDARD",
              status: status,
              price: isVip ? 100000 : 70000,
            });
          }
        }
        resolve(mockSeats);
      }, 500); // Giả lập độ trễ mạng 500ms
    });
    
    // Code API thật (đã được comment lại):
    // const response: any = await axiosClient.get(`/api/showtimes/${showtimeId}/seats`);
    // return response?.result ?? response;
  },
  createBooking: async (payload: BookingPayload): Promise<BookingConfirmation> => {
    console.warn("🚀 USING MOCK API for createBooking");
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          bookingId: "MOCK-BOOKING-" + Math.floor(Math.random() * 10000),
          lockedUntil: new Date(Date.now() + 10 * 60000).toISOString() // Giữ chỗ 10 phút
        });
      }, 800);
    });

    // Code API thật (đã được comment lại):
    // const response: any = await axiosClient.post("/api/bookings", payload);
    // return response?.result ?? response;
  }
};
