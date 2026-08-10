# Showtime Management & Auto-Scheduling — Feature Brief

## 1. Thông tin tài liệu

| Thuộc tính | Giá trị |
|---|---|
| Module | `movie-service` và giao diện quản trị Showtime |
| Đối tượng chính | `ADMIN` / Cinema Programming Operator |
| Phụ thuộc | Movie Catalog, Movie Availability, Cinema Cluster, Cinema Room, Room Layout, Screening Version |
| Downstream consumer | Booking/Seat Inventory, Customer Showtime Listing |
| Phạm vi | Manual Showtime CRUD, Auto-scheduling (thuật toán greedy mặc định) và bộ tối ưu ràng buộc CP-SAT (tùy chọn, đang thử nghiệm) |
| Trạng thái | Luồng thủ công và greedy: **ổn định, đã dùng thật**. CP-SAT: **đã code xong, đã unit test, chưa được xác nhận ổn định qua chạy thật ở quy mô sản xuất** — xem mục 10 |

## 2. Bối cảnh nghiệp vụ

Showtime không chỉ là một cặp `ngày + giờ`. Một suất chiếu hợp lệ phải trả lời được các câu hỏi:

- Phim đã được duyệt nội dung chưa?
- Phim có `MovieAvailability` (kế hoạch phát hành) hợp lệ cho đúng cụm rạp và ngày đó không?
- Phiên bản chiếu nào được sử dụng: định dạng, audio và subtitle?
- Phòng có đang hoạt động, có layout đang `ACTIVE`, có sức chứa bán được, và có hỗ trợ đúng định dạng chiếu không?
- Khoảng thời gian chiếu có đè lên suất khác hoặc thời gian vệ sinh phòng không?
- Kế hoạch do máy tạo đã được nhân sự kiểm tra và phát hành chưa?

Vì vậy, hệ thống tách hai khái niệm:

1. **Schedule Plan**: bản kế hoạch có thể review, trả về chỉnh sửa hoặc hủy bỏ mà chưa ảnh hưởng lịch bán vé.
2. **Published Showtime**: suất chiếu đã được materialize và trở thành dữ liệu vận hành thực tế.

## 3. Mục tiêu

- Cho phép Admin tạo, xem, cập nhật và xóa suất chiếu thủ công trong phạm vi được phép.
- Tạo lịch tự động theo movie scope, cinema scope, planning window và policy có phiên bản.
- Ngăn tạo lịch cho phim/phòng/phiên bản chiếu không đủ điều kiện — báo ngay tại bước preflight, không để Admin submit rồi mới biết.
- Phân bổ minimum coverage công bằng, sau đó mới tối ưu phần capacity còn lại.
- Tạo bản nháp trước, yêu cầu review và chỉ materialize Showtime sau khi publish.
- Hỗ trợ suất chiếu qua nửa đêm bằng `startAt`/`endAt` có timezone/offset.
- Phân biệt rõ run hoàn tất toàn bộ, hoàn tất một phần và thất bại.
- Lưu đủ số liệu và nguyên nhân skip/failure để Admin và QA truy vết.
- *(Mới)* Cho phép chọn thuật toán phân bổ (`LEGACY` mặc định hoặc `CP_SAT`) và kịch bản tối ưu (`CONSERVATIVE`/`BALANCED`/`REVENUE_FOCUSED`) theo từng lần chạy, không ảnh hưởng luồng review/publish sẵn có.

## 4. Không nằm trong phạm vi hiện tại

- Forecast doanh thu/occupancy từ dữ liệu bán vé lịch sử thật (hiện dùng heuristic có thể giải thích, không phải mô hình dự báo).
- Quản lý quyền phát hành (theatrical license) và phê duyệt phân loại phim theo lãnh thổ — **đã chủ động loại bỏ khỏi hệ thống** (xem mục 10) vì ngoài thẩm quyền dự án; chỉ còn kiểm tra `MovieAvailability`.
- Chính sách tỷ lệ nội dung nội địa (Vietnamese content quota) — **đã loại bỏ**, cùng lý do trên.
- Phối hợp lịch giữa nhiều cụm rạp (staggering), rolling replanning theo booking-pace, kịch bản đa cụm rạp (`MarketArea`) — đây là các hạng mục P2 của bộ tối ưu CP-SAT, **chưa triển khai**; trường `replanMode` trong request bị từ chối rõ ràng (`AUTO_SHOWTIME_REPLAN_NOT_SUPPORTED`) thay vì âm thầm bỏ qua.
- Pre-show, trailer pack, interval và cleanup riêng theo từng phòng/phim.
- Workflow hủy suất và xử lý hoàn tiền end-to-end trong Booking/Payment.
- Giao diện quản lý cấu hình solver (thời gian giải, số worker, seed...) — hiện chỉ sửa được qua SQL trực tiếp.

