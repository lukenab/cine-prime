# Showtime Management — Business Rules

## 1. Phạm vi và thuật ngữ

- **Business date**: ngày vận hành của cụm rạp, dùng để gom kế hoạch; không thay thế timestamp thực tế.
- **Canonical time**: `startAt` và `endAt` kiểu offset-aware, dùng để xác định thứ tự và overlap.
- **Screening version**: phiên bản phát hành cụ thể của phim gồm format, audio language và subtitle language.
- **Candidate**: slot tiềm năng do engine sinh ra.
- **Schedule Plan Slot**: candidate đã được chọn và lưu vào draft plan.
- **Published Showtime**: suất chiếu thật đã materialize sau publish.
- **Partition**: đơn vị thực thi độc lập theo `clusterId + businessDate`.

## 2. Quy tắc eligibility

### ST-BR-001 — Movie content approval

- Chỉ phim có `MovieStatus.APPROVED` mới được đưa vào auto-scheduling.
- Việc approved nội dung không đồng nghĩa phim tự động được chiếu tại mọi cụm rạp.

### ST-BR-002 — Movie availability

- Movie phải có `MovieAvailability` hợp lệ cho đúng movie, cluster và business date.
- Availability bị đóng/suspend hoặc ngoài effective window phải bị loại.

### ST-BR-003 — Classification approval

- Movie phải có classification approval trạng thái approved cho territory của cluster và ngày chiếu.
- Territory mặc định là `VN` nếu cluster chưa có country code.

### ST-BR-004 — Theatrical rights

- Phải tồn tại theatrical license `ACTIVE` bao phủ movie, screening version, territory, cluster và business date.
- License có `clusterId = null` có thể đại diện quyền toàn chuỗi; license gắn cluster chỉ hợp lệ tại cluster đó.
- `validFrom <= businessDate <= validUntil`.

### ST-BR-005 — Screening version

- Candidate phải tham chiếu một `MovieScreeningVersion` cụ thể.
- Version phải active/effective trong ngày chiếu và tương thích format capability của phòng.
- Audio/subtitle/format không được suy đoán lại sau khi plan đã được tạo.

### ST-BR-006 — Cluster, room và layout

Một phòng chỉ được xem là schedulable khi đồng thời:

- Cluster ở trạng thái `ACTIVE`.
- Cinema Room ở trạng thái `ACTIVE`.
- Room có `totalSeatCapacity > 0`.
- Room có đúng layout bán được ở trạng thái `ACTIVE`.
- Layout có `personCapacity > 0` và `sellableUnitCount > 0`.

Cluster không có ít nhất một phòng thỏa các điều kiện trên không được chọn để auto-schedule.

## 3. Quy tắc thời gian và overlap

### ST-BR-007 — Planning horizon

- Date range không được đảo: `startDate <= endDate`.
- Range phải nằm trong `planningHorizonStartDays` và `planningHorizonEndDays` của policy.
- Business timezone mặc định là `Asia/Ho_Chi_Minh`, không phụ thuộc timezone máy chủ.

### ST-BR-008 — Canonical interval

- Interval chuẩn là half-open: `[startAt, endAt)`.
- `endAt` phải lớn hơn `startAt`.
- `endAt` có thể thuộc ngày kế tiếp; hệ thống phải hỗ trợ suất chiếu qua nửa đêm.
- `showDate/startTime/endTime` chỉ là compatibility fields cho client/legacy API.

### ST-BR-009 — Room occupancy

- Hai suất trong cùng room conflict nếu interval thực tế giao nhau.
- Khi validate plan, cleanup buffer được cộng sau `endAt` của suất trước.
- Candidate kế tiếp chỉ hợp lệ khi:

```text
next.startAt >= previous.endAt + cleanupBuffer
```

- Check overlap phải bao gồm cả Showtime đã tồn tại và các slot mới trong cùng plan.

### ST-BR-010 — Operating window

- Candidate phải nằm trong operating hours của cluster/business date.
- Auto-scheduling không được hard-code 08:00–23:00 khi cluster đã có operating schedule.
- Manual legacy flow hiện vẫn còn giới hạn 08:00–23:00; đây là compatibility constraint cần được thống nhất sau P0.

## 4. Quy tắc phân bổ tự động

### ST-BR-011 — Stable input

- Movie IDs, cluster IDs và time candidates phải được normalize theo thứ tự ổn định.
- Candidate scoring phải deterministic khi input và policy snapshot không đổi.

### ST-BR-012 — Minimum coverage first

- Mỗi tổ hợp eligible `(movie, cluster, businessDate)` phải được cấp minimum coverage trước khi tối ưu thêm slot.
- Phân bổ minimum coverage dùng round-robin để phim đứng đầu ranking không lấy hết capacity.
- Required coverage được tính từ policy và demand profile, giới hạn bởi maximum daily shows per movie.

