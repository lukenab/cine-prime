## Overview / Objective

Bổ sung hiệu ứng carousel thật (auto-play + vuốt chạm) cho tab Media của `MovieDetailModal` — trước đó chỉ có nút prev/next + dải thumbnail (bấm để chuyển), chưa đúng cảm giác "carousel".

Related Issue: "modal phải hiển thị dạng ảnh có thể lướt qua được (carousel)" (yêu cầu trực tiếp từ user, phần 2 của "chuẩn hóa dữ liệu bảng movie")

---

## Changes Introduced

**Components:**
- `MovieDetailModal.tsx`:
  - Auto-advance ảnh mỗi 4 giây khi đang ở tab Media, dừng khi hover chuột vào, chạy lại khi rời chuột ra — cùng convention với `MoviePreviewModal` (modal phía customer) đã dùng cho backdrop cycling.
  - Vuốt chạm trái/phải (touch swipe) trên mobile để chuyển ảnh — tạm dừng auto-play trong lúc chạm, chạy lại sau khi buông tay.
  - Thêm dải chấm tiến trình (progress dots, bấm để nhảy thẳng đến ảnh) bên cạnh số đếm "X / Y" đã có sẵn — cho cảm giác vị trí trực quan hơn.

**Không có thay đổi API/backend** — MR này thuần frontend.

---

## Key Architectural Decisions

- **Không cần component carousel thư viện ngoài** — chỉ cần `setInterval` + touch event handler, tận dụng state `galleryIdx` đã có sẵn từ MR redesign modal trước đó, giữ bundle nhẹ.
- **Pause khi hover/chạm, không dừng vĩnh viễn khi bấm nút/thumbnail thủ công** — giữ hành vi carousel tự nhiên (giống hầu hết trang web), tránh thêm state "đã dừng vĩnh viễn" không cần thiết.
- **`touchAction: "pan-y"`** trên container ảnh — cho phép cuộn dọc trang bình thường (không chặn scroll của toàn modal), chỉ có touch ngang (swipe trái/phải) mới được component tự xử lý.
- **Reset `carouselPaused` về false khi đổi phim** — cùng chỗ với reset `activeTab`/`galleryIdx` đã có, tránh trạng thái "đang pause" của phim trước lọt sang phim sau.
- **Phụ thuộc trực tiếp vào MR backfill dữ liệu movie** (`fix/backfill-movie-companies-images-and-tmdb-id`) — carousel không có gì để lướt nếu phim chỉ có 1 ảnh; MR đó backfill 7 ảnh/phim cho phần lớn phim hiện có 0-1 ảnh.

---

## How to Test

1. `npx tsc --noEmit` — không lỗi ở `MovieDetailModal.tsx`.
2. `npm test` — 210/211 pass (1 lỗi có sẵn không liên quan, đã xác nhận tồn tại trên `develop` sạch).
3. Thủ công (đã test qua Playwright + app thật): mở "View details" phim "Alien: Romulus" (7 ảnh sau khi backfill) → tab Media → xác nhận:
   - Ảnh tự chuyển sau ~4s.
   - Hover chuột vào ảnh → dừng tự chuyển; rời chuột ra → chạy lại.
   - Vuốt chạm trái/phải (giả lập qua touch event) → chuyển ảnh đúng hướng, số đếm cập nhật đúng.
   - Dải chấm hiển thị đúng vị trí hiện tại, bấm vào 1 chấm → nhảy thẳng đến ảnh đó.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Frontend**
- [x] Tested on both dark and light mode (kế thừa từ MR redesign modal trước, không đổi màu sắc mới)
- [x] Không đổi props/contract public — không cần sửa nơi gọi (`ManageMoviePage.tsx`)

---

## Reviewer Notes

- Nên merge sau (hoặc cùng lúc với) `fix/backfill-movie-companies-images-and-tmdb-id` — carousel hoạt động đúng nhưng không có giá trị hiển thị nếu phim chỉ có 1 ảnh (trạng thái trước khi backfill).
- Không đổi gì ở `MoviePreviewModal.tsx` (modal phía customer) — modal đó đã có logic cycle backdrop riêng từ trước, không cần đồng bộ thêm.
