import { ShowtimeResponse, ShowtimeAssignPayload, ShowtimeUpdatePayload, ShowtimeStatus } from './showtimeApi';

// Helper to convert time "HH:MM" to minutes
const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Check if two timeslots overlap
const isOverlapping = (startA: string, endA: string, startB: string, endB: string): boolean => {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);
  return aStart < bEnd && bStart < aEnd;
};

// Initial static seed data
const initialMovies = [
  { movieId: 1, movieNameVn: "Hành Tinh Cát: Phần 2", movieNameEnglish: "Dune: Part Two", duration: 166 },
  { movieId: 2, movieNameVn: "Deadpool & Wolverine", movieNameEnglish: "Deadpool & Wolverine", duration: 127 },
  { movieId: 3, movieNameVn: "Những Mảnh Ghép Cảm Xúc 2", movieNameEnglish: "Inside Out 2", duration: 96 },
  { movieId: 4, movieNameVn: "Furiosa: Câu Chuyện Mad Max", movieNameEnglish: "Furiosa: A Mad Max Saga", duration: 148 }
];

const initialCinemas = [
  { cinemaId: 1, cinemaName: "CinePrime Central", address: "123 Le Loi St, District 1, HCMC" },
  { cinemaId: 2, cinemaName: "CinePrime Plaza", address: "456 Nguyen Trai St, District 5, HCMC" }
];

const initialRooms = [
  { cinemaRoomId: 1, cinemaRoomName: "Cinema 1 (IMAX)", seatQuantity: 120, cinemaId: 1 },
  { cinemaRoomId: 2, cinemaRoomName: "Cinema 2 (3D)", seatQuantity: 80, cinemaId: 1 },
  { cinemaRoomId: 3, cinemaRoomName: "Cinema 3 (Standard)", seatQuantity: 100, cinemaId: 2 },
  { cinemaRoomId: 4, cinemaRoomName: "Cinema 4 (Standard)", seatQuantity: 100, cinemaId: 2 }
];

const initialShowtimes: ShowtimeResponse[] = [
  {
    showtimeId: 1,
    movieId: 1,
    movieName: "Dune: Part Two",
    duration: 166,
    cinemaId: 1,
    cinemaName: "CinePrime Central",
    cinemaRoomId: 1,
    roomName: "Cinema 1 (IMAX)",
    showDate: "2026-06-25",
    startTime: "09:00",
    endTime: "11:46",
    basePrice: 90000,
    status: "SCHEDULED"
  },
  {
    showtimeId: 2,
    movieId: 2,
    movieName: "Deadpool & Wolverine",
    duration: 127,
    cinemaId: 1,
    cinemaName: "CinePrime Central",
    cinemaRoomId: 2,
    roomName: "Cinema 2 (3D)",
    showDate: "2026-06-25",
    startTime: "14:30",
    endTime: "16:37",
    basePrice: 110000,
    status: "ONGOING"
  },
  {
    showtimeId: 3,
    movieId: 3,
    movieName: "Inside Out 2",
    duration: 96,
    cinemaId: 2,
    cinemaName: "CinePrime Plaza",
    cinemaRoomId: 3,
    roomName: "Cinema 3 (Standard)",
    showDate: "2026-06-25",
    startTime: "18:00",
    endTime: "19:36",
    basePrice: 85000,
    status: "SCHEDULED"
  }
];

// Initialize localStorage values if they don't exist
const getStoredData = <T>(key: string, initial: T): T => {
  const val = localStorage.getItem(key);
  if (!val) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(val);
};

const setStoredData = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const getMockMovies = () => getStoredData('mock_movies', initialMovies);
export const getMockCinemas = () => getStoredData('mock_cinemas', initialCinemas);
export const getMockRooms = () => getStoredData('mock_rooms', initialRooms);
export const getMockShowtimes = () => getStoredData('mock_showtimes', initialShowtimes);

// Custom mock response generator simulating axios response
const mockResponse = (data: any, status: number = 200) => {
  return Promise.resolve({
    data,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: {},
    config: {} as any
  });
};

const mockError = (message: string, status: number = 400, code: number = 4000) => {
  const err = new Error(message);
  (err as any).response = {
    status,
    data: {
      code,
      message
    }
  };
  return Promise.reject(err);
};