### ST-BR-013 — Fill remaining capacity

- Sau minimum coverage, engine mới chọn thêm candidate theo score/ranking.
- Candidate conflict hoặc vượt policy phải được đưa vào skipped list với stable reason code.

### ST-BR-014 — Post-validation

Sau selection, bắt buộc kiểm tra lại:

- Minimum coverage theo movie/cluster/date.
- Room overlap và cleanup buffer.
- Programming share policy áp dụng.
- Các blocker phải lưu vào `validationSummary` và `blockerCount`.

## 5. Quy tắc tỷ lệ phim Việt

### ST-BR-015 — Effective-dated policy

- Tỷ lệ nội dung không hard-code trong thuật toán; phải đọc từ `ProgrammingSharePolicy` theo market và effective window.
- Measurement basis hỗ trợ:
  - `SHOW_COUNT`: số suất.
  - `SCREEN_MINUTES`: tổng phút chiếu.
- Chỉ phim có `domesticProductionVerified = true` mới được tính là nội dung nội địa.
- Nếu policy `hardEnforcement = true` và tỷ lệ thực tế thấp hơn yêu cầu, plan có blocker và không được publish.

> Seed `VN_PROGRAMMING_2026_V1 = 20%` hiện là internal operational default với source `INTERNAL_PROGRAMMING_POLICY_REQUIRES_LEGAL_CONFIRMATION`. Phải được Legal/Compliance xác nhận hoặc thay thế trước khi dùng như quy định chính thức.

## 6. Quy tắc Generation Run

### ST-BR-016 — Idempotent submit

- Cùng policy + date range + normalized movie scope + normalized cluster scope tạo cùng idempotency key.
- Submit lại cùng scope trả generation run hiện hữu, không tạo run trùng.

### ST-BR-017 — Atomic claim

- Chỉ một worker được chuyển run từ `ACCEPTED` sang `RUNNING`.
- Gọi execute cho run không còn `ACCEPTED` phải an toàn và không chạy lặp business logic.
- Run mới phải được dispatch ngay sau transaction commit; scheduled polling chỉ là recovery fallback.

### ST-BR-018 — Partition isolation

- Partition được xác định bởi `clusterId + businessDate`.
- Một partition persist lỗi không rollback các partition đã thành công.
- Retry không được tạo lại partition đã `SUCCEEDED`.

### ST-BR-019 — Terminal status semantics

| Kết quả | Trạng thái run |
|---|---|
| Tất cả technical partitions thành công | `COMPLETED` |
| Có cả partition thành công và thất bại | `PARTIALLY_COMPLETED` |
| Không có partition usable hoặc pipeline thất bại | `FAILED` |

- Candidate bị business skip không tự động được tính là technical failure.
- Failure detail phải cho biết partition, nguyên nhân gốc và khả năng retry.

## 7. Quy tắc Schedule Plan workflow

### ST-BR-020 — Draft isolation

- Generation chỉ tạo `DRAFT_GENERATED` plan và slots.
- Draft slot không xuất hiện trong customer schedule và không được booking.

### ST-BR-021 — Submit review

- Chỉ `DRAFT_GENERATED` hoặc `CHANGES_REQUESTED` được chuyển sang `IN_REVIEW`.
- Eligibility phải được recheck tại thời điểm submit.
- Lưu `submittedAt`, `submittedBy` và review note.

### ST-BR-022 — Request changes

- Chỉ plan `IN_REVIEW` mới được request changes.
- Plan chuyển sang `CHANGES_REQUESTED` và phải lưu note đủ để người sửa hiểu lý do.

### ST-BR-023 — Publish

- Chỉ plan `IN_REVIEW` mới được publish.
- `blockerCount` phải bằng 0.
- Eligibility phải được recheck ngay trước publish để chống stale plan.
- Mỗi slot được materialize tối đa một Showtime; slot đã có `publishedShowtimeId` phải được bỏ qua.
- Publish plan đã `PUBLISHED` trả kết quả hiện tại, không tạo Showtime trùng.

## 8. Quy tắc Showtime và inventory

### ST-BR-024 — Initial state

- Showtime mới materialize bắt đầu ở `SCHEDULED`, chưa mặc nhiên `ON_SALE`.

### ST-BR-025 — Pricing snapshot

- `basePrice` thuộc Showtime/plan slot và là snapshot cho suất cụ thể.
- Khi cập nhật base price thủ công, chỉ giá của seat inventory chưa booked mới được đồng bộ.

### ST-BR-026 — Seat inventory

- Inventory phải phản ánh active room layout tại thời điểm materialization.
- `totalSeats` phải lấy từ capacity hợp lệ của room/layout, không nhận trực tiếp từ client.
- Couple/Sofa seat group phải được giữ atomic ở lớp inventory/booking.

