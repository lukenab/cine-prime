# Showtime Management & Auto-Scheduling — Demo Script

## 1. Mục tiêu demo

Chứng minh hệ thống không tạo lịch chiếu tự động rồi public ngay. Hệ thống thực hiện đúng ba lớp kiểm soát:

1. **Eligibility gate** trước khi xếp lịch.
2. **Draft Schedule Plan** để nhân sự review.
3. **Publish** mới tạo Showtime thật cho vận hành/booking.

Thời lượng đề xuất: **10–12 phút**.

## 2. Thông điệp chính cần nói

> “Auto-scheduling ở đây là decision-support workflow, không phải một nút tạo hàng loạt thiếu kiểm soát. Engine tạo candidate, phân bổ coverage, post-validate và lưu draft. Admin vẫn là người chịu trách nhiệm review và publish.”

## 3. Chuẩn bị trước demo

### 3.1. Hệ thống

- API Gateway, Movie Service, Auth Service và database đang chạy.
- Frontend truy cập được trang `Showtimes`.
- Đã đăng nhập bằng tài khoản `ADMIN`.
- Migration Showtime P0 đã được apply.

### 3.2. Dữ liệu bắt buộc

Chuẩn bị tối thiểu:

| Dữ liệu | Điều kiện |
|---|---|
| Cinema Cluster | `ACTIVE`, có timezone và operating schedule |
| Cinema Room | `ACTIVE`, capacity > 0 |
| Room Layout | `ACTIVE`, có sellable positions |
| Movie A | `APPROVED`, có poster, runtime và domestic flag rõ ràng |
| Movie B | `APPROVED`, có poster, runtime |
| Screening Version | Active/effective, format/audio/subtitle phù hợp room |
| Movie Availability | Schedulable cho cluster và planning dates |
| Classification Approval | Approved cho `VN` và còn hiệu lực |
| Theatrical License | Active, đúng version/cluster/territory/date |
| Allocation Policy | `DEFAULT`, active |

### 3.3. Biến dự phòng Postman

```text
baseUrl = http://localhost:8080
adminAccessToken = <token>
clusterId = <eligible cluster>
movieIdA = <eligible movie>
movieIdB = <eligible movie>
generationRunId = <set after submit>
schedulePlanId = <set after execute>
```

## 4. Demo UI — Happy path

### Bước 1 — Mở trang Showtime Management

**Thao tác**

- Mở menu `Showtimes`.
- Chọn `Create Schedule`.
- Chọn option `Auto Schedule`.

**Lời nói gợi ý**

> “Trang quản lý giữ cả hai hướng: tạo thủ công cho tình huống vận hành đặc biệt và auto-scheduling cho kế hoạch nhiều phim/nhiều cụm rạp.”

**Kết quả mong đợi**

- Auto Schedule workspace mở trong cùng context quản lý Showtime.

### Bước 2 — Chọn planning window

**Thao tác**

- Chọn ngày bắt đầu và kết thúc nằm trong planning horizon.

**Lời nói gợi ý**

> “Planning window được kiểm tra theo policy và business timezone `Asia/Ho_Chi_Minh`, không dùng ngày hệ thống một cách rải rác.”

**Kết quả mong đợi**

- Không có lỗi date range.

### Bước 3 — Chọn Cinema scope

**Thao tác**

- Chọn một cluster có phòng và active sellable layout.
- Chỉ ra một cluster disabled nếu dữ liệu demo có sẵn.

**Lời nói gợi ý**

> “Cluster active nhưng không có room đủ điều kiện vẫn không được xếp lịch. UI hiển thị nguyên nhân thay vì để Admin submit rồi mới nhận lỗi mơ hồ.”

**Kết quả mong đợi**

- Cluster eligible có thể chọn.
- Cluster không schedulable bị disable và có reason.

### Bước 4 — Chọn Movie scope

**Thao tác**

- Chọn Movie A và Movie B từ card có poster, tuổi, runtime, format/version metadata.

