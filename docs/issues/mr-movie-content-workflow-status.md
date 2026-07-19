## Overview / Objective

Hoàn thiện issue `[Frontend] Normalize Movie Management to content workflow statuses`. Trang Movie Management (tabs trạng thái, badge, action) đã được chuẩn hóa đúng 5 content-review status (`DRAFT`, `PENDING_REVIEW`, `APPROVED`, `CHANGES_REQUESTED`, `ARCHIVED`) từ trước, nhưng hàm compatibility adapter `toMovieContentStatus()` có một lỗi thực sự: khi gặp status "lạ" (các giá trị exhibition cũ như `COMING_SOON`/`NOW_SHOWING`/`SUSPENDED`/`REJECTED`/`ENDED`), hàm này lại fallback im lặng về `DRAFT` thay vì map về giá trị canonical gần nhất như AC yêu cầu.

MR này sửa đúng bảng mapping compatibility, thêm test cho từng trường hợp, và tự xác nhận 2 flow chuyển trạng thái còn thiếu trong AC bằng cách chạy thật `movie-service` và gọi API trực tiếp.

Related Issue: Closes `[Frontend] Normalize Movie Management to content workflow statuses`
Depends on: không có

---

## Changes Introduced

**Controllers / Routes:**
- Không đổi — không chạm backend.

**Services / Logic:**
- Không đổi.

**DTOs / Mappers / Components:**
- `client/src/utils/movieContentStatus.ts` — sửa `toMovieContentStatus()`:
  - `COMING_SOON` / `NOW_SHOWING` / `SUSPENDED` → `APPROVED` (đây là các khái niệm exhibition-only, nội dung phía sau các trạng thái này vốn đã được duyệt).
  - `REJECTED` (cơ chế reject 1 bước cũ) → `CHANGES_REQUESTED` (giá trị canonical gần nhất — phim quay lại cho operator sửa).
  - `ENDED` → `ARCHIVED` (backend cũ dùng chung `ENDED` cho cả "hết suất chiếu" lẫn soft-delete; đây chỉ là mapping tạm, MOV-LC-05 phải phân loại đúng ở tầng dữ liệu).
  - Chỉ giá trị thực sự thiếu/không xác định (`undefined`, chuỗi lạ khác) mới fallback về `DRAFT`.

**Database / JPA / Migration:**
- Không có.

**Exception Handling / Error Codes:**
- Không có.

---

## Key Architectural Decisions

- **Sửa đúng compatibility adapter, không mở rộng phạm vi.** MR chỉ sửa hàm mapping — không đụng vào status tabs/badge/action đã đúng chuẩn từ trước, đúng tinh thần "Technical Notes" của issue (mapping tạm, sẽ xóa sau MOV-LC-08).
- **`ENDED → ARCHIVED` giữ nguyên là mapping tạm, không phải mô hình canonical** — đúng như issue đã ghi chú, không tự ý "sửa đúng" luôn vì việc phân loại lại thuộc phạm vi MOV-LC-05.

---

## How to Test

1. `npm test` (client) — bao gồm test mới `movieContentStatus.test.ts` (5 case: 5 giá trị canonical giữ nguyên, 3 giá trị legacy exhibition map đúng về `APPROVED`, `REJECTED` map về `CHANGES_REQUESTED`, `ENDED` map về `ARCHIVED`, giá trị thiếu/lạ fallback về `DRAFT`). Kết quả: toàn bộ 175 test của client đều pass.
2. `npm run build` — thành công.
3. Thủ công (đã tự thực hiện trong phiên làm việc này, chạy thật `movie-service` + lấy token admin qua `/api/auth/login` + gọi trực tiếp các endpoint):
   - Tạo movie mới (`DRAFT`) → `POST /{id}/submit` → xác nhận `status=PENDING_REVIEW`.
   - Bổ sung `ageRatingId`/`posterUrl`/`synopsis`/`translations` hợp lệ (readiness gate có sẵn yêu cầu) → `POST /{id}/approve` → xác nhận `status=APPROVED`.
   - Với một movie khác đang `PENDING_REVIEW` (age rating `C` — bị chặn public release), gọi `POST /{id}/request-changes` → xác nhận `status=CHANGES_REQUESTED` → gọi `POST /{id}/start-revision` → xác nhận quay lại `status=DRAFT`.
   - Cả 2 flow AC yêu cầu ("Draft → Pending Review → Approved" và "Pending Review → Changes Requested → Draft") đều xác nhận hoạt động đúng với backend thật.
4. Browser QA dark/light mode cho status tabs/badge — **chưa thực hiện trong phiên này** (không đổi UI ở MR này, chỉ đổi logic mapping), nhưng nếu muốn re-verify UI thì phần tabs/badge vốn không thay đổi trong MR này.

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (`npm run build` thành công)

**Backend**
- Không áp dụng — MR này không chạm backend.

**Frontend**
- [x] Có test cho logic mới/sửa (`movieContentStatus.test.ts`)
- [x] `npm run build` thành công
- [x] Đã xác nhận 2 luồng lifecycle bằng backend thật (Draft→Pending→Approved, Pending→Changes Requested→Draft)
- [ ] Browser QA dark/light mode cho status tabs/badge — không cần thiết cho riêng MR này vì UI không đổi, nhưng nếu team muốn double-check UI tổng thể thì vẫn nên làm

---

## Reviewer Notes

- Đây là bản sửa lỗi rất nhỏ, tách riêng khỏi phần lớn công việc chuẩn hóa Movie Management (đã hoàn thành từ trước) — chỉ 1 file logic + 1 file test.
- `ENDED → ARCHIVED` là mapping tạm có chủ đích (đã ghi rõ trong comment) — không phải tín hiệu để tự ý coi 2 khái niệm này là một, tránh nhầm lẫn khi làm MOV-LC-05.
- Nếu backend hiện tại KHÔNG BAO GIỜ còn trả các giá trị legacy này nữa (đã xác nhận `Movie.status` enum chỉ còn 5 giá trị canonical), thay đổi này về bản chất là phòng thủ cho dữ liệu cũ/cache cũ hơn là một bug đang thực sự xảy ra hàng ngày — nhưng vẫn đúng theo AC đã viết và là hành vi đúng nếu gặp phải.
