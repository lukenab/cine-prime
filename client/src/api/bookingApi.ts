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


const mockState: Record<string, Seat[]> = {};

function getMockSeats(showtimeId: string | number) {
  const sid = String(showtimeId);
  if (!mockState[sid]) {
    const mockSeats: Seat[] = [];
    

    let totalRows = 10;
    if (sid === "1" || sid === "4") totalRows = 5;
    else if (sid === "2" || sid === "5") totalRows = 8;
    
    const rows = Array.from({ length: totalRows }, (_, i) => String.fromCharCode(65 + i));
    const seatsPerRow = 10;
    let idCounter = 1;
    
    for (const row of rows) {
      for (let num = 1; num <= seatsPerRow; num++) { 

        const isVip = row === "C" || row === "D"; 
        
        let status: "AVAILABLE" | "LOCKED" | "BOOKED" = "AVAILABLE";
        const seatCode = `${row}-${num}`;
        

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
    try {
      const res: any = await axiosClient.get(`/api/showtimes/${showtimeId}/seats`);
      return res.result || res;
    } catch (error: any) {
      const isApiMissing = !error.response || error.response.status === 404 || error.response.status >= 500;
      if (error.code === "ERR_NETWORK" || error.message === "Network Error" || isApiMissing) {
        console.warn("🚀 BACKEND UNREACHABLE OR ENDPOINT MISSING: USING STATEFUL MOCK API for getSeatsByShowtime");
        return new Promise((resolve) => {
          setTimeout(() => {
            const seats = JSON.parse(JSON.stringify(getMockSeats(showtimeId)));
            resolve(seats);
          }, 500);
        });
      }
      throw error;
    }
  },
  
  createBooking: async (payload: BookingPayload): Promise<BookingConfirmation> => {
    try {
      const res: any = await axiosClient.post(`/api/bookings`, payload);
      return res.result || res;
    } catch (error: any) {
      const isApiMissing = !error.response || error.response.status === 404 || error.response.status >= 500;
      if (error.code === "ERR_NETWORK" || error.message === "Network Error" || isApiMissing) {
        console.warn("🚀 BACKEND UNREACHABLE OR ENDPOINT MISSING: USING STATEFUL MOCK API for createBooking");
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            const sid = String(payload.showtimeId);
            const seatsInDb = getMockSeats(sid);
            
            const conflicts = seatsInDb.filter(
              s => payload.seatIds.includes(s.seatId) && s.status !== "AVAILABLE"
            );
            
            if (conflicts.length > 0) {
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

            seatsInDb.forEach(s => {
              if (payload.seatIds.includes(s.seatId)) {
                s.status = "BOOKED";
              }
            });

            resolve({
              bookingId: "MOCK-BOOKING-" + Math.floor(Math.random() * 10000),
              lockedUntil: new Date(Date.now() + 10 * 60000).toISOString()
            });
          }, 800);
        });
      }
      throw error;
    }
  }
};