**Lời nói gợi ý**

> “Danh sách chỉ dùng approved catalog cho bước chọn. Backend vẫn revalidate availability, classification, theatrical rights và screening version.”

**Kết quả mong đợi**

- Sticky summary hiển thị đúng số cinema, movie và date range.

### Bước 5 — Review scope và submit

**Thao tác**

- Chuyển sang Review.
- Kiểm tra scope rồi submit generation run.

**Lời nói gợi ý**

> “Request cùng policy, ngày, phim và cụm rạp tạo cùng idempotency key. Người dùng bấm lại sẽ không sinh duplicate run.”

**Kết quả mong đợi**

- Nhận `generationRunId` ở trạng thái `ACCEPTED`.

### Bước 6 — Automatic processing/Poll

**Thao tác**

- Không cần thao tác thủ công: worker được trigger ngay sau khi run được tạo.
- Chờ trạng thái chuyển `ACCEPTED → RUNNING → terminal`.
- Chỉ khi cần recovery trong demo: mở `Advanced actions → Process now`.

**Lời nói gợi ý**

> “Worker claim run atomically. Pipeline tạo candidate, score, cấp minimum coverage theo round-robin, fill capacity và post-validate.”

**Kết quả mong đợi**

- Status `COMPLETED` hoặc `PARTIALLY_COMPLETED` có giải thích.
- Hiển thị Candidates, Draft slots, Skipped và Partitions.

### Bước 7 — Review kết quả generation

**Thao tác**

- Xem per-movie breakdown.
- Xem Schedule Plan slots: movie, cluster/room, version, business time.
- Chỉ ra slot qua nửa đêm nếu có.

**Lời nói gợi ý**

> “`startAt/endAt` là timestamp canonical nên suất bắt đầu trước nửa đêm và kết thúc ngày hôm sau vẫn được mô hình hóa chính xác. Business date chỉ dùng để gom kế hoạch.”

**Kết quả mong đợi**

- Plan ở `DRAFT_GENERATED`.
- Chưa có `publishedShowtimeId`.
- Published showtimes count vẫn bằng 0.

### Bước 8 — Submit for Review

**Thao tác**

- Nhập note: `Đã kiểm tra coverage, phiên bản chiếu và khung giờ vận hành.`
- Bấm `Submit for review`.

**Lời nói gợi ý**

> “Trước khi chuyển vào review, backend recheck eligibility để tránh duyệt một plan đã stale.”

**Kết quả mong đợi**

- Plan chuyển sang `IN_REVIEW`.

### Bước 9 — Publish Schedule

**Thao tác**

- Kiểm tra `blockerCount = 0`.
- Bấm `Publish schedule`.

**Lời nói gợi ý**

> “Publish recheck rights, classification và availability lần cuối. Chỉ tại thời điểm này các plan slot mới được materialize thành Showtime thật.”

**Kết quả mong đợi**

- Plan chuyển `PUBLISHED`.
- Mỗi slot có `publishedShowtimeId`.
- Danh sách Published Showtimes xuất hiện.
- Trang Showtimes chính refresh và thấy các suất mới.

## 5. Demo exception path ngắn

Chỉ chọn một case để không làm demo dài.

### Option A — Ineligible movie

1. Chọn một movie thiếu availability/license/classification.
2. Submit.
3. Backend reject preflight và trả danh sách `ineligibleMovies`.

**Thông điệp**

> “Hệ thống fail fast trước khi tạo run rỗng; Admin biết chính xác phim nào cần bổ sung dữ liệu.”

### Option B — Request changes

1. Từ plan `IN_REVIEW`, nhập note yêu cầu cân bằng lại một khung giờ.
2. Bấm `Request changes`.
3. Xác nhận plan thành `CHANGES_REQUESTED` và không có Showtime nào được publish.

### Option C — Publishing blocker

1. Dùng plan test có minimum coverage hoặc Vietnamese share blocker.
2. Chỉ ra validation summary.
3. Nút Publish bị disable; gọi API trực tiếp cũng bị backend chặn.

