# Movie Service - Coverage Business Rule Theo Thực Tế Doanh Nghiệp Rạp Phim

> Phạm vi: Các business rule tham khảo từ mô hình vận hành rạp phim/nền tảng bán vé thật, sau đó đối chiếu với `movie-service` hiện tại của CinePrime.
>
> Mục tiêu: Giúp team biết case nào đã cover, case nào mới cover một phần, case nào đang thiếu và case nào nên đưa vào plan implement.

## Quy Ước Trạng Thái

| Trạng thái | Ý nghĩa |
| --- | --- |
| `Covered` | Code/data model hiện tại gần như đã hỗ trợ rule này. |
| `Partial` | Đã có model hoặc một phần flow, nhưng rule chưa hoàn chỉnh. |
| `Gap` | Chưa thấy hỗ trợ rõ ràng trong hệ thống hiện tại. |
| `Plan` | Nên đưa vào kế hoạch tương lai. |

## Nguồn Tham Khảo Public

Các nguồn dưới đây được dùng để rút ra pattern nghiệp vụ phổ biến. Không copy nguyên policy của họ, mà dùng để hiểu case thực tế.

| Nguồn | Pattern nghiệp vụ rút ra |
| --- | --- |
| AMC Theatres refund FAQ | Hoàn vé phải được yêu cầu trước giờ chiếu; phí tiện ích có thể không hoàn. |
| Fandango ticket/concessions policy | Điều kiện refund/exchange phụ thuộc chính sách từng rạp; exchange có thể chuyển thành credit trong tài khoản. |
| Cinemark refund FAQ | Vé có thể được đổi/hoàn trước giờ chiếu. |
| Regal tickets/cancellations help | Cutoff refund có thể nghiêm hơn, ví dụ trước giờ chiếu 60 phút. |
| Atom Tickets help | Có thể hủy trước giờ chiếu 30 phút; special event có policy riêng. |
| BookMyShow support | Cửa sổ hủy vé và phần trăm hoàn tiền thay đổi theo từng rạp; có trường hợp không được hủy. |
| AMC/Regal/Classic Cinemas age policies | Phim giới hạn độ tuổi có thể yêu cầu người lớn đi kèm hoặc cấm trẻ nhỏ ở một số suất. |
| Vietnam movie rating references | Rating Việt Nam gồm `P`, `K`, `T13`, `T16`, `T18`, `C`. |

## Tóm Tắt Coverage

| Nhóm nghiệp vụ | Coverage hiện tại | Gap chính |
| --- | --- | --- |
| Movie approval lifecycle | Partial | Chưa có check bắt buộc đủ dữ liệu trước khi approve. |
| Public movie visibility | Partial | Public list đã filter, nhưng public detail cũng cần chặn movie không public. |
| TMDB import | Covered/Partial | Import khá ổn, nhưng vẫn cần review thủ công và policy về độ tin cậy dữ liệu nguồn. |
| Age rating | Partial | Model đã có, nhưng enforcement khi mua vé/vào rạp cần phối hợp booking/user/movie. |
| Showtime scheduling | Partial | Đã có overlap/time window/advance scheduling; cần siết room status và sale lifecycle. |
| Showtime cancellation | Gap/Partial | Có status/field, nhưng cần flow cancel rõ ràng thay vì delete. |
| Seat snapshot/pricing | Partial | Có showtime-seat snapshot; chưa chốt source of truth về giá/lock với booking-service. |
| Refund/exchange policy | Gap | Chủ yếu thuộc booking/payment-service, nhưng movie-service cần cung cấp cutoff và showtime state. |
| Special event/private screening | Gap | Chưa có model policy riêng cho special event. |
| Room maintenance | Partial | Có maintenance, nhưng scheduling phải chặn room unavailable. |
| Audit | Partial | Một số action đã log; status transition cần log nhất quán hơn. |

## Coverage Matrix

### 1. Movie Catalog Và Publish