## 5. Actors và quyền hạn

| Actor | Trách nhiệm |
|---|---|
| ADMIN / Programming Operator | Chọn scope, thuật toán, kịch bản, chạy auto-scheduling, review plan, request changes và publish |
| Generation Worker | Được trigger ngay sau khi transaction tạo run commit và claim run `ACCEPTED` |
| Recovery Scheduler | Quét lại các run còn `ACCEPTED` quá hạn (immediate dispatch bị gián đoạn) hoặc `RUNNING` quá lâu không có worker sống (orphan sweep, 5 phút) |
| Customer | Chỉ xem các Showtime đã publish/đủ điều kiện public |
| Booking Service | Dùng Showtime và seat inventory sau khi được materialize |

Các API ghi dữ liệu generation/plan hiện yêu cầu `ROLE_ADMIN`.

## 6. Luồng nghiệp vụ chính

### 6.1. Tạo suất chiếu thủ công

1. Admin chọn phim, phòng, ngày, giờ bắt đầu, phiên bản ngôn ngữ và giá cơ sở.
2. Backend kiểm tra phòng có thể xếp lịch và kiểm tra overlap.
3. Backend tính giờ kết thúc từ runtime phim.
4. Showtime được tạo ở trạng thái `SCHEDULED`.

> Lưu ý: Manual CRUD là luồng legacy, dùng `showDate/startTime/endTime`. Auto-scheduling dùng `startAt/endAt` (canonical, có offset) làm mô hình thời gian chuẩn.

### 6.2. Tạo lịch tự động

