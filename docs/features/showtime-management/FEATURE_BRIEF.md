# Showtime Management & Auto-Scheduling — Feature Brief

## 1. Thông tin tài liệu

| Thuộc tính | Giá trị |
|---|---|
| Module | `movie-service` và giao diện quản trị Showtime |
| Đối tượng chính | `ADMIN` / Cinema Programming Operator |
| Phụ thuộc | Movie Catalog, Movie Availability, Cinema Cluster, Cinema Room, Room Layout, Screening Version |
| Downstream consumer | Booking/Seat Inventory, Customer Showtime Listing |
| Phạm vi | Manual Showtime CRUD và Auto-scheduling P0 |

## 2. Bối cảnh nghiệp vụ

Showtime không chỉ là một cặp `ngày + giờ`. Một suất chiếu hợp lệ phải trả lời được các câu hỏi:

- Phim đã được duyệt nội dung chưa?
- Phim có được phép chiếu tại cụm rạp, lãnh thổ và ngày đó không?
- Phiên bản chiếu nào được sử dụng: định dạng, audio và subtitle?
- Phòng có đang hoạt động, có layout đang `ACTIVE` và có sức chứa bán được không?
- Khoảng thời gian chiếu có đè lên suất khác hoặc thời gian vệ sinh phòng không?
- Kế hoạch do máy tạo đã được nhân sự kiểm tra và phát hành chưa?

Vì vậy, hệ thống tách hai khái niệm:

1. **Schedule Plan**: bản kế hoạch có thể review, trả về chỉnh sửa hoặc hủy bỏ mà chưa ảnh hưởng lịch bán vé.
2. **Published Showtime**: suất chiếu đã được materialize và trở thành dữ liệu vận hành thực tế.

## 3. Mục tiêu

- Cho phép Admin tạo, xem, cập nhật và xóa suất chiếu thủ công trong phạm vi được phép.
- Tạo lịch tự động theo movie scope, cinema scope, planning window và policy có phiên bản.
- Ngăn tạo lịch cho phim/phòng/phiên bản chiếu không đủ điều kiện.
- Phân bổ minimum coverage công bằng bằng round-robin, sau đó mới tối ưu phần capacity còn lại.
- Tạo bản nháp trước, yêu cầu review và chỉ materialize Showtime sau khi publish.
- Hỗ trợ suất chiếu qua nửa đêm bằng `startAt` và `endAt` có timezone/offset.
- Phân biệt rõ run hoàn tất toàn bộ, hoàn tất một phần và thất bại.
- Lưu đủ số liệu và nguyên nhân skip/failure để Admin và QA truy vết.

## 4. Không nằm trong phạm vi hiện tại

Các nội dung sau thuộc phase refine/P1, không được xem là đã hoàn thiện trong P0:

- Forecast doanh thu, occupancy và dynamic pricing.
- Demand model đầy đủ theo holiday, weekday, daypart và dữ liệu bán vé lịch sử.
- Distributor/film-plan contract phức tạp như minimum shows, screen share và revenue share.
- Frozen showtime, manual override có change penalty.
- Pre-show, trailer pack, interval và cleanup riêng theo từng phòng/phim.
- Tự động giải quyết quyền chiếu; hệ thống hiện chỉ kiểm tra dữ liệu quyền đã được nhập.
- Workflow hủy suất và xử lý hoàn tiền end-to-end trong Booking/Payment.

## 5. Actors và quyền hạn

| Actor | Trách nhiệm |
|---|---|
| ADMIN / Programming Operator | Chọn scope, chạy auto-scheduling, review plan, request changes và publish |
| Generation Worker | Được trigger ngay sau khi transaction tạo run commit và claim run `ACCEPTED` |
| Recovery Scheduler | Quét lại các run còn `ACCEPTED` khi immediate dispatch bị gián đoạn |
| Customer | Chỉ xem các Showtime đã publish/đủ điều kiện public |
| Booking Service | Dùng Showtime và seat inventory sau khi được materialize |

Các API ghi dữ liệu generation/plan hiện yêu cầu `ROLE_ADMIN`.

