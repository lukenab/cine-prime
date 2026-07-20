## Overview / Objective

Phát hiện phụ trong lúc audit bảng `movie` cho cột chết (xem `docs/issues/mr-drop-legacy-movie-columns.md`): `client/src/api/movieApi.ts` có `createMovie`/`updateMovie` — 2 hàm API dùng type `CreateMoviePayload`/`UpdateMoviePayload` (và `ShowTimePayload` mà `CreateMoviePayload` phụ thuộc) — nhưng **không có component nào gọi 2 hàm này**. `MovieEditorPage.tsx` (trang Add/Edit Movie thật sự đang dùng) gọi `movieApi.createMovieV2`/`movieApi.updateMovieV2` với type `CreateMovieRequest`/`UpdateMovieRequest` từ lâu.

Đây là dead code còn sót lại từ trước khi Movie Editor chuyển sang contract V2 (dùng translations/cast/companies chuẩn hoá thay vì field phẳng kiểu `movieNameVn`/`director`/`actor`).

MR này xoá dứt điểm `createMovie`, `updateMovie`, và 3 type chỉ được dùng bởi chúng.

Related: phát hiện trong lúc làm `[Backend] Kiểm tra cột movie không dùng` (branch `fix/drop-legacy-movie-columns`) — độc lập hoàn toàn, không phụ thuộc MR đó.

---

## Changes Introduced

**Controllers / Routes / Services / DTOs / Mappers:**
- Không đổi — MR này không chạm backend.

**Components:**
- `client/src/api/movieApi.ts`:
  - Xoá type `ShowTimePayload`, `CreateMoviePayload`, `UpdateMoviePayload`.
  - Xoá hàm `createMovie(payload: CreateMoviePayload)` và `updateMovie(id, payload: UpdateMoviePayload)`.
  - `createMovieV2`/`updateMovieV2` (đang được `MovieEditorPage.tsx` dùng thật) giữ nguyên, không đổi.

**Database / JPA / Migration:**
- Không có.

**Exception Handling / Error Codes:**
- Không có thay đổi.

---

## API contract

Không có thay đổi contract thật — 2 hàm bị xoá chưa từng được gọi nên chưa từng gửi request nào lên backend.

---

## Key Architectural Decisions

- **Xác nhận dead code bằng cách grep toàn bộ lời gọi**, không chỉ dựa vào tên type trùng với cột DB cũ: `grep "\.createMovie(\|\.updateMovie("` trên toàn `client/src` không ra kết quả nào, trong khi `movieApi.createMovieV2`/`updateMovieV2` được gọi trực tiếp trong `MovieEditorPage.tsx` (dòng ~522-523).
- **Không đụng `createMovieV2`/`updateMovieV2`/`CreateMovieRequest`/`UpdateMovieRequest`** — đây là contract đang hoạt động thật, ngoài phạm vi MR này.
- **Xoá luôn `ShowTimePayload`** vì nó chỉ được `CreateMoviePayload` tham chiếu (dùng cho field `showTimes` không còn ai gửi) — không còn nơi nào khác dùng.

---

## How to Test

1. `npx tsc --noEmit` — sạch, không lỗi liên quan `movieApi.ts`.
2. `npx vitest run --pool=forks` — 198/198 pass (dùng `--pool=forks` vì pool `threads` mặc định lỗi môi trường Windows, không liên quan MR này).
3. Thủ công: mở Add/Edit Movie, tạo/sửa 1 phim bình thường — xác nhận không có regression (vì trang này chưa bao giờ gọi 2 hàm bị xoá).

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (`tsc --noEmit`)

**Backend**
- Không áp dụng.

**Frontend**
- [x] `tsc --noEmit` sạch
- [x] `npx vitest run --pool=forks` — 198/198 pass

---

## Reviewer Notes

- MR nhỏ, chỉ xoá code chết, không có rủi ro hành vi vì 2 hàm bị xoá chưa từng được gọi.
- Độc lập với `fix/drop-legacy-movie-columns` và `fix/drop-movie-end-date-column` — không có phụ thuộc thứ tự merge.
