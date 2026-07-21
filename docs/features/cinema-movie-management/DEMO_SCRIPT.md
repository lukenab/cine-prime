# DEMO_SCRIPT.md

## 1. Demo Mục Tiêu (Objective)

Kịch bản Demo này mô tả end-to-end cách một cụm rạp, phòng chiếu và phim được tạo, thiết lập nội dung và phê duyệt trên hệ thống theo đúng luồng code thực tế đang được backend áp dụng.

Demo nhằm chứng minh:
* Dữ liệu được bảo vệ bằng luồng phê duyệt (Maker - Checker).
* Sự liên kết của Cụm rạp (Cinema Cluster) và Phòng (Cinema Room) + Sơ đồ ghế (Room Layout).
* Phim chỉ bắt đầu chiếu thông qua Availability, sau khi được phê duyệt.

## 2. Các Vai Trò Tham Gia (Actors)

* `EMPLOYEE` (Maker): Khởi tạo cụm rạp, phòng chiếu, layout, và phim. Gửi trình duyệt (Submit).
* `ADMIN` (Checker): Phê duyệt rạp, layout, phim (Approve).
* `PUBLIC` (End user): Xem danh sách rạp và phim đang chiếu.

## 3. Kịch Bản Demo (End-to-End Scenario)

### Phase 1: Mở Cụm Rạp Mới (Cinema Cluster)

1. **Khởi tạo (Maker)**: `EMPLOYEE` gọi API `POST /api/cinema-clusters` để tạo rạp "Galaxy Nguyễn Du".
    * Kết quả mong đợi: `clusterStatus` là `DRAFT`.
2. **Trình duyệt (Maker)**: `EMPLOYEE` gọi API `POST /api/cinema-clusters/{id}/submit`.
    * Kết quả mong đợi: `clusterStatus` chuyển thành `PENDING_REVIEW`.
3. **Phê duyệt (Checker)**: `ADMIN` gọi API `POST /api/cinema-clusters/{id}/approve`.
    * Kết quả mong đợi: `clusterStatus` là `ACTIVE`. Lúc này khách hàng Public đã có thể thấy rạp.

### Phase 2: Thiết Lập Phòng Chiếu & Sơ Đồ Ghế (Cinema Room & Layout)

1. **Khởi tạo phòng (Maker)**: `EMPLOYEE` gọi API `POST /api/cinema-rooms` tại cụm rạp "Galaxy Nguyễn Du" để tạo "Phòng 1".
    * Kết quả mong đợi: Trả về Room status `DRAFT`. Một Layout version 1 `DRAFT` được sinh ngầm theo phòng này.
2. **Thiết kế sơ đồ ghế (Maker)**: `EMPLOYEE` gọi `PUT /api/cinema-rooms/{roomId}/layouts/{layoutId}` truyền tọa độ ghế, các ghế đôi, khoảng trống.
    * Kết quả mong đợi: Layout lưu bản nháp thành công, validate không lỗi (chưa submit).
3. **Nộp sơ đồ ghế (Maker)**: `EMPLOYEE` gọi `POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/submit`.
    * Kết quả mong đợi: Layout và Room đều chuyển sang trạng thái `PENDING_APPROVAL`.
4. **Phê duyệt sơ đồ (Checker)**: `ADMIN` kiểm tra an toàn PCCC, gọi `POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/approve`.
    * Kết quả mong đợi: Layout và Room chuyển thành `APPROVED`.
5. **Kích hoạt phòng (Checker)**: `ADMIN` gọi `POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/activate`.
    * Kết quả mong đợi: Service tự động sinh ra các dữ liệu ghế vật lý (`Seats`) lưu vào DB. Layout thành `ACTIVE`, Room thành `ACTIVE`. Sức chứa phòng được tính toán xong.

### Phase 3: Nhập Nội Dung Phim (Movie)

1. **Khởi tạo phim (Maker)**: `EMPLOYEE` gọi API `POST /api/movies` tạo phim "Fast & Furious 10".
    * Kết quả mong đợi: Phim ở trạng thái `DRAFT`.
