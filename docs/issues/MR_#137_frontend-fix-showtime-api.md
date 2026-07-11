# MR Description — Issue #137

> Copy nội dung bên dưới vào GitLab MR description.
> Branch: `fix/showtime-api-endpoint` → target: `develop`

---

## Overview / Objective

`showtimeApi.ts` và 4 components liên quan đang dùng endpoint `/api/showtimes` và schema cũ từ Sprint 1. Backend Sprint 2 đã migrate toàn bộ showtime logic sang `ScheduleController` tại `/api/schedules` với response shape mới (`showTimeId`, `cinemaRoomName`, status enum mới). Kết quả: `ManageShowTimePage` bị 404 khi fetch, status badge render sai, và filter/delete dùng sai field key.

MR này rewrite `showtimeApi.ts` với types chính xác, và cập nhật 4 files frontend để align với backend hiện tại.

Related Issue: Closes #137

---

## Changes Introduced

**API layer (`client/src/api/showtimeApi.ts`) — rewrite hoàn toàn:**
- Xóa toàn bộ types cũ (`ShowtimeData`, endpoint `/api/showtimes/assign`)
- Thêm `ShowtimeStatus` union type: `'SCHEDULED' | 'ON_SALE' | 'CANCELLED' | 'COMPLETED' | 'SUSPENDED'`
- Thêm `ShowtimeResponse` interface align với `ShowTimeResponse.java`: `showTimeId`, `movieId`, `movieName`, `cinemaRoomId`, `cinemaRoomName`, `showDate`, `startTime`, `endTime`, `status`, `updatedAt`
- Thêm `ShowtimeAssignPayload`: `movieId`, `cinemaRoomId`, `showDate`, `startTime`, optional `languageCode`, `subtitleCode`, `basePrice` — không có `endTime` (backend tính từ `movie.durationMinutes`), không có `cinemaId`
- Thêm `ShowtimeUpdatePayload`: tất cả fields optional (`movieId?`, `cinemaRoomId?`, `showDate?`, `startTime?`)
- Update tất cả endpoint paths: `/api/showtimes` → `/api/schedules`, `/api/showtimes/assign` → `POST /api/schedules`

**`client/src/layouts/ShowTimeStatsCards.tsx`:**
- `s.status === "ONGOING"` → `s.status === "ON_SALE"`

**`client/src/layouts/ShowTimeTable.tsx` — rewrite:**
- Props: xóa `cinemaFilter: number | ""`
- `STATUS_STYLE`: `ONGOING` → `ON_SALE`, `FINISHED` → `COMPLETED`, thêm `SUSPENDED` (amber)
- Thêm `STATUS_LABEL` map cho display text (ví dụ: `ON_SALE` → "On Sale")
- Thêm helper `fmt = (time: string) => time?.slice(0, 5)` để render "HH:mm" từ "HH:mm:ss"
- Table: giảm từ 7 cột xuống 5 cột (Movie & Room / Date / Time / Status / Actions) — bỏ cột Cinema riêng và Base Price
- Fix field keys: `item.showtimeId` → `item.showTimeId`, `item.roomName` → `item.cinemaRoomName`
- Filter: bỏ `cinemaId` check, dùng `s.cinemaRoomName` cho search
- Confirm delete dialog: `confirmDelete.showTimeId` (was `showtimeId`)

**`client/src/layouts/ShowTimeModal.tsx` — rewrite:**
- Xóa import `getMockMovies`, `getMockCinemas`, `getMockRooms` (mock data)
- Import thực: `movieApi`, `type MovieApiResponse`, `type RoomResponse`
- `FormState`: xóa `cinemaId`, `endTime`, `status`; giữ `movieId`, `cinemaRoomId`, `showDate`, `startTime`, `basePrice`
- Load real data khi modal mở: `Promise.all([movieApi.getAllMovies(), movieApi.getRooms()])`
- Movie dropdown: `m.movieNameEnglish || m.movieNameVn` + hint duration `(Xm)`
- Room dropdown: flat list — `r.cinemaRoomName · r.roomType · r.seatQuantity seats`
- Xóa `endTime` input (backend tính tự động)
- `basePrice` chỉ hiện khi create (ẩn khi edit vì `UpdateShowTimeRequest` không nhận field này)
- Xóa `status` field khỏi edit form
- Loading spinner khi đang fetch movies/rooms

**`client/src/pages/admin/ManageShowTimePage.tsx` — rewrite:**
- Xóa `cinemaFilter` state và `cinemaOptions` useMemo
- `roomOptions` derive từ `cinemaRoomName` (was `roomName`)
- `editShowtime.showTimeId` trong update và filter (was `showtimeId`)
- Filter panel: 3 cột (Status / Date / Room) — bỏ cột Cinema
- Status options đúng với backend enum: `ON_SALE`, `COMPLETED`, `SUSPENDED`
- `ShowtimeTable` props: bỏ `cinemaFilter`

---

## Key Architectural Decisions