| BR ID | Business Rule thực tế | Trạng thái | Evidence trong project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-MOV-001 | Movie không nên hiển thị cho customer ngay sau khi tạo/import. | Covered | `MovieStatus.DRAFT`, `PENDING_REVIEW`, `COMING_SOON`, `NOW_SHOWING`; movie tạo/import bắt đầu từ `DRAFT`. | Giữ. Thêm test default status khi create/import. |
| IND-MOV-002 | Movie cần được duyệt trước khi public. | Partial | Có `submitForReview`, `approveMovie`, `rejectMovie`. | Thêm checklist dữ liệu bắt buộc trước `approveMovie`: title, duration, age rating, genre, format, poster, translation. |
| IND-MOV-003 | Customer movie list phải ẩn draft/rejected/suspended/ended. | Partial | `findAllPublic()` trả `COMING_SOON`, `NOW_SHOWING`. | Public detail endpoint cũng phải enforce rule này. |
| IND-MOV-004 | Content bị suspend phải biến mất khỏi luồng bán vé/customer, nhưng vẫn giữ audit. | Partial | Có `SUSPENDED` và `suspendedReason`. | Khi suspend movie, cần block/suspend các showtime liên quan. |
| IND-MOV-005 | Movie đã kết thúc vẫn giữ lịch sử/reporting, không hard delete. | Covered | `deleteMovie()` chuyển status sang `ENDED` và chặn nếu còn future showtime. | Giữ. UI nên đổi label từ delete sang end/archive. |
| IND-MOV-006 | Import trùng movie phải bị chặn. | Covered | `tmdb_id` unique, `TmdbService.importMovie()` check TMDB ID đã tồn tại. | Giữ. Thêm duplicate test. |
| IND-MOV-007 | Các phim trùng tên phải phân biệt bằng năm/version. | Partial | Có `releaseDate`; duplicate guard hiện đang theo title. | Plan rule tốt hơn: import theo TMDB ID, manual create theo `(normalizedTitle, releaseYear)`. |

### 2. Rating Và Điều Kiện Vào Rạp

| BR ID | Business Rule thực tế | Trạng thái | Evidence trong project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-RATE-001 | Movie phải lưu local age rating. | Partial | Có `AgeRating`, `age_rating_id`, TMDB rating mapping. | Bắt buộc age rating trước khi approve/open sale. |
| IND-RATE-002 | Rating Việt Nam nên hỗ trợ `P`, `K`, `T13`, `T16`, `T18`, `C`. | Covered/Partial | Có lookup `AgeRating`; TMDB có map VN/US cert. | Verify seed data có đủ code, và `C` bị chặn public release. |
| IND-RATE-003 | Phim giới hạn độ tuổi cần check tuổi khi mua vé/vào rạp. | Gap trong movie-service | Movie-service mới lưu rating. | Cross-service plan: booking-service check DOB member hoặc employee xác nhận giấy tờ tại quầy. |
| IND-RATE-004 | Một số rating cần người lớn/guardian đi kèm. | Gap | Chưa có guardian/accompaniment model. | Chỉ plan nếu product owner yêu cầu strict age policy. |
| IND-RATE-005 | Một số rạp cấm trẻ quá nhỏ ở phim restricted hoặc suất muộn. | Gap | Chưa có age-by-showtime policy. | Backlog nếu chưa phải yêu cầu chính. |

### 3. Showtime Scheduling