```text
Chọn planning window, cinema, movie, thuật toán và kịch bản
                    |
                    v
           Preflight eligibility
                    |
                    v
       Generation Run: ACCEPTED
                    |
                    v
   Sinh candidate (đã lọc theo điều kiện cứng)
                    |
                    v
     LEGACY: chấm điểm rồi chọn theo round-robin
     CP_SAT: chấm điểm rồi tối ưu chung cả tuần bằng constraint solver
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
| 1 | Admin chọn khoảng ngày, cụm rạp, phim, thuật toán (`LEGACY`/`CP_SAT`/`SHADOW_COMPARE`) và kịch bản | Xác định scheduling scope |
| 2 | Backend kiểm tra movie, availability, screening version và room/layout/format | Chỉ giữ dữ liệu đủ điều kiện |
| 3 | Tạo Generation Run | Run ở trạng thái `ACCEPTED` |
| 4 | Sinh candidate, lọc theo giờ hoạt động/bảo trì/xung đột với suất đã tồn tại | Danh sách khung giờ tiềm năng đã được cắt gọn |
| 5 | Chấm điểm rồi chọn theo thuật toán đã chọn | Danh sách slot được chọn + trạng thái solver (nếu CP_SAT) |
| 6 | Post-validate coverage, overlap, room-share, stagger | Tạo blocker nếu vi phạm |
| 7 | Lưu Schedule Plan | Plan ở `DRAFT_GENERATED`, chưa phải Showtime thật |
| 8 | Admin submit plan để review | Plan chuyển sang `IN_REVIEW` |
| 9 | Admin request changes hoặc publish | `CHANGES_REQUESTED` hoặc `PUBLISHED` |
| 10 | Publish plan không có blocker | Materialize các slot thành `ShowTime` |

### 6.3. Nguyên tắc quan trọng

- `COMPLETED` của generation run không đồng nghĩa lịch đã public.
- Run tạo `SchedulePlan` và `SchedulePlanSlot`; chỉ `PUBLISHED` mới tạo `ShowTime`.
- Eligibility được kiểm tra khi tạo candidate, khi submit review và trước publish.
- Publish bị chặn khi `blockerCount > 0` hoặc eligibility đã thay đổi.
- Auto-scheduling là **insert-only**: không bao giờ sửa/xóa Showtime đã tồn tại, kể cả khi chạy lại.
- Dù chọn `CP_SAT`, hệ thống có thể tự động rơi về `LEGACY` nếu solver lỗi hoặc không tìm được lời giải khả dụng (cấu hình qua policy).

## 7. State model

*(không đổi so với trước — xem TECHNICAL_SPECIFICATION.md §6 để có bảng đầy đủ)*

## 8. Mô hình dữ liệu trọng tâm

| Aggregate / Entity | Vai trò |
|---|---|
| `ShowtimeGenerationRun` | Snapshot scope, policy, thuật toán/kịch bản đã chọn, status, số liệu thực thi và kết quả solver |
| `ShowtimeGenerationPartition` | Đơn vị xử lý theo `clusterId + businessDate` |
| `ShowtimeGenerationSkip` | Lưu nguyên nhân candidate bị loại và occurrence count |
| `SchedulePlan` | Bản nháp tổng cần review/publish |
| `SchedulePlanSlot` | Một suất chiếu dự kiến, chưa public — kèm điểm chi tiết (`scoreBreakdown`) |
| `MovieScreeningVersion` | Phiên bản chiếu gồm format, audio, subtitle và effective window |
| `ShowtimeAllocationPolicy` | Trọng số chấm điểm, quota, khung giờ peak/daypart, và (mới) cấu hình solver CP-SAT |
| `ShowTime` | Suất chiếu thật sau publish hoặc tạo thủ công |

`TheatricalLicense`, `MovieClassificationApproval`, `ProgrammingSharePolicy` **đã bị xóa khỏi hệ thống** (schema và code) — xem mục 10.

## 9. Điều kiện thành công

- Không có hai suất chồng lấn trong cùng phòng sau khi tính cleanup buffer.
- Mỗi slot giữ được screening version cụ thể, không suy đoán lại sau khi publish.
- Tất cả movie được chọn có ít nhất một candidate eligible ở preflight.
- Minimum coverage được phân bổ công bằng và được post-validate.
- Plan có blocker không thể publish.
- Một partition lỗi không làm mất kết quả của các partition đã thành công.
- Request cùng scope (bao gồm cùng thuật toán/kịch bản) trả về generation run cũ qua idempotency key.
- UI hiển thị được candidate, draft slot, skipped, partition success/failure, blocker, và (nếu có) trạng thái solver/điểm mục tiêu.

## 10. Rủi ro và giới hạn cần công khai

- **CP-SAT chưa được xác nhận ổn định ở môi trường thật.** Lần chạy thử nghiệm duy nhất trên dữ liệu thật đã bị treo hơn 2 phút (vượt giới hạn 30s cấu hình) do nghi vấn xung đột giữa OR-Tools native library và cơ chế hot-reload của Spring DevTools. Đã vá mã để không còn treo vô thời hạn (bắt cả `Error`, không chỉ `RuntimeException`), nhưng **chưa có lần chạy thật nào xác nhận bản vá hoạt động đúng**. Khuyến nghị: giữ `default_optimizer_mode = LEGACY` cho vận hành thật; chỉ dùng `CP_SAT`/`SHADOW_COMPARE` để thử nghiệm nội bộ, khởi động service bằng full restart (không qua DevTools hot-reload) khi kiểm thử.
- Không có UI/API quản lý cấu hình solver (`max_solve_time_seconds`, `solver_search_workers`...) — chỉ sửa được qua SQL trực tiếp.
- Chưa có benchmark hiệu năng CP-SAT ở quy mô nhiều phim/nhiều cụm rạp thật.
- Manual Showtime CRUD vẫn dùng trường legacy `showDate/startTime/endTime`; auto-scheduling lấy `startAt/endAt` làm canonical temporal model — hai contract thời gian song song vẫn tồn tại.
- API public list hiện cần tiếp tục được rà soát để chỉ trả đúng Showtime được phép hiển thị/bán.
- Việc publish tạo inventory cần được kiểm thử tích hợp với Booking Service trước production rollout.
- Plan slot hiện chưa có API chỉnh sửa trực tiếp; nếu cần thay đổi 1 slot, hướng an toàn là tạo generation run/plan mới.
- P0/P1 giữ lịch hiện hữu theo cơ chế insert-only. Đa cụm rạp (`MarketArea`), rolling replanning, booking-pace integration là hạng mục P2, **chưa triển khai**.
- Toàn bộ dữ liệu `movie`/`production_company`/`person` (và các suất chiếu/schedule plan phụ thuộc) đã được xóa sạch theo yêu cầu để import lại thủ công — tính năng này hiện **không có dữ liệu thật để kiểm thử end-to-end** cho tới khi catalog được nhập lại.

## 11. Source code tham chiếu

- `server/movie-service/src/main/java/movieservice/controller/ScheduleController.java`
- `server/movie-service/src/main/java/movieservice/controller/AutoShowtimeGenerationController.java`
- `server/movie-service/src/main/java/movieservice/controller/SchedulePlanController.java`
- `server/movie-service/src/main/java/movieservice/service/AutoShowtimeGenerationService.java`
- `server/movie-service/src/main/java/movieservice/service/autoshowtime/` (pipeline chung: factory → scorer → executor → validator)
- `server/movie-service/src/main/java/movieservice/service/autoshowtime/optimizer/` (LEGACY/CP_SAT/SHADOW_COMPARE, mới)
- `client/src/pages/admin/AutoScheduleShowtimePage.tsx`
- `client/src/pages/admin/autoSchedule/AutoScheduleResultsWorkspace.tsx`
- Xem thêm `TECHNICAL_SPECIFICATION.md` và `ALGORITHM_AND_GAP_ANALYSIS.md` trong cùng thư mục.