## 6. Postman fallback nếu UI có sự cố

### Submit

```json
POST {{baseUrl}}/api/schedules/auto-generation-runs

{
  "startDate": "2026-07-25",
  "endDate": "2026-07-27",
  "cinemaClusterIds": [{{clusterId}}],
  "movieIds": [{{movieIdA}}, {{movieIdB}}]
}
```

### Process now (optional recovery only)

UI chỉ hiển thị thao tác này trong `Advanced actions` cho SUPER_ADMIN hoặc môi trường demo/dev.
Không gọi nếu worker đã tự chuyển run sang `RUNNING`.

```text
POST {{baseUrl}}/api/schedules/auto-generation-runs/{{generationRunId}}/execute
```

### Poll

```text
GET {{baseUrl}}/api/schedules/auto-generation-runs/{{generationRunId}}?page=0&size=20
```

### Submit review

```json
POST {{baseUrl}}/api/schedule-plans/{{schedulePlanId}}/submit-review

{
  "note": "Demo review completed"
}
```

### Publish

```text
POST {{baseUrl}}/api/schedule-plans/{{schedulePlanId}}/publish
```

## 7. Script văn nói rút gọn

> “Trong Sprint này, nhóm em không để thuật toán tự tạo thẳng dữ liệu bán vé. Admin chọn planning window, cụm rạp và các phim đã approved. Backend tiếp tục kiểm tra availability, phân loại độ tuổi, theatrical rights, screening version và room layout. Sau đó engine tạo candidate, phân bổ minimum coverage theo round-robin, fill phần capacity còn lại và post-validate overlap cũng như programming policy. Kết quả được lưu thành Schedule Plan ở trạng thái Draft Generated. Admin submit để review, có thể request changes, và chỉ khi plan không còn blocker mới được publish. Publish mới materialize Showtime thật. Luồng này giúp tách quyết định tự động khỏi quyết định vận hành, hỗ trợ suất qua nửa đêm và xử lý partial failure theo từng cluster/ngày.”

## 8. Câu hỏi thường gặp

**Generation run COMPLETED có nghĩa khách hàng thấy lịch chưa?**  
Không. `COMPLETED` chỉ nói pipeline generation hoàn tất. Plan phải `PUBLISHED` mới có Showtime thật.

**Tại sao vẫn cần Admin review nếu thuật toán đã validate?**  
Validation bảo đảm invariant kỹ thuật và policy đã cấu hình. Programming Operator vẫn cần chịu trách nhiệm về quyết định kinh doanh và các ngoại lệ vận hành.

**Nếu quyền chiếu hết hạn sau lúc generation thì sao?**  
Eligibility được recheck khi submit review và publish. Plan stale sẽ bị chặn.

**PARTIALLY_COMPLETED có phải vì nhiều candidate bị skip không?**  
Không. Candidate skip là business outcome. `PARTIALLY_COMPLETED` dùng khi có partition kỹ thuật thành công và partition kỹ thuật thất bại.

**Tỷ lệ phim Việt 20% có phải quy định pháp luật đã xác nhận không?**  
Không nên tuyên bố như vậy. Đây là operational seed cần Legal/Compliance xác nhận và có thể cấu hình theo effective-dated policy.

## 9. Checklist trước khi bắt đầu demo

- [ ] Admin login hoạt động.
- [ ] Ngày demo nằm đúng planning horizon.
- [ ] Ít nhất một cluster schedulable.
- [ ] Ít nhất hai movie eligible.
- [ ] Rights, classification, availability và screening versions đã seed.
- [ ] Không có showtime cũ gây overlap ngoài dự kiến.
- [ ] Đã thử happy path ít nhất một lần sau khi reset data.
- [ ] Có Postman fallback và IDs dự phòng.
- [ ] Không gọi policy 20% là “quy định pháp luật” nếu chưa có legal source được duyệt.