### ST-BR-027 — Update và delete thủ công

- Update room/date/time phải chạy lại overlap validation.
- Không được hard-delete Showtime tương lai đang còn active dependency.
- Với Showtime đã mở bán, hướng đúng là cancellation lifecycle thay vì delete.

## 9. Permission và audit

### ST-BR-028 — Authorization

- Create/update/delete manual showtime: `ROLE_ADMIN`.
- Submit generation run: `ROLE_ADMIN`.
- Manual `Process now`: `ROLE_SUPER_ADMIN`, hoặc `ROLE_ADMIN` khi profile development/demo hay cấu hình hỗ trợ được bật rõ ràng.
- Get/transition/publish schedule plan: `ROLE_ADMIN`.
- Seat lock endpoint phải yêu cầu authenticated booking context và không nên để public mutation.

### ST-BR-029 — Auditability

- Run lưu `requestedBy`, `startedAt`, `completedAt` và failure detail.
- Plan lưu người submit/publish, timestamp và review note.
- Policy và dữ liệu đầu vào phải có khả năng version/snapshot để tái lập quyết định; hiện đây vẫn là hạng mục cần hoàn thiện sâu hơn ở P1.

## 10. Error cases trọng yếu

| Case | Expected behavior |
|---|---|
| Movie chưa approved | Reject trước khi tạo run |
| Cluster inactive hoặc không có active sellable room/layout | Reject scope |
| Movie không có candidate eligible | HTTP 400 kèm `ineligibleMovies` |
| Date ngoài planning horizon | Reject với invalid generation range |
| License/classification/availability thay đổi sau generation | Chặn submit hoặc publish |
| Plan còn blocker | Chặn publish |
| Invalid state transition | Trả stable domain error |
| Hai request cùng scope | Trả cùng generation run |
| Hai worker execute cùng run | Chỉ một worker claim thành công |
| Một partition lỗi | Giữ partition thành công và set `PARTIALLY_COMPLETED` nếu phù hợp |

## 11. Production gaps cần theo dõi

- Chuẩn hóa manual API sang `startAt/endAt` và screening version, tránh hai temporal contracts tồn tại lâu dài.
- Thêm API/command rõ ràng cho sale lifecycle và cancellation nếu chưa expose đầy đủ.
- Thêm frozen window, manual override, policy snapshot và change penalty.
- Rà soát authorization của `/api/showtimes/{id}/seats/lock`.
- Bổ sung integration test với PostgreSQL exclusion constraint và Booking Service.

## 12. P0 — Production-oriented scheduling safeguards

### ST-BR-030 — Operational eligibility is revalidated

- A room is schedulable only when both the cinema cluster and room are `ACTIVE`.
- The room must have an `ACTIVE` layout with positive `personCapacity` and `sellableUnitCount`.
- The room must explicitly support the selected screening format.
- A maintenance interval uses half-open overlap semantics: `[startedAt, resolvedAt)`. An unresolved interval blocks every later candidate.
- The same operational checks run during candidate generation, persistence, plan review and immediately before publish. A stale draft must not bypass a room/layout/maintenance change.

### ST-BR-031 — Demand and capacity fit

- Demand is estimated independently from the candidate room using movie demand, cluster demand, configured daypart and format priority.
- `expectedAttendance` is a deterministic heuristic for allocation and explainability; it is not a sales forecast or guaranteed attendance.
- Capacity fit penalizes lost demand more strongly than empty seats. The algorithm must not always reward the largest room.
- Every draft slot stores the component scores, expected attendance and room capacity used for its decision.

### ST-BR-032 — Configurable dayparts

- Dayparts and weekday/weekend multipliers are database policy data, not hard-coded application constants.
- The initial policy contains `MORNING`, `AFTERNOON`, `EVENING` and `LATE_NIGHT`, including the cross-midnight late-night interval.
- If no daypart policy exists, the previous peak/off-peak rule is retained as a safe compatibility fallback.

### ST-BR-033 — Multi-room allocation

- `maximumRoomShare` limits the number of rooms occupied by the same movie **concurrently** in one cluster; it does not count every room touched during the whole day.
- Starts of the same movie in different rooms of one cluster must be separated by `sameMovieStaggerMinutes`.
- The selector and the final plan validator enforce both rules independently.

### ST-BR-034 — Existing schedules are frozen in P0

- Automatic generation is insert-only: it never moves, replaces or deletes an existing non-cancelled showtime.
- Existing manual or published showtimes therefore act as frozen occupancy and candidates conflicting with them are rejected.
- Direct slot editing, change penalties, weekly programming plans, forecast snapshots and an optimization solver remain P1 work.