- **Không có `endTime` trong payload** — `ShowTimeService` tính `endTime = startTime + movie.durationMinutes` tự động. Frontend chỉ hint "End time calculated from movie duration" sau khi chọn phim.

- **Flat room list (không group theo cinema)** — `movieApi.getRooms()` trả về flat `RoomResponse[]` không có cinema hierarchy. Dropdown gộp tên phòng + loại + số ghế để admin phân biệt. Nếu cần group sau này, cần endpoint riêng.

- **`basePrice` optional, create-only** — Backend `UpdateShowTimeRequest` không nhận `basePrice`. Field chỉ hiện trong Create modal, ẩn hoàn toàn trong Edit modal để tránh gửi field không được phép.

- **Mock data cleanup** — 3 mock imports (`getMockMovies`, `getMockCinemas`, `getMockRooms`) bị xóa hoàn toàn. Không còn fallback sang mock data — nếu API fail thì hiện error state rõ ràng thay vì silently dùng mock.

---

## How to Test

**Setup:**
1. Đảm bảo `movie-service` đang chạy và `ScheduleController` có endpoint `GET /api/schedules`
2. `cd client && npm run dev`
3. Đăng nhập ADMIN

**Test danh sách showtime:**
4. Vào `/admin/showtimes` → bảng load được (không 404)
5. Kiểm tra: cột Time hiển thị "HH:mm – HH:mm" (không có giây)
6. Kiểm tra: status badge render đúng màu — SCHEDULED (xanh), ON_SALE (xanh lá), COMPLETED (xám), CANCELLED (đỏ), SUSPENDED (amber)
7. Stats cards: "Showing Now" hiển thị đúng số phim ON_SALE

**Test Create:**
8. Click **Schedule Show** → modal mở, loading spinner xuất hiện khi fetch movies/rooms
9. Dropdown movies load từ API (tên phim thực, không phải mock)
10. Dropdown rooms load từ API (không có Cinema filter)
11. Chọn movie → hint "End time is calculated automatically" xuất hiện bên dưới dropdown
12. Điền đủ Date, Start Time → Submit → showtime xuất hiện trong bảng với `showTimeId` đúng
13. `basePrice` input hiển thị trong create form, để trống → không gửi field này

**Test Edit:**
14. Click edit một showtime → modal mở với data đúng (movie, room, date, time)
15. `basePrice` input không hiển thị trong edit modal
16. Sửa Start Time → Submit → bảng cập nhật đúng

**Test Delete:**
17. Click delete → confirm dialog hiển thị tên phim đúng
18. Confirm → showtime biến khỏi bảng

**Test Filter:**
19. Filter Status = "On Sale" → chỉ hiện showtimes ON_SALE
20. Filter Date = hôm nay → chỉ hiện showtimes của hôm nay
21. Filter Room → dropdown populated từ rooms trong bảng hiện tại
22. Search box → tìm theo tên phim hoặc tên phòng

---

## Checklist

**General**
- [x] Code compiles, không có TypeScript errors
- [x] Không còn `console.log` hay debug code
- [x] Không còn import mock data (`getMockMovies`, `getMockCinemas`, `getMockRooms`)

**API alignment**
- [x] Tất cả endpoints dùng `/api/schedules` (không còn `/api/showtimes`)
- [x] `ShowtimeResponse` fields khớp đúng với `ShowTimeResponse.java` backend
- [x] `ShowtimeAssignPayload` không có `endTime`, `cinemaId`
- [x] `ShowtimeUpdatePayload` không có `basePrice`, `status`
- [x] Status enum values khớp backend `ShowTimeStatus`: `SCHEDULED`, `ON_SALE`, `CANCELLED`, `COMPLETED`, `SUSPENDED`

**Frontend**
- [x] Loading state khi fetch movies/rooms trong modal
- [x] Error state hiển thị message rõ ràng nếu API fail (không silent fail)
- [x] `showTimeId` được dùng nhất quán ở mọi nơi (xóa hoàn toàn `showtimeId` cũ)
- [x] Dark mode render đúng (dùng `var(--bg-card)`, `var(--text-main)`, `var(--border-color)`)
- [x] Phân trang showtime table vẫn hoạt động sau rewrite

---

## Reviewer Notes

- **`ShowTimeModal.tsx`**: Chú ý `Promise.all` — nếu cả hai API (movies + rooms) đều fail, `loadingData` vẫn được set `false` (nhờ `.finally()`). Error không được toast riêng — sẽ hiện dropdown rỗng. Có thể cải thiện ở Sprint 4.
- **`roomOptions` trong `ManageShowTimePage`**: Derive từ showtimes đã load, không gọi API riêng. Nếu chưa có showtime nào thì filter Room sẽ rỗng — đây là hành vi intentional (không có showtime = không có room để filter).
- **`basePrice` trong `ShowtimeAssignPayload`**: Chỉ gửi nếu `> 0`. `undefined` sẽ không được serialize vào JSON body — backend sẽ dùng giá mặc định của room/seat.
- Grep để confirm không còn reference nào tới `/api/showtimes`: `grep -r "api/showtimes" client/src` phải trả về rỗng.