export const handleMockRequest = (config: any): Promise<any> => {
  const { url, method, data } = config;
  const parsedData = data ? (typeof data === 'string' ? JSON.parse(data) : data) : null;

  // Mock login endpoint
  if (url && url.includes("api/auth/login") && method === 'post') {
    return mockResponse({
      code: 1000,
      result: {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJST0xFX0FETUlOIn0.fakesignature"
      }
    });
  }

  // 1. GET /api/movies
  if (url === '/api/movies' && method === 'get') {
    return mockResponse({
      code: 1000,
      result: getMockMovies()
    });
  }

  // 2. GET /api/cinemas
  if (url === '/api/cinemas' && method === 'get') {
    return mockResponse({
      code: 1000,
      result: getMockCinemas()
    });
  }

  // 3. GET /api/cinemas/{cinemaId}/rooms
  const roomMatch = url?.match(/^\/api\/cinemas\/(\d+)\/rooms$/);
  if (roomMatch && method === 'get') {
    const cinemaId = parseInt(roomMatch[1]);
    const rooms = getMockRooms().filter(r => r.cinemaId === cinemaId);
    return mockResponse({
      code: 1000,
      result: rooms
    });
  }

  // 4. GET /api/showtimes
  if (url === '/api/showtimes' && method === 'get') {
    return mockResponse({
      code: 1000,
      result: getMockShowtimes()
    });
  }

  // 5. POST /api/showtimes/assign
  if (url === '/api/showtimes/assign' && method === 'post') {
    const payload = parsedData as ShowtimeAssignPayload;

    // Validations
    if (!payload.movieId || !payload.cinemaRoomId || !payload.showDate || !payload.startTime || !payload.endTime || !payload.basePrice) {
      return mockError("Missing required fields.");
    }

    if (timeToMinutes(payload.startTime) >= timeToMinutes(payload.endTime)) {
      return mockError("Start time must be before end time.");
    }

    const showtimes = getMockShowtimes();
    const rooms = getMockRooms();
    const movies = getMockMovies();
    const cinemas = getMockCinemas();

    const room = rooms.find(r => r.cinemaRoomId === payload.cinemaRoomId);
    if (!room) return mockError("Cinema room not found.");

    const movie = movies.find(m => m.movieId === payload.movieId);
    if (!movie) return mockError("Movie not found.");

    const cinema = cinemas.find(c => c.cinemaId === room.cinemaId);
    if (!cinema) return mockError("Cinema not found.");

    // Conflict check: Check overlapping timeslots in the same room on the same day
    const conflict = showtimes.find(s =>
      s.cinemaRoomId === payload.cinemaRoomId &&
      s.showDate === payload.showDate &&
      s.status !== 'CANCELLED' && // Ignore cancelled showtimes for scheduling conflicts
      isOverlapping(payload.startTime, payload.endTime, s.startTime, s.endTime)
    );

    if (conflict) {
      return mockError(`Time slot conflict: Room '${room.cinemaRoomName}' already has a scheduled showtime for '${conflict.movieName}' from ${conflict.startTime} to ${conflict.endTime} on this day.`);
    }

    const newShowtimeId = showtimes.length > 0 ? Math.max(...showtimes.map(s => s.showtimeId)) + 1 : 1;
    const newShowtime: ShowtimeResponse = {
      showtimeId: newShowtimeId,
      movieId: payload.movieId,
      movieName: movie.movieNameEnglish,
      duration: movie.duration,
      cinemaId: room.cinemaId,
      cinemaName: cinema.cinemaName,
      cinemaRoomId: payload.cinemaRoomId,
      roomName: room.cinemaRoomName,
      showDate: payload.showDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      basePrice: payload.basePrice,
      status: "SCHEDULED"
    };

    showtimes.unshift(newShowtime); // Add to beginning
    setStoredData('mock_showtimes', showtimes);

    return mockResponse({
      code: 1000,
      message: "Showtime assigned successfully",
      result: newShowtime
    });
  }

  // 6. PUT /api/showtimes/{id}
  const showtimeIdMatch = url?.match(/^\/api\/showtimes\/(\d+)$/);
  if (showtimeIdMatch && method === 'put') {
    const showtimeId = parseInt(showtimeIdMatch[1]);
    const payload = parsedData as ShowtimeUpdatePayload;
    const showtimes = getMockShowtimes();
    const stIdx = showtimes.findIndex(s => s.showtimeId === showtimeId);

    if (stIdx === -1) {
      return mockError("Showtime not found.", 404);
    }

    const currentSt = showtimes[stIdx];
    const updatedSt = { ...currentSt, ...payload };

    // Validations if fields are updated
    if (updatedSt.startTime && updatedSt.endTime && timeToMinutes(updatedSt.startTime) >= timeToMinutes(updatedSt.endTime)) {
      return mockError("Start time must be before end time.");
    }

    const rooms = getMockRooms();
    const movies = getMockMovies();
    const cinemas = getMockCinemas();

    if (payload.movieId) {
      const movie = movies.find(m => m.movieId === payload.movieId);
      if (!movie) return mockError("Movie not found.");
      updatedSt.movieName = movie.movieNameEnglish;
      updatedSt.duration = movie.duration;
    }

    if (payload.cinemaRoomId) {
      const room = rooms.find(r => r.cinemaRoomId === payload.cinemaRoomId);
      if (!room) return mockError("Cinema room not found.");
      updatedSt.roomName = room.cinemaRoomName;
      updatedSt.cinemaId = room.cinemaId;
      const cinema = cinemas.find(c => c.cinemaId === room.cinemaId);
      if (cinema) updatedSt.cinemaName = cinema.cinemaName;
    }

    // Conflict check (exclude self)
    if (updatedSt.status !== 'CANCELLED') {
      const conflict = showtimes.find(s =>
        s.showtimeId !== showtimeId &&
        s.cinemaRoomId === updatedSt.cinemaRoomId &&
        s.showDate === updatedSt.showDate &&
        s.status !== 'CANCELLED' &&
        isOverlapping(updatedSt.startTime, updatedSt.endTime, s.startTime, s.endTime)
      );

      if (conflict) {
        return mockError(`Time slot conflict: Room '${updatedSt.roomName}' already has a scheduled showtime for '${conflict.movieName}' from ${conflict.startTime} to ${conflict.endTime} on this day.`);
      }
    }

    showtimes[stIdx] = updatedSt;
    setStoredData('mock_showtimes', showtimes);

    return mockResponse({
      code: 1000,
      message: "Showtime updated successfully",
      result: updatedSt
    });
  }

  // 7. DELETE /api/showtimes/{id}
  if (showtimeIdMatch && method === 'delete') {
    const showtimeId = parseInt(showtimeIdMatch[1]);
    const showtimes = getMockShowtimes();
    const filtered = showtimes.filter(s => s.showtimeId !== showtimeId);

    if (filtered.length === showtimes.length) {
      return mockError("Showtime not found.", 404);
    }

    setStoredData('mock_showtimes', filtered);

    return mockResponse({
      code: 1000,
      message: "Showtime deleted successfully"
    });
  }

  return Promise.reject(new Error(`Not Found: ${method} ${url}`));
};
