## Overview / Objective

Tiếp nối phần "cố tình để ngoài phạm vi" của `mr-merge-duplicate-person-records.md`: dọn 192/343 (56%) dòng `person` không được `movie_cast` nào tham chiếu — hệ quả tích lũy của việc tạo/xóa phim trong quá trình dùng/test (xóa phim sẽ cascade xóa cast credit, nhưng `person` được giữ lại vì là dữ liệu dùng chung, không ai dọn phần dư ra).

Related Issue: Dọn person orphan (yêu cầu trực tiếp từ user: "giúp tôi dọn", tiếp nối kết luận ở MR gộp person trùng)

---

## Changes Introduced

**Database / JPA / Migration:**
- `V13__cleanup_unreferenced_person_records.sql` — xóa mọi `person` không có `movie_cast` nào trỏ tới, dùng predicate tổng quát `NOT EXISTS (SELECT 1 FROM movie_cast WHERE person_id = person.person_id)`, không hardcode ID cụ thể nào.

**Controllers / Routes / Services:** Không có.

**Exception Handling / Error Codes:** Không có.

---

## Key Architectural Decisions

- **Predicate tổng quát, không hardcode ID** — khác với `V12` (phải liệt kê đích danh 5 cặp vì cần khớp chính xác 2 dòng nào là cùng 1 người thật), việc "không còn tham chiếu" là 1 điều kiện khách quan, tính toán được ở bất kỳ thời điểm/môi trường nào. An toàn re-run: sau khi orphan bị xóa, `NOT EXISTS` không còn khớp gì, thành no-op.
- **Không cần cân nhắc unique constraint hay FK khác** — đã xác nhận (ở MR trước) chỉ có `movie_cast.person_id` tham chiếu `person`; xóa 1 dòng không còn `movie_cast` nào trỏ tới không thể vi phạm ràng buộc nào.
- **Đây là dọn 1 lần cho hiện trạng, không phải job định kỳ** — nếu muốn tự động dọn định kỳ trong tương lai (vd cron xóa person không dùng quá X ngày), đó sẽ là quyết định/task riêng (cần cân nhắc thêm: có nên giữ lại person có `tmdb_id` lâu hơn vì có thể dùng lại khi import phim mới, tránh gọi lại TMDB API). Không tự ý thêm vì user chỉ yêu cầu dọn hiện trạng.

---

## How to Test

1. `./mvnw.cmd -pl movie-service test -Dtest='!MovieImageRepositoryIntegrationTest'` — 245 test pass (loại trừ lỗi có sẵn không liên quan `MovieImageRepositoryIntegrationTest`, xác nhận riêng vẫn lỗi y hệt như trước MR này, không phải do thay đổi ở đây).
2. Xác nhận dữ liệu dev: `docker exec postgres psql -U postgres -d movie_db -c "SELECT COUNT(*) FROM person p WHERE NOT EXISTS (SELECT 1 FROM movie_cast mc WHERE mc.person_id = p.person_id);"` → 0 (trước MR: 192). Tổng `person`: 343 → 151.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Migration idempotent, đã test trên DB dev thực tế (before/after query)
- [x] Không cần error code mới (thao tác dọn dữ liệu thuần túy)

---

## Reviewer Notes

- File đặt tên `V13` — nối tiếp `V12__merge_duplicate_person_records.sql` (đã merge vào `develop`). `V11` vẫn đang được branch `fix/standardize-genre-names-english` giữ chỗ (chưa merge tại thời điểm viết MR này).
- Nếu review thấy 151 person còn lại vẫn "ít" so với dữ liệu phim hiện có, đó là con số đúng sau khi dọn — 26 phim × trung bình ~6-7 cast/phim khớp với ~151-177 credit hiện có (1 person có thể xuất hiện ở nhiều phim nên person < credit).
