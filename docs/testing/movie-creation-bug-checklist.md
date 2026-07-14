# Checklist bug cần sửa - luồng Movie

> Snapshot: 2026-07-14  
> Phạm vi: tạo, sửa, submit, duyệt và public visibility của Movie.  
> Trạng thái dưới đây được xác nhận từ source hiện tại; chưa tự động thay đổi database khi lập checklist.

## P0 - Sửa trước khi demo luồng hoàn chỉnh

- [ ] **MOV-BUG-01 - Partial update ghi đè field không gửi thành `null`.**
  - Hiện trạng: `UpdateMovieRequest` là partial nhưng MapStruct update chưa dùng `NullValuePropertyMappingStrategy.IGNORE`.
  - Rủi ro: request chỉ sửa poster có thể làm mất title, language, duration hoặc metadata khác.
  - Done: field không xuất hiện trong request phải giữ nguyên; thêm unit test partial update.

- [ ] **MOV-BUG-02 - Movie thiếu dữ liệu vẫn submit/approve được.**
  - Hiện trạng: `submitForReview()` và `approveMovie()` chỉ kiểm tra status.
  - Done: minimal draft vẫn tạo được, nhưng submit phải trả `400` kèm danh sách field còn thiếu; approve/release cũng kiểm tra readiness.

- [ ] **MOV-BUG-03 - Public đọc được Movie chưa publish.**
  - Hiện trạng: toàn bộ `GET /api/movies/**` được permit; `GET /api/movies/{id}` và `GET /api/movies?status=DRAFT` không lọc trạng thái public.
  - Done: khách chỉ đọc được `COMING_SOON` và `NOW_SHOWING`; ADMIN/EMPLOYEE vẫn đọc được mọi trạng thái qua endpoint quản trị.

- [ ] **MOV-BUG-04 - Có thể sửa Movie ở mọi trạng thái.**
  - Hiện trạng: `updateMovie()` không chặn `PENDING_REVIEW`, `COMING_SOON`, `NOW_SHOWING`, `ENDED` hoặc `REJECTED`.
  - Done: chỉ `DRAFT` được sửa; `REJECTED` phải gọi rework trước; UI và backend áp dụng cùng rule.

- [ ] **MOV-BUG-05 - Chưa validate quan hệ ngày.**
  - Hiện trạng: create/update và frontend chấp nhận `endDate < releaseDate`.
  - Done: trả `400` rõ ràng ở create/update/submit; frontend chặn trước khi gửi.

## P1 - Chuẩn hóa validation và dữ liệu

- [ ] **MOV-BUG-06 - Genre/format ID bị lặp được báo sai là “not found”.**
  - Hiện trạng: service so `findAll...().size()` với kích thước list đầu vào; `[1, 1]` thành lỗi 404.
  - Done: phát hiện duplicate bằng `Set`, trả lỗi validation `400` hoặc loại trùng theo contract thống nhất.

- [ ] **MOV-BUG-07 - `originalLanguage` và translation language chỉ kiểm tra đủ 2 ký tự.**
  - Hiện trạng: giá trị như `12` vẫn hợp lệ.
  - Done: chỉ nhận ISO 639-1 được hỗ trợ; normalize lowercase.

- [ ] **MOV-BUG-08 - Media URL chỉ kiểm tra chiều dài.**
  - Hiện trạng: `posterUrl`, `thumbnailUrl`, `trailerUrl` nhận chuỗi như `abc`.
  - Done: validate URI/HTTPS hợp lệ, không gọi remote URL trong validator.

- [ ] **MOV-BUG-09 - Cast role và billing order chưa được validate ở DTO.**
  - Hiện trạng: `roleType` là String; role sai chờ DB constraint rồi trả lỗi integrity chung; billing order âm vẫn được nhận.
  - Done: dùng enum `ACTOR/DIRECTOR/WRITER/PRODUCER/COMPOSER`, trả `400`; billing order phải không âm; chặn trùng `(personId, roleType)` trước khi insert.

- [ ] **MOV-BUG-10 - Duplicate `tmdbId`/`imdbId` trả lỗi DB chung.**
  - Hiện trạng: repository có hàm kiểm tra nhưng `createMovie()` chỉ kiểm tra title.
  - Done: kiểm tra external ID trước khi save và trả domain error rõ ràng; vẫn giữ unique constraint để chống race condition.

- [ ] **MOV-BUG-11 - Rule duplicate title và error message không khớp.**
  - Hiện trạng: code chặn theo `originalTitle` duy nhất, message lại nói “Vietnamese title and format”.
  - Done: chốt identity rule rồi đồng bộ service, DB constraint, message và Postman test.

- [ ] **MOV-BUG-12 - Audit create ghi sai actor.**
  - Hiện trạng: create ghi cứng `SYSTEM` và `Admin` thay vì principal đang đăng nhập.
  - Done: lấy actor từ SecurityContext; lưu account/username và role thật cho create cùng mọi transition.

## P1 - Hoàn thiện lifecycle sau khi tạo

- [ ] **MOV-BUG-13 - Thiếu scheduler `COMING_SOON -> NOW_SHOWING`.**
  - Done: chỉ auto-release khi tới `releaseDate` và Movie đã đạt readiness/release rule.

- [ ] **MOV-BUG-14 - Chưa có test tự động cho create transaction và workflow.**
  - Done: có unit/integration test cho happy path, validation, rollback, role access và toàn bộ transition.

## Regression checklist sau khi sửa

- [ ] Raw JSON hợp lệ tạo Movie ở trạng thái `DRAFT` và trả `movieId`.
- [ ] Genre, format, translations và cast được lưu đủ khi GET lại chi tiết.
- [ ] Request lỗi giữa chừng rollback hoàn toàn, không để lại Movie rác.
- [ ] EMPLOYEE tạo/submit được nhưng không approve/release được.
- [ ] ADMIN approve/release được khi Movie đạt readiness.
- [ ] DRAFT/PENDING_REVIEW/REJECTED không xuất hiện hoặc truy cập được từ public API.
- [ ] Frontend build thành công và hiển thị message backend rõ ràng.
- [ ] `mvnw -pl movie-service -am test` chạy thành công.