## 6. Luồng nghiệp vụ chính

### 6.1. Tạo suất chiếu thủ công

1. Admin chọn phim, phòng, ngày, giờ bắt đầu, phiên bản ngôn ngữ và giá cơ sở.
2. Backend kiểm tra phòng có thể xếp lịch và kiểm tra overlap.
3. Backend tính giờ kết thúc từ runtime phim.
4. Showtime được tạo ở trạng thái `SCHEDULED`.

> Lưu ý: Manual CRUD là luồng legacy. Auto-scheduling là luồng được chuẩn hóa sâu hơn về screening version, rights/classification, planning draft và publish.

### 6.2. Tạo lịch tự động

```text
Chọn planning window, cinema và movie
                    |
                    v
           Preflight eligibility
                    |
                    v
       Generation Run: ACCEPTED
                    |
                    v
        Generate & rank candidates
                    |
                    v
     Round-robin minimum coverage
                    |
                    v
         Fill remaining capacity
                    |
                    v
             Post-validation
                    |
                    v
   Schedule Plan: DRAFT_GENERATED
                    |
                    v
                IN_REVIEW
                 /     \
                /       \
 Request changes         Publish (không có blocker)
         |                         |
         v                         v
 CHANGES_REQUESTED             PUBLISHED
         |                         |
         +---- Submit lại          v
                         Materialize ShowTime records
```

| Bước | Xử lý | Kết quả |
|---:|---|---|
| 1 | Admin chọn khoảng ngày, cụm rạp và phim | Xác định scheduling scope |
| 2 | Backend kiểm tra movie, availability, classification, license, screening version và room/layout | Chỉ giữ dữ liệu đủ điều kiện |
| 3 | Tạo Generation Run | Run ở trạng thái `ACCEPTED` |
| 4 | Sinh, chấm điểm và xếp hạng candidate | Danh sách khung giờ tiềm năng |
| 5 | Cấp minimum coverage theo round-robin, sau đó fill capacity còn lại | Danh sách slot được chọn |
| 6 | Post-validate coverage, overlap và programming policy | Tạo blocker nếu vi phạm |
| 7 | Lưu Schedule Plan | Plan ở `DRAFT_GENERATED`, chưa phải Showtime thật |
| 8 | Admin submit plan để review | Plan chuyển sang `IN_REVIEW` |
| 9 | Admin request changes hoặc publish | `CHANGES_REQUESTED` hoặc `PUBLISHED` |
| 10 | Publish plan không có blocker | Materialize các slot thành `ShowTime` |

### 6.3. Nguyên tắc quan trọng

- `COMPLETED` của generation run không đồng nghĩa lịch đã public.
- Run tạo `SchedulePlan` và `SchedulePlanSlot`; chỉ `PUBLISHED` mới tạo `ShowTime`.
- Eligibility được kiểm tra khi tạo candidate, khi submit review và trước publish.
- Publish bị chặn khi `blockerCount > 0` hoặc eligibility đã thay đổi.

## 7. State model

### 7.1. Generation Run

| Trạng thái | Ý nghĩa |
|---|---|
| `ACCEPTED` | Đã lưu bền vững; worker đã được thông báo, scheduler đóng vai trò fallback |
| `RUNNING` | Một worker đã claim run |
| `COMPLETED` | Tất cả partition kỹ thuật đã xử lý thành công |
| `PARTIALLY_COMPLETED` | Có partition thành công và có partition thất bại |
| `FAILED` | Không có partition usable hoặc pipeline thất bại |

Business candidate bị skip không tự động biến run thành `PARTIALLY_COMPLETED`; trạng thái này dành cho partial technical completion.

### 7.2. Schedule Plan

| Trạng thái | Action hợp lệ tiếp theo |
|---|---|
| `DRAFT_GENERATED` | Submit for review |
| `IN_REVIEW` | Request changes hoặc Publish |
| `CHANGES_REQUESTED` | Khắc phục nguyên nhân bên ngoài hoặc tạo plan mới; API hiện cho phép Submit for review lại |
| `PUBLISHED` | Terminal; gọi publish lại phải idempotent |

