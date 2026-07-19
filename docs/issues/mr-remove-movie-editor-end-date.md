## Overview / Objective

Hoàn thiện issue `[Frontend] Remove exhibition end date from Movie Editor`. `endDate` là quyết định thuộc exhibition/scheduling lifecycle (mở/tạm ngưng/kết thúc lịch khai thác phim theo từng cụm rạp), không phải core content metadata — nhưng trước MR này, `MovieEditorPage` vẫn cho phép sửa `endDate` chung với title/synopsis/cast, khiến content operator có thể vô tình kết thúc lịch khai thác chỉ vì đang sửa nội dung phim.

MR này gỡ hẳn field này khỏi Movie Editor (cả UI lẫn payload), giữ nguyên cột DB và toàn bộ scheduler/availability UI hiện có, đúng theo Technical Notes của issue.

Related Issue: Closes `[Frontend] Remove exhibition end date from Movie Editor`
Depends on: `#173` (di chuyển exhibition window sang availability/showtime workflow — MR này không tự làm #173, chỉ dọn phần Movie Editor)

---

## Changes Introduced

**Controllers / Routes:**
- Không đổi — MR này không chạm backend.

**Services / Logic:**
- Không đổi.

**DTOs / Mappers / Components:**
- `MovieEditorPage.tsx` — gỡ `endDate` khỏi `FormState`, `emptyForm`, `movieToForm()`, và ô input "End Date" trong JSX. Label "Release Date" được làm rõ nghĩa hơn: *"theatrical release — content metadata, not an exhibition window"*.
- **Tách `buildPayload` (vốn nằm inline trong component) thành `movieEditor/buildMoviePayload.ts`** — hàm pure, không còn field `endDate` nào cả (không phải `undefined`, không phải bỏ qua có điều kiện — hàm không có field này trong object trả về), theo đúng convention đã có trong thư mục `movieEditor/` (nơi các phần logic của editor đang được tách thành module riêng, độc lập test được).

**Database / JPA / Migration:**
- Không có — cột `movie.end_date` được giữ nguyên, đúng Technical Notes ("Không xóa cột database trong issue frontend này").

**Exception Handling / Error Codes:**
- Không có thay đổi.

---

## API contract

Không có contract mới. Hành vi payload thay đổi:

| Trước MR | Sau MR |
|---|---|
| `POST/PUT /api/movies` từ Movie Editor gửi `endDate: sourceForm.endDate \|\| undefined` (có thể có giá trị hoặc `undefined` tuỳ form) | Payload **không có key `endDate`** dưới bất kỳ hình thức nào |

Vì đây là partial-update contract (field vắng mặt = giữ nguyên giá trị hiện có ở backend, xem `docs/MOVIE_SERVICE_BUSINESS_RULES.md` MOV-P1-009 mới thêm), việc omit hẳn field thay vì gửi `undefined`/`null` đảm bảo sửa bất kỳ field nào khác trong Movie Editor không bao giờ xoá `end_date` đã được set qua availability/showtime workflow.

---

## Key Architectural Decisions

- **Tách `buildPayload` thành module pure, test được, thay vì chỉ xoá 1 dòng.** Function này vốn đã pure về bản chất (chỉ nhận `sourceForm`/`resolvedCompanyIds`/`resolvedCast` làm tham số, không đọc closure ngoài `form` mặc định) — tách ra `movieEditor/buildMoviePayload.ts` cho phép viết test khẳng định trực tiếp "payload không bao giờ chứa `endDate`" (đúng AC "Tests xác nhận payload không chứa endDate") mà không cần render toàn bộ component nặng nề. Cũng khớp với hướng tách module đã có sẵn trong thư mục `movieEditor/` (`MovieEditorActionBar`, `MovieEditorWorkflow`, `movieDraftActions`).
- **Omit hẳn field, không gửi `undefined`/`null`.** Đúng Technical Notes "Không gửi endDate: null; phải omit field khỏi partial update payload" — `buildMoviePayload()` không có dòng nào gán `endDate` cả, nên không có cách nào vô tình gửi lại field này trong tương lai khi code được sửa tiếp.
- **`releaseDate` giữ nguyên, chỉ làm rõ label.** Đúng AC "releaseDate vẫn được giữ như theatrical/content metadata và có label rõ nghĩa" — không đổi hành vi, chỉ thêm chú thích ngắn cạnh label để tránh nhầm với khái niệm "exhibition window" vừa bị gỡ khỏi form.
- **Không đụng `MovieTable.tsx` (hiển thị read-only "ends {date}") hay bất kỳ scheduler/availability UI nào** — đúng AC "Scheduler/availability UI hiện hữu không bị thay đổi trong issue này". Đã rà soát toàn bộ codebase xác nhận đây là nơi duy nhất khác dùng `endDate` ở frontend, và nó chỉ đọc/hiển thị, không sửa.
- **Cập nhật `docs/MOVIE_SERVICE_BUSINESS_RULES.md`** — thêm rule mới `MOV-P1-009` ghi rõ ai chịu trách nhiệm quản lý exhibition window, đúng AC "API/Postman documentation ghi rõ nơi chịu trách nhiệm quản lý exhibition window" (không có Postman collection trong repo để cập nhật, nên tài liệu này — đã được issue tự trỏ tới ở mục Docs — là nơi phù hợp nhất).

---

## How to Test

1. `npm test` (client, khuyến nghị chạy với `--pool=forks` — pool `threads` mặc định hiện đang lỗi môi trường Windows không liên quan gì tới MR này, ảnh hưởng cả các test file khác như `ConfirmDialog.test.tsx`) — bao gồm test mới `buildMoviePayload.test.ts` (4 case): payload không bao giờ chứa `endDate` (kiểm tra cả bằng `toHaveProperty` lẫn `JSON.stringify` không chứa chuỗi `"endDate"`), `releaseDate` vẫn được gửi đúng, `releaseDate` rỗng thì omit thay vì gửi chuỗi rỗng, translations/genres/formats/companies/cast vẫn hoạt động như cũ. Kết quả: 202/202 pass.
2. `npm run build` và `tsc --noEmit` — sạch.
3. Thủ công: mở trang Add/Edit Movie → xác nhận không còn thấy field "End Date" ở đâu trong form → tạo/sửa 1 phim → xác nhận request thực tế (Network tab) không có key `endDate` trong body.
4. Thủ công: với 1 phim đã có `endDate` set sẵn ở backend (qua availability workflow hoặc set tay trong DB) → sửa 1 field bất kỳ khác (ví dụ Synopsis) qua Movie Editor và Save → gọi lại `GET /api/movies/{id}` → xác nhận `endDate` vẫn giữ nguyên giá trị cũ, không bị xoá.

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (`tsc` + `npm run build`)

**Backend**
- Không áp dụng — MR này không chạm backend.

**Frontend**
- [x] Có test cho logic mới/tách ra (`buildMoviePayload.test.ts`), khẳng định trực tiếp payload không chứa `endDate`
- [x] `npm run build` thành công
- [ ] Chưa test thủ công bước 4 (xác nhận sửa field khác không ghi đè `endDate` ở backend) bằng dữ liệu thật trong phiên này — chỉ xác nhận ở tầng payload-builder qua unit test
- [ ] Chưa test thủ công trên cả dark mode và light mode trong phiên này

---

## Reviewer Notes

- **`MovieEditorWorkflow.tsx` có 1 thay đổi nhỏ khác đang dở dang trong working tree (không thuộc MR này)** — đã kiểm tra kỹ và KHÔNG đưa vào commit của MR này, tránh lẫn lộn với công việc khác đang làm song song (sticky actions).
- **`movie.end_date` cột DB vẫn còn nguyên** — cố ý, đúng constraint của issue. Việc migrate/xoá cột (nếu team quyết định) thuộc phạm vi `#173`, không phải MR này.
- File `docs/MOVIE_SERVICE_BUSINESS_RULES.md` có một số nội dung mô tả lifecycle cũ (`COMING_SOON`/`NOW_SHOWING`/`REJECTED`/`SUSPENDED`/`ENDED`) khác với 5 trạng thái canonical hiện tại (`DRAFT`/`PENDING_REVIEW`/`APPROVED`/`CHANGES_REQUESTED`/`ARCHIVED`) — đây là tài liệu có sẵn từ trước, MR này chỉ thêm 1 rule mới (`MOV-P1-009`), không sửa các phần cũ không liên quan (ngoài phạm vi S-sized issue này).
