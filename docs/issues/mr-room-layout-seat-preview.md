## Overview / Objective

Sau khi employee tạo phòng và admin bấm "Approve" cho layout, trang `RoomDetailPage` vẫn ở lại nhưng **không hiện sơ đồ ghế nào** — chỉ hiện dòng chữ "No seats yet". Sơ đồ chỉ hiện ra sau khi bấm "Activate". Về UX, admin không có cách nào xem lại layout mình vừa duyệt (hoặc sắp activate) mà không phải "tin tưởng mù quáng".

Related: phát hiện trực tiếp từ báo cáo của user khi trao đổi về flow approve → activate của Room.

---

## Changes Introduced

**Components:**
- `RoomDetailPage.tsx`:
  - Thêm state `layoutDetail` + effect fetch `movieApi.getRoomLayout(roomId, layoutId)` khi layout đang `PENDING_APPROVAL`/`APPROVED` (chưa `ACTIVE`) — endpoint này đã tồn tại sẵn (`RoomLayoutController.getById`), chỉ chưa được gọi ở trang này.
  - Khi `seats.length === 0` nhưng `layoutDetail.positions` có dữ liệu: render preview sơ đồ ghế bằng cách tái sử dụng `SeatGrid` (component có sẵn từ wizard tạo phòng) ở chế độ `readOnly`, kèm banner giải thích đây là preview, ghế thật chưa được tạo.
  - Giữ nguyên fallback text cũ cho trường hợp thật sự chưa có gì để xem (layout chưa có `positions` nào).

---

## Key Architectural Decisions

- **Không tạo component render sơ đồ ghế mới.** `SeatGrid` đã hỗ trợ sẵn `readOnly` (dùng bởi `SeatLayoutWorkspace` trong wizard tạo phòng) — tái sử dụng trực tiếp, chỉ cần bọc container CSS giống hệt cách `SeatLayoutWorkspace` đang bọc, tránh trùng lặp logic render.
- **Không đổi bất cứ gì ở backend.** `GET /api/cinema-rooms/{roomId}/layouts/{layoutId}` đã trả về đầy đủ `positions` từ lâu — đây thuần tuý là frontend chưa gọi endpoint này ở trang chi tiết phòng.
- **Không tự động fetch khi layout đã `ACTIVE`.** Lúc đó `seats` (bảng `Seat` thật) đã có dữ liệu rồi, không cần preview từ layout nữa — tránh gọi API thừa.

---

## How to Test

1. `npx tsc --noEmit` — không có lỗi liên quan tới `RoomDetailPage.tsx`/`SeatGrid.tsx` (các lỗi khác trong output là lỗi có sẵn trên `develop`, không liên quan).
2. Thủ công: Employee tạo room mới qua wizard, submit layout → Admin vào `RoomDetailPage`, thấy trạng thái "Pending Approval" → xác nhận **đã thấy được sơ đồ ghế preview** kèm banner xanh giải thích, thay vì "No seats yet".
3. Bấm "Approve" → vẫn ở `APPROVED`, sơ đồ preview vẫn hiện (không biến mất).
4. Bấm "Activate" → sơ đồ chuyển sang hiện ghế thật (từ bảng `Seat`), banner preview biến mất, type summary chips (STANDARD/VIP/...) xuất hiện như trước.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Frontend**
- [x] Loading và error state không đổi (fetch layout detail fail âm thầm fallback về text cũ, không throw lên UI)
- [x] Không đổi hành vi Approve/Reject/Activate — chỉ thêm hiển thị

---

## Reviewer Notes

- Đây là thay đổi thuần UI, không đụng API/DB nào mới — chỉ gọi thêm 1 endpoint GET đã tồn tại sẵn.
- Tái sử dụng `SeatGrid` với `readOnly` — không cần review lại logic render ghế, chỉ cần review phần wiring state/effect mới trong `RoomDetailPage.tsx`.