### 7.3. Showtime

| Trạng thái | Ý nghĩa |
|---|---|
| `SCHEDULED` | Đã tạo, chưa mở bán |
| `ON_SALE` | Đang mở bán vé |
| `SUSPENDED` | Tạm dừng, giữ nguyên dữ liệu inventory hiện hữu |
| `CANCELLED` | Suất đã bị hủy |
| `COMPLETED` | Suất đã kết thúc |

## 8. Mô hình dữ liệu trọng tâm

| Aggregate / Entity | Vai trò |
|---|---|
| `ShowtimeGenerationRun` | Snapshot scope, policy, status và số liệu thực thi |
| `ShowtimeGenerationPartition` | Đơn vị xử lý theo `clusterId + businessDate` |
| `ShowtimeGenerationSkip` | Lưu nguyên nhân candidate bị loại và occurrence count |
| `SchedulePlan` | Bản nháp tổng cần review/publish |
| `SchedulePlanSlot` | Một suất chiếu dự kiến, chưa public |
| `MovieScreeningVersion` | Phiên bản chiếu gồm format, audio, subtitle và effective window |
| `TheatricalLicense` | Quyền khai thác theo movie/version/cluster/territory/window |
| `MovieClassificationApproval` | Phê duyệt phân loại theo lãnh thổ và thời gian |
| `ProgrammingSharePolicy` | Chính sách tỷ lệ nội dung theo thị trường và effective window |
| `ShowTime` | Suất chiếu thật sau publish hoặc tạo thủ công |

## 9. Điều kiện thành công

- Không có hai suất chồng lấn trong cùng phòng sau khi tính cleanup buffer.
- Mỗi slot giữ được screening version cụ thể, không suy đoán lại sau khi publish.
- Tất cả movie được chọn có ít nhất một candidate eligible ở preflight.
- Minimum coverage được phân bổ công bằng và được post-validate.
- Plan có blocker không thể publish.
- Một partition lỗi không làm mất kết quả của các partition đã thành công.
- Request cùng scope trả về generation run cũ qua idempotency key.
- UI hiển thị được candidate, draft slot, skipped, partition success/failure và blocker.

## 10. Rủi ro và giới hạn cần công khai

- Chính sách `VN_PROGRAMMING_2026_V1` seed 20% là **operational default cần legal/compliance xác nhận**, không phải khẳng định pháp lý trong tài liệu này.
- Manual Showtime CRUD vẫn sử dụng một số trường legacy `showDate/startTime/endTime`; auto-scheduling lấy `startAt/endAt` làm canonical temporal model.
- API public list hiện cần tiếp tục được rà soát để chỉ trả đúng Showtime được phép hiển thị/bán.
- Việc publish tạo inventory cần được kiểm thử tích hợp với Booking Service trước production rollout.
- Plan slot hiện chưa có API chỉnh sửa trực tiếp; nếu yêu cầu thay đổi làm khác slot, hướng an toàn là tạo generation run/plan mới.
- P0 sử dụng demand heuristic có thể giải thích và capacity-fit để chọn phòng; đây chưa phải mô hình dự báo từ dữ liệu bán vé.
- P0 giữ lịch hiện hữu theo cơ chế insert-only. Weekly programming plan, frozen-window linh hoạt, manual override có penalty và CP-SAT/constraint solver được hoãn sang P1.

## 11. Source code tham chiếu

- `server/movie-service/src/main/java/movieservice/controller/ScheduleController.java`
- `server/movie-service/src/main/java/movieservice/controller/AutoShowtimeGenerationController.java`
- `server/movie-service/src/main/java/movieservice/controller/SchedulePlanController.java`
- `server/movie-service/src/main/java/movieservice/service/AutoShowtimeGenerationService.java`
- `server/movie-service/src/main/java/movieservice/service/SchedulePlanService.java`
- `server/movie-service/src/main/java/movieservice/service/autoshowtime/`
- `client/src/pages/admin/AutoScheduleShowtimePage.tsx`