| BR ID | Business Rule thực tế | Trạng thái | Evidence trong project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-SHOW-001 | Một phòng không thể có 2 suất chiếu overlap. | Covered | Có check request và DB bằng `existsByCinemaRoomAndOverlappingTime`. | Giữ. Thêm test overlap và update excluding self. |
| IND-SHOW-002 | End time của showtime phải tính từ duration movie. | Covered | `endTime = startTime.plusMinutes(movie.getDurationMinutes())`. | Giữ. Không lấy end time từ client làm source of truth. |
| IND-SHOW-003 | Showtime phải nằm trong giờ vận hành. | Covered/Partial | Create/update standalone enforce `08:00` đến `23:00`. | Áp dụng rule chặt này cho mọi đường tạo showtime. |
| IND-SHOW-004 | Showtime phải được tạo trước một khoảng thời gian chuẩn bị. | Covered | `showDate >= today + 3 days`. | Giữ; sau này có thể chuyển thành config. |
| IND-SHOW-005 | Chỉ phòng `ACTIVE` mới được schedule. | Gap | Có check room tồn tại, nhưng chưa thấy check room status khi create. | Implement chặn `MAINTENANCE`, `TEMPORARILY_UNAVAILABLE`, `CLOSED`. |
| IND-SHOW-006 | Chỉ movie đã sẵn sàng mới được schedule/open sale. | Gap/Partial | Có movie status, nhưng showtime create chưa enforce rõ. | Cho schedule/open-sale với `COMING_SOON`/`NOW_SHOWING`; chặn `DRAFT`, `REJECTED`, `ENDED`, `SUSPENDED`. |
| IND-SHOW-007 | Showtime bị hủy nên dùng cancel status/reason, không hard delete. | Gap/Partial | Có `CANCELLED`, `cancellationReason`, `cancelledAt`, `cancelledBy`. | Thêm cancel API và rule visibility cho customer. |
| IND-SHOW-008 | Special screening/private event có thể có policy riêng. | Gap | Chưa có field event type/policy. | Backlog: `showtime_type`, `refund_policy_code`, `is_special_event`. |

### 4. Điều Kiện Bán Vé Và Hỗ Trợ Refund

Phần này chủ yếu thuộc booking/payment-service, nhưng movie-service vẫn phải cung cấp dữ liệu showtime chính xác để service khác quyết định.

| BR ID | Business Rule thực tế | Trạng thái | Trách nhiệm của movie-service | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-TKT-001 | Vé thường chỉ refund/exchange trước một cutoff trước giờ chiếu. | Gap | Expose showtime start time/status và optional refund cutoff policy. | Plan với booking-service: `refund_cutoff_minutes` hoặc policy config. |
| IND-TKT-002 | Convenience/platform fee có thể không hoàn. | Out of scope | Movie-service không sở hữu fee. | Rule của booking/payment-service. Movie-service chỉ cung cấp showtime data. |
| IND-TKT-003 | Cancellation window có thể khác theo rạp/event. | Gap | Movie-service sở hữu room/showtime nên có thể gắn policy. | Chỉ thêm policy nếu sprint có scope refund. |
| IND-TKT-004 | Không refund sau khi phim bắt đầu, trừ manager/support override. | Gap | Expose accurate showtime start/end/status. | Booking-service enforce; override phải audit. |
| IND-TKT-005 | Exchange có thể chuyển giá trị vé sang showtime khác nếu policy cho phép. | Gap | Movie-service validate target showtime sellable và còn seat. | Plan sau khi ổn định cancellation/refund MVP. |

### 5. Seat Inventory Và Pricing

| BR ID | Business Rule thực tế | Trạng thái | Evidence trong project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-SEAT-001 | Seat availability phải chống double-selling. | Partial | Có `ShowtimeSeatStatus`, reserved/sold; booking-service cũng có lock. | Chốt một service làm concurrency owner. Nên để booking-service lock transaction, movie-service giữ inventory snapshot. |
| IND-SEAT-002 | Seat reservation phải hết hạn sau một hold window ngắn. | Partial | Movie-service lock 15 phút; booking-service cũng có lock riêng. | Tránh hai hệ lock độc lập. Chốt một TTL và một source of truth. |
| IND-SEAT-003 | Showtime seat phải snapshot seat và price tại thời điểm bán. | Partial | `ShowtimeSeat` lưu `seatCode`, `seatType`, `price`. | Generate snapshot trước khi open sale, không lazy generate lúc customer đầu tiên gọi. |
| IND-SEAT-004 | Premium format/seat type ảnh hưởng đến giá. | Partial | Có `ScreeningFormat.surcharge`, `Seat.price`, `ShowtimeSeat.price`. | Define formula: base price + format surcharge + seat type surcharge + promotion. |
| IND-SEAT-005 | Seat maintenance/blocked không được bán. | Partial | Có `SeatStatus`, `ShowtimeSeatStatus.BLOCKED`. | Khi generate snapshot, inactive/maintenance seat phải bị exclude hoặc mark blocked. |
| IND-SEAT-006 | Sold seat phải gắn với booking/order history. | Partial | Có `ShowtimeSeat.bookingId`. | Tích hợp booking confirmation event/API để mark `SOLD`. |