2. **Nộp trình duyệt phim (Maker)**: `EMPLOYEE` gọi `POST /api/movies/{id}/submit`.
    * Kết quả mong đợi: Phim sang `PENDING_REVIEW`. (Lưu ý: validator sẽ check bắt buộc có poster, trailer, etc. trước khi cho qua bước này).
3. **Kiểm duyệt (Checker)**: `ADMIN` xem qua, thấy thiếu diễn viên. Gọi `POST /api/movies/{id}/request-changes` kèm note "Vui lòng thêm dàn diễn viên".
    * Kết quả mong đợi: Phim bị trả về `CHANGES_REQUESTED`.
4. **Sửa lỗi & Trình duyệt lại (Maker)**: 
    * `EMPLOYEE` gọi `POST /api/movies/{id}/start-revision` -> phim về lại `DRAFT`.
    * Bổ sung thông tin diễn viên, gọi lại `POST /api/movies/{id}/submit` -> `PENDING_REVIEW`.
5. **Phê duyệt phim (Checker)**: `ADMIN` đồng ý, gọi `POST /api/movies/{id}/approve`.
    * Kết quả mong đợi: Phim đổi status `APPROVED`. (Lúc này public vẫn chưa thấy vì chưa có suất chiếu/Availability).

### Phase 4: Sẵn Sàng Bán Vé & Public Trải Nghiệm (Availability)

1. **Phân bổ rạp (Checker/Maker)**: `ADMIN` phân bổ "Fast & Furious 10" cho "Galaxy Nguyễn Du" bằng API `POST /api/movie-availabilities`. 
    * Kết quả mong đợi: Bắt đầu ở trạng thái `PLANNED`.
2. **Mở suất chiếu**: `ADMIN` gọi `POST /api/movie-availabilities/{id}/open`. 
    * Kết quả mong đợi: Chuyển sang `OPEN`.
3. **Public View**: Khách hàng `PUBLIC` gọi `GET /api/movies/public`. 
    * Kết quả mong đợi: Khách hàng nhìn thấy phim "Fast & Furious 10" với trạng thái tự động tính toán là `NOW_SHOWING` hoặc `COMING_SOON` tùy ngày. Phim được map với rạp Galaxy Nguyễn Du.

### End of Demo

## 4. Q&A Tiềm Năng Cho Mentor / Leader

**Q: Tại sao tạo phòng (Room) không có nút Approve ngay mà phải thông qua Layout?**
**A**: Theo code (`CinemaRoomService`), luồng tạo phòng là "Wizard mode". Phòng ban đầu chỉ là 1 cái vỏ (kích thước tường). Sức chứa (TotalSeatCapacity) và quy mô phòng phụ thuộc hoàn toàn vào quá trình vẽ Layout. Do đó, việc duyệt phòng bị dời lại, nhập chung vào lúc duyệt và kích hoạt sơ đồ Layout (`RoomLayoutService.activate`).

**Q: Nếu cập nhật phim khi đang chiếu thì hệ thống bảo vệ thế nào?**
**A**: Phim chỉ cho phép edit (PUT `updateMovie`) khi trạng thái là `DRAFT`. Để edit phim đã `APPROVED`, cần mở cơ chế revision mới (về `DRAFT`). Trong khi đó bản cache cũ vẫn phục vụ khách, hoặc hệ thống tạm thời lấy bản hiển thị cuối. (Phần này có thể tùy ý cấu hình).

**Q: Làm sao tính ra được `NOW_SHOWING` hay `COMING_SOON`?**
**A**: Khác với tài liệu thiết kế cũ cho rằng trạng thái nằm trong thuộc tính của `Movie`, source code (`MovieService.findAllPublic`) đã đổi sang tính toán động. Nếu một phim `APPROVED` kết hợp với Availability là `OPEN` tại cụm rạp, và ngày release date đã qua -> `NOW_SHOWING`. Nếu chưa tới ngày release -> `COMING_SOON`. Điều này giúp hệ thống linh hoạt phục vụ nhiều múi giờ rạp.
