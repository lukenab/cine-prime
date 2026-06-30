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

// --- MOCK API STATE ---
const mockState: Record<string, Seat[]> = {};

function getMockSeats(showtimeId: string | number) {
  const sid = String(showtimeId);
  if (!mockState[sid]) {
    const mockSeats: Seat[] = [];
    
    // Match database seatQuantity: showtime 1 -> 50 seats, showtime 2 -> 80 seats, default -> 100 seats
    let totalRows = 10; // 100 seats (10x10)
    if (sid === "1" || sid === "4") totalRows = 5; // 50 seats (5x10)
    else if (sid === "2" || sid === "5") totalRows = 8; // 80 seats (8x10)
    
    const rows = Array.from({ length: totalRows }, (_, i) => String.fromCharCode(65 + i)); // A, B, C...
    const seatsPerRow = 10;
    let idCounter = 1;
    
    for (const row of rows) {
      for (let num = 1; num <= seatsPerRow; num++) { 
        // A, B are STANDARD, C, D are VIP
        const isVip = row === "C" || row === "D"; 
        
        let status: "AVAILABLE" | "LOCKED" | "BOOKED" = "AVAILABLE";
        const seatCode = `${row}-${num}`;
        
        // Mock some taken seats for UI testing
        if (["A-5", "A-6", "C-5", "C-6", "E-2"].includes(seatCode)) {
          status = "BOOKED";
        } else if (["D-4", "D-5"].includes(seatCode)) {
          status = "LOCKED";
        }

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
    mockState[sid] = mockSeats;
  }
  return mockState[sid];
}
// ----------------------

export const bookingApi = {
  getSeatsByShowtime: async (showtimeId: string | number): Promise<Seat[]> => {
    console.warn("🚀 USING STATEFUL MOCK API for getSeatsByShowtime");
    return new Promise((resolve) => {
      setTimeout(() => {
        // Deep copy để tránh mutate trực tiếp state
        const seats = JSON.parse(JSON.stringify(getMockSeats(showtimeId)));
        resolve(seats);
      }, 500); // Giả lập độ trễ mạng 500ms
    });
    
    // Code API thật:
    // const response: any = await axiosClient.get(`/api/showtimes/${showtimeId}/seats`);
    // return response?.result ?? response;
  },
  
  createBooking: async (payload: BookingPayload): Promise<BookingConfirmation> => {
    console.warn("🚀 USING STATEFUL MOCK API for createBooking");
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const sid = String(payload.showtimeId);
        const seatsInDb = getMockSeats(sid);
        
        // Kiểm tra xem có ghế nào đang bị chọn nhưng trên DB (mock state) đã bị Booked/Locked không
        const conflicts = seatsInDb.filter(
          s => payload.seatIds.includes(s.seatId) && s.status !== "AVAILABLE"
        );
        
        if (conflicts.length > 0) {
          // Văng lỗi 409 Conflict y hệt Backend thật
          reject({
            response: {
              status: 409,
              data: {
                code: 2005,
                message: "Seats already taken by another user",
                result: { conflictingSeatIds: conflicts.map(s => s.seatId) }
              }
            }
          });
          return;
        }

        // Nếu hợp lệ, cập nhật trạng thái các ghế này thành BOOKED trong Mock State
        seatsInDb.forEach(s => {
          if (payload.seatIds.includes(s.seatId)) {
            s.status = "BOOKED";
          }
        });

        resolve({
          bookingId: "MOCK-BOOKING-" + Math.floor(Math.random() * 10000),
          lockedUntil: new Date(Date.now() + 10 * 60000).toISOString() // Giữ chỗ 10 phút
        });
      }, 800);
    });

    // Code API thật:
    // const response: any = await axiosClient.post("/api/bookings", payload);
    // return response?.result ?? response;
  }
};