### 6. Cinema Room Operations

| BR ID | Business Rule thực tế | Trạng thái | Evidence trong project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-ROOM-001 | Room capacity phải bị kiểm soát bởi room type/layout. | Covered | `RoomType.getMaxSeats`, `SEAT_QUANTITY_EXCEEDS_LIMIT`. | Giữ. Thêm test. |
| IND-ROOM-002 | Room maintenance phải làm room unavailable. | Covered/Partial | `reportMaintenance()` set `TEMPORARILY_UNAVAILABLE`. | Đồng thời block showtime mới và cảnh báo future showtime cần xử lý. |
| IND-ROOM-003 | Resolve maintenance chỉ restore room khi không còn issue mở. | Partial | `resolveMaintenance()` check open maintenance records. | Review kỹ logic/biến boolean khi làm MR. |
| IND-ROOM-004 | Future showtime trong room hỏng cần flow cancel/reassign. | Gap | Chưa có reassignment workflow. | Backlog/Plan: room maintenance impact report. |

### 7. Content Và Asset Quality

| BR ID | Business Rule thực tế | Trạng thái | Evidence trong project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-ASSET-001 | Movie customer-facing nên có poster/thumbnail. | Partial | Field tồn tại; upload validation tồn tại. | Bắt buộc trước approval/public release. |
| IND-ASSET-002 | Multiple images hữu ích cho carousel/gallery. | Covered/Partial | Có `MovieImage`. | Đảm bảo API/UI có display order và type/purpose. |
| IND-ASSET-003 | Trailer URL nên được validate. | Gap/Partial | Có `trailerUrl`. | Add URL validation; có thể allowlist YouTube/Vimeo. |
| IND-ASSET-004 | Upload image phải giới hạn type/size. | Covered | JPG/PNG/WebP và limit 5 MB. | Giữ; document thêm Cloudinary limits. |

### 8. Search, Discovery Và Display

| BR ID | Business Rule thực tế | Trạng thái | Evidence trong project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-DISC-001 | Customer filter movie theo now showing / coming soon. | Partial | Có status model. | Đảm bảo customer APIs expose status filter rõ ràng. |
| IND-DISC-002 | Customer filter theo genre/date/cinema. | Partial | Có movie filters và showtime endpoints. | Plan combined discovery API nếu UI cần. |
| IND-DISC-003 | Movie detail nên hiển thị cast/director, language, subtitle, age rating, duration. | Partial | Data nằm ở Movie/Cast/ShowTime. | Đảm bảo response DTO expose field nhất quán. |
| IND-DISC-004 | Search nên hỗ trợ localized title. | Partial | Có translations. | Add search theo `movie_translation.title` nếu chưa có. |

### 9. Audit, Compliance Và Admin Workflow

| BR ID | Business Rule thực tế | Trạng thái | Evidence trong project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-AUD-001 | Publish/reject/suspend/end phải được audit. | Partial | Có `MovieActionLog`, `AuditLogService`; một số create action đã log. | Add log trong mọi status transition method. |
| IND-AUD-002 | Showtime cancel/open-sale phải được audit. | Gap/Partial | Có field showtime nhưng chưa rõ transition API. | Implement explicit API trước, rồi audit. |
| IND-AUD-003 | Admin/leader không nên tự approve thay đổi nhạy cảm nếu workflow team cấm. | Process Gap | MR process docs nằm ngoài movie-service. | Enforce bằng GitLab workflow, không phải service code. |
| IND-AUD-004 | External import source phải trace được. | Partial | Có `tmdb_id`, `imdb_id`. | Nếu có sync feature, thêm `imported_from`, `imported_at`, `last_synced_at`. |

## Plan Ưu Tiên

### Nên Implement Sớm

Các gap này quan trọng nhất cho một hệ thống rạp phim thực tế:

1. Check đủ dữ liệu trước khi public release movie.
2. Public detail endpoint phải chặn movie không public.
3. Chặn tạo showtime cho room inactive/maintenance/closed.
4. Chặn tạo/open-sale showtime cho movie chưa sẵn sàng.
5. Thêm explicit showtime cancel API với reason, actor, timestamp và seat impact.
6. Chốt một source of truth cho seat lock và sold state giữa movie-service và booking-service.
7. Audit đầy đủ mọi movie/showtime status transition.

### Nên Plan Sau Khi Core Flow Ổn Định

1. Refund/cancellation policy model dùng chung với booking-service.
2. Showtime-specific policy cho special event/private screening.
3. Search theo localized title và cast/person.
4. Enforce age rating mạnh hơn cùng booking/user-service.
5. Công thức giá vé gồm format surcharge và seat type surcharge.

### Có Thể Backlog

1. Guardian/accompaniment modeling.
2. Rule cấm trẻ quá nhỏ theo rating/time.
3. Room reassignment workflow khi maintenance incident.
4. TMDB re-sync và data freshness workflow.
5. Dynamic pricing nâng cao theo demand.

## Suggested Issues Nên Tạo

### Issue 1 - Enforce Movie Approval Readiness

Type: Backend

Priority: High

Business value: Ngăn movie thiếu dữ liệu bị public cho customer.

Acceptance criteria:

- `approveMovie` reject movie thiếu required fields.
- Required fields: duration, at least one genre, at least one format, at least one translation, poster/thumbnail, age rating.
- Response dùng business error code, không trả generic 500.
- Unit tests cover case thiếu dữ liệu và approve thành công.

### Issue 2 - Protect Public Movie Detail Endpoint

Type: Backend

Priority: High

Business value: Customer không được truy cập movie `DRAFT/REJECTED/SUSPENDED/ENDED` bằng direct URL.

Acceptance criteria:

- Public detail endpoint chỉ trả `COMING_SOON` hoặc `NOW_SHOWING`.
- Admin detail endpoint vẫn xem được mọi status.
- Tests cover direct access tới `DRAFT`, `REJECTED`, `SUSPENDED`, `ENDED`.

### Issue 3 - Block Showtime Scheduling For Unavailable Rooms

Type: Backend

Priority: High

Business value: Ngăn schedule suất chiếu trong phòng đang maintenance hoặc đã đóng.

Acceptance criteria:

- Create/update showtime reject room không phải `ACTIVE`.
- Error response dùng movie-service business error code.
- Tests cover `MAINTENANCE`, `TEMPORARILY_UNAVAILABLE`, `CLOSED`.

### Issue 4 - Add Showtime Cancel Workflow

Type: Backend

Priority: High

Business value: Rạp thật hủy suất chiếu bằng reason/audit, không xóa mất business record.

Acceptance criteria:

- Add API cancel showtime.
- Lưu `cancellation_reason`, `cancelled_at`, `cancelled_by`.
- Cancelled showtime bị ẩn khỏi customer sellable list.
- Related showtime seats chuyển `CANCELLED` hoặc unavailable.
- Có audit log.

### Issue 5 - Define Seat Inventory Contract With Booking-Service

Type: Backend / Integration

Priority: High

Business value: Ngăn double-selling seat và sai lệch giá vé.

Acceptance criteria:

- Document service nào sở hữu seat lock TTL.
- Document booking confirmation update `ShowtimeSeat` sang `SOLD` như thế nào.
- Document cancellation release/cancel seat như thế nào.
- Update API contract docs.

## Ghi Chú Khi Planning

- Không cần implement tất cả industry rule ngay. Ưu tiên rule bảo vệ public visibility, showtime correctness và seat revenue.
- Age rating quan trọng, nhưng là cross-service: movie-service lưu rating; booking/user/employee flow enforce.
- Refund/exchange policy chủ yếu thuộc booking/payment-service, nhưng movie-service phải cung cấp showtime status và cutoff metadata nếu muốn tự động hóa refund.
- Special event/private screening nên để backlog nếu product owner chưa xác nhận scope.

