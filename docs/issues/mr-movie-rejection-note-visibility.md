## Overview / Objective

Phát hiện trong `docs/testing/MOVIE_CREATION_FLOW_TEST_SPEC.md` (Gap #2, mức P0): `Movie.rejectionNote` được set khi ADMIN "Request Changes" (`PENDING_REVIEW → CHANGES_REQUESTED`) nhưng **không bao giờ** được trả về hoặc hiển thị ở đâu — `MovieResponse` DTO không có field này, `MovieMapper` không map, và không UI nào (kể cả `PendingReviewModal`, `ManageMoviePage`) đọc/hiển thị nó. EMPLOYEE thấy badge "Changes Requested" nhưng không biết lý do phải sửa gì.

So sánh: Cinema Cluster đã có đúng pattern này từ trước (`cluster.rejectionNote` được hiển thị trong `ClusterDetailPage`/`ClusterReviewModal`) — Movie chỉ đơn giản là chưa được làm theo.

Related: phát hiện trong lúc viết `docs/testing/MOVIE_CREATION_FLOW_TEST_SPEC.md`.

---

## Changes Introduced

**Controllers / Routes:**
- Không đổi.

**Services / Logic:**
- Không đổi — `MovieService.requestChanges()` đã set `movie.setRejectionNote(note)` từ trước, chỉ là DTO không expose nó ra.

**DTOs / Mappers / Components:**
- `MovieResponse.java` — thêm field `rejectionNote`. MapStruct tự map theo tên field khớp entity, không cần sửa `MovieMapper.java`.
- `client/src/api/movieApi.ts` — thêm `rejectionNote?: string` vào type `MovieResponse` (frontend).
- `client/src/layouts/MovieDetailModal.tsx` — thêm 1 panel hiển thị `rejectionNote` (nền đỏ nhạt, giống cảnh báo) ngay khi `contentStatus === "CHANGES_REQUESTED"` và có note, đặt ngay dưới title block — theo đúng vị trí/pattern `ClusterDetailPage` đã dùng cho cluster.

**Database / JPA / Migration:**
- Không có — cột `movie.rejection_note` đã tồn tại từ `V1__baseline_schema.sql`.

**Exception Handling / Error Codes:**
- Không có thay đổi.

---

## API contract

| Trước MR | Sau MR |
|---|---|
| `GET /api/movies/{id}`, mọi response `MovieResponse` khác không có `rejectionNote` | `MovieResponse` có thêm field `rejectionNote?: string` (null nếu chưa từng bị request-changes) |

---

## Key Architectural Decisions

- **Không cần migration hay sửa service** — dữ liệu đã được ghi đúng từ trước, đây thuần tuý là gap ở tầng "expose ra ngoài", không phải gap ở tầng ghi dữ liệu.
- **Theo đúng pattern đã có ở Cinema Cluster** thay vì tự nghĩ ra cách hiển thị mới — nhất quán UX giữa 2 luồng review tương tự nhau trong cùng hệ thống.
- **Không xoá `rejectionNote` khi `start-revision`** — giữ nguyên hành vi hiện tại (note cũ vẫn còn nếu nhìn lại sau khi đã resubmit); đây là hành vi đã tồn tại từ trước, không thuộc phạm vi MR nhỏ này, không thay đổi để tránh mở rộng phạm vi ngoài ý định ban đầu.

---

## How to Test

1. Backend: `./mvnw.cmd -pl movie-service test -q` — 239 test chạy, 0 failure liên quan tới thay đổi này (1 lỗi tiền tồn tại không liên quan, `MovieImageRepositoryIntegrationTest`, xác nhận xảy ra giống hệt trên baseline trước đó).
2. Frontend: `npx tsc --noEmit` sạch; `npx vitest run --pool=forks` — 202/202 pass.
3. Thủ công: EMPLOYEE tạo + submit 1 movie → ADMIN "Reject" với 1 note cụ thể → EMPLOYEE mở "View" (`MovieDetailModal`) trên movie đó → xác nhận thấy đúng note vừa nhập, hiển thị trong khung đỏ ngay dưới tiêu đề phim.

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (Maven + `tsc --noEmit`)

**Backend**
- [x] Không cần migration (cột đã tồn tại)
- [x] MapStruct tự map, đã xác nhận compile thành công

**Frontend**
- [x] `tsc --noEmit` sạch
- [x] `npx vitest run --pool=forks` — 202/202 pass
- [ ] Chưa test thủ công trên cả dark mode và light mode trong phiên này

---

## Reviewer Notes

- **Branch này cũng mang theo 1 thay đổi khác đang dở dang trong working tree khi bắt đầu** (không phải do MR này tạo ra): rename `MovieV2 → MovieResponse`, `createMovieV2/updateMovieV2 → createMovie/updateMovie` xuyên suốt frontend (`movieApi.ts` và các trang dùng nó) — đã có sẵn trong working tree trước khi bắt đầu MR này, được giữ nguyên và commit cùng vì đụng chung file. Không phải rủi ro mới do MR này gây ra.
- MR nhỏ, rủi ro thấp — chỉ thêm field đọc, không đổi luồng ghi dữ liệu nào.
