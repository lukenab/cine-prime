# Showtime Management & Auto-Scheduling — Đặc tả kỹ thuật

Tài liệu này mô tả chi tiết kỹ thuật của tính năng quản lý và tự động xếp suất chiếu, gồm cả
luồng thủ công, thuật toán greedy mặc định (LEGACY), và bộ tối ưu ràng buộc CP-SAT (đang thử
nghiệm). Đọc cùng `FEATURE_BRIEF.md` (mô tả nghiệp vụ ở mức cao) và `API_LIST.md` (mẫu
request/response Postman).

## 1. Kiến trúc tổng quan

Auto Showtime là module nội bộ của `movie-service` (không tách microservice riêng), vì phần lớn
dữ liệu cần thiết (`Movie`, `ScreeningFormat`, `CinemaCluster`, `CinemaRoom`, `Seat`, `ShowTime`)
đã thuộc service này.

```text
Client (Admin UI)
    |
    v
AutoShowtimeGenerationController --(202 Accepted)--> AutoShowtimeGenerationService
    |                                                        |
    | POST /api/schedules/auto-generation-runs               | validate + idempotency + preflight
    |                                                        v
    |                                              ShowtimeGenerationRun (ACCEPTED)
    |                                                        |
    |                                      ApplicationEventPublisher (after-commit)
    |                                                        v
    |                                              AutoShowtimeRunAcceptedEvent listener
    |                                                        v
    |                                              AutoShowtimeRunExecutor.execute()
    |                                                        |
    |          +---------------------------------------------+---------------------------------------------+
    |          v                                              v                                              v
    |  AutoShowtimeCandidateFactory                ScheduleOptimizerResolver                     AutoShowtimePlanValidator
    |  (sinh + lọc candidate cứng)                  (LEGACY | CP_SAT | SHADOW_COMPARE)            (blocker post-validation)
    |                                                        |
    |                                              SchedulePlanDraftService
    |                                              (persist theo partition clusterId+businessDate)
    |
    v
GET /api/schedules/auto-generation-runs/{id}   -- poll status/diagnostics
GET /api/schedule-plans/{id}                    -- xem/duyệt draft
POST /api/schedule-plans/{id}/submit-review
POST /api/schedule-plans/{id}/request-changes
POST /api/schedule-plans/{id}/publish           -- materialize ShowTime
```

Recovery: `AutoShowtimeGenerationScheduler` (fixed-delay) quét các run còn `ACCEPTED` quá hạn
(dispatch bị gián đoạn) và các run `RUNNING` quá 5 phút không có worker sống (orphan sweep) để
đánh dấu `FAILED` thay vì treo vĩnh viễn.

## 2. Mô hình dữ liệu (schema hiện tại, 40 migration)

### 2.1. Bảng cốt lõi cho generation run

| Bảng | Vai trò | Cột đáng chú ý |
|---|---|---|
| `showtime_allocation_policy` | Cấu hình trọng số chấm điểm + solver CP-SAT (1 dòng `active=true` được dùng, mã `DEFAULT`) | `movie_demand_weight`, `cluster_demand_weight`, `time_slot_demand_weight`, `format_demand_weight`, `room_capacity_weight`, `minimum_coverage`, `maximum_room_share`, `planning_horizon_start_days`/`end_days`, `cleanup_buffer_minutes`, `time_slot_interval_minutes`, `same_movie_stagger_minutes`, `peak_start_time`/`end_time`, `business_timezone`, và (V40) `max_solve_time_seconds`, `solver_random_seed`, `solver_search_workers`, `solver_relative_gap`, `solver_log_search_progress`, `max_candidates_per_movie_per_day`, `optimizer_fallback_to_legacy_on_error`, `default_optimizer_mode` |
| `showtime_daypart_policy` | Hệ số nhân theo khung giờ (MORNING/AFTERNOON/EVENING/LATE_NIGHT), riêng ngày thường/cuối tuần | `daypart_code`, `start_time`, `end_time`, `weekday_demand_multiplier`, `weekend_demand_multiplier` |
| `showtime_allocation_format_priority` | Độ ưu tiên định dạng (2D/3D/IMAX...) theo policy | `allocation_priority` |
| `cinema_cluster_demand_profile` | Nhu cầu ước tính theo cụm rạp — **bắt buộc phải có** cho mọi cụm được chọn, thiếu sẽ bị skip `MISSING_DEMAND_PROFILE` | `demand_tier` (chỉ để hiển thị, không ảnh hưởng thuật toán), `demand_score` (0–100, dùng thật), `min_daily_shows`, `max_daily_shows_per_movie` |
| `movie_scheduling_profile` | Độ ưu tiên/độ phổ biến phim | `popularity_score`, `priority_override` |
| `cinema_room_format` | **Nguồn sự thật duy nhất** cho "phòng nào hỗ trợ định dạng nào" — không đọc `cinema_room.supports_2d/3d`/`presentation_system` trực tiếp | `enabled` |
| `movie_screening_version` | Phiên bản chiếu cụ thể (format + audio + subtitle), là cái `ShowTime` thực sự tham chiếu | `status` (ACTIVE/INACTIVE/SUPERSEDED), `effective_from/to` |
| `cinema_room_maintenance` | Khoảng bảo trì phòng, nửa mở `[startedAt, resolvedAt)` | `resolved_at IS NULL` = vẫn đang mở, chặn mọi candidate sau đó |
| `showtime_generation_run` | Snapshot 1 lần request | `idempotency_key` (unique), `status`, `candidate_count`/`created_count`/`skipped_count`, `successful_partition_count`/`failed_partition_count`, và (V40) `optimizer_mode`, `scenario`, `solver_status`, `solve_duration_millis`, `objective_score`, `objective_breakdown`/`solver_diagnostics`/`shadow_comparison` (TEXT, JSON do ứng dụng tự serialize) |
| `showtime_generation_run_movie` / `..._cluster` | Junction scope của run |
| `showtime_generation_partition` | Đơn vị persist atomic: 1 dòng / `(clusterId, businessDate)` |
| `showtime_generation_skip` | Gộp theo `(movie, cluster, reason)` kèm `occurrence_count`, không lưu 1 dòng/candidate |
| `schedule_plan` | Bản nháp cần review | `status`, `blocker_count`, `validation_summary` |
| `schedule_plan_slot` | 1 suất dự kiến | `business_date`, `start_at`/`end_at`, và (V39) `allocation_score`, `daypart_code`, `movie_demand_score`, `cluster_demand_score`, `time_demand_score`, `format_demand_score`, `capacity_fit_score`, `expected_attendance`, `published_showtime_id` |
| `show_time` | Suất chiếu thật | `source` (MANUAL/AUTO), `generation_run_id` (SET NULL khi run bị xóa) |

Migration đã xóa (đừng nhầm là còn tồn tại): `theatrical_license`,
`theatrical_license_screening_version` (V35), `programming_share_policy` (V34),
`movie_classification_approval` (V38), cột `movie.domestic_production_verified` (V34).

### 2.2. Ràng buộc khóa ngoại quan trọng cần nhớ khi thao tác dữ liệu thủ công

```text
movie_screening_version.movie_id     -> movie          ON DELETE RESTRICT
schedule_plan_slot.movie_id          -> movie          ON DELETE RESTRICT
schedule_plan_slot.published_showtime_id -> show_time  ON DELETE RESTRICT
show_time.movie_id                   -> movie          ON DELETE RESTRICT
showtime_generation_run_movie.movie_id -> movie         ON DELETE RESTRICT
schedule_plan.generation_run_id      -> showtime_generation_run ON DELETE RESTRICT
movie_cast.person_id                 -> person          ON DELETE RESTRICT
movie_production_company.company_id  -> production_company ON DELETE RESTRICT
```

Thứ tự xóa an toàn khi cần dọn sạch catalog (không qua API, trực tiếp SQL):
`showtime_seat` → `schedule_plan_slot` → `show_time` → `movie_screening_version` →
`showtime_generation_run_movie` → `movie` (cascade phần còn lại) → `schedule_plan` →
`showtime_generation_run` (cascade partition/skip/junction) → `production_company` → `person`.

## 3. Luồng preflight & idempotency (`AutoShowtimeGenerationService`)

1. Lấy policy `active=true` theo `policyCode=DEFAULT`.
2. Validate `startDate <= endDate` và nằm trong
   `[today + planningHorizonStartDays, today + planningHorizonEndDays]` theo
   `business_timezone` của policy (không dùng timezone server/browser).
3. Nếu `request.replanMode() == true` → từ chối ngay với `AUTO_SHOWTIME_REPLAN_NOT_SUPPORTED`
   (P2 chưa triển khai, không âm thầm bỏ qua).
4. Load `Movie`/`CinemaCluster` theo ID, fail sớm nếu không tồn tại.
5. Tính `idempotencyKey = SHA-256(policyCode|startDate|endDate|sortedMovieIds|sortedClusterIds|optimizerMode|scenario)`.
   Cùng key → trả về run cũ (không tạo run mới). **`optimizerMode`/`scenario` nằm trong key** —
   đổi thuật toán cho cùng scope sẽ tạo run mới, không trả nhầm kết quả cũ.
6. Preflight: dựng `ShowtimeGenerationRun` tạm trong bộ nhớ (chưa lưu DB), gọi
   `AutoShowtimeCandidateFactory.buildRawCandidates()` — movie nào không sinh được candidate nào
   trong toàn bộ scope bị trả về ngay là `ineligibleMovies` (HTTP 400,
   `AUTO_SHOWTIME_SELECTED_MOVIE_NOT_ELIGIBLE`), tránh tạo run rỗng.
7. Lưu `ShowtimeGenerationRun` (status `ACCEPTED`), publish `AutoShowtimeRunAcceptedEvent`
   **sau khi transaction commit** (immediate dispatch); scheduler định kỳ chỉ là fallback khi
   dispatch bị lỡ.

## 4. Pipeline thực thi (`AutoShowtimeRunExecutor`)

```java
claim(runId)                              // atomic ACCEPTED → RUNNING, thua cuộc đua = no-op an toàn
rawCandidates = candidateFactory.buildRawCandidates(run)
optimization  = optimizerResolver.resolveAndOptimize(run, rawCandidates)   // xem §5
persist skip aggregates (group theo movie+cluster+reason)
validation    = planValidator.validate(run, eligibleCandidates, selected)  // xem §5.4
plan          = schedulePlanDraftService.createDraftShell(runId, validation)
partition theo (clusterId, businessDate); mỗi partition persist độc lập,
  1 partition lỗi không rollback partition khác (lỗi ghi ShowtimeGenerationPartition.FAILED)
partitions.isEmpty() → coi là NO_USABLE_PARTITION (technical failure, không phải business skip)
finish(runId, ...)  →  COMPLETED / PARTIALLY_COMPLETED / FAILED
recordOptimizerOutcome(runId, ...)  // ghi solverStatus/objective/diagnostics, transaction riêng
```

### 4.1. Sinh candidate cứng (`AutoShowtimeCandidateFactory`)

Với mỗi `businessDate` trong scope × mỗi cluster × mỗi movie × mỗi `MovieScreeningVersion` hiệu
lực × mỗi phòng có `cinema_room_format.enabled=true` khớp format đó:

1. Bỏ qua nếu cluster không có `CinemaClusterOperatingHour` cho đúng thứ trong tuần, hoặc đóng
   cửa, hoặc thiếu giờ mở/đóng.
2. `SchedulingEligibilityService.evaluate()`: chỉ còn kiểm tra `AVAILABILITY_NOT_OPEN`
   (`movie_availability.status IN (PLANNED, OPEN)`, `showingStartDate <= businessDate <=
   showingEndDate`). **Đã bỏ kiểm tra classification/theatrical-license** (ngoài thẩm quyền dự
   án — dữ liệu cũ chỉ là placeholder do migration sinh ra, không phải phê duyệt thật).
3. Sinh slot theo bước nhảy `time_slot_interval_minutes` từ giờ mở cửa, chỉ giữ slot mà
   `start + movieDuration + cleanupBufferMinutes` vẫn nằm trước giờ đóng cửa.
4. Loại candidate chồng với `CinemaRoomMaintenance` đang mở (nửa mở `[startedAt, resolvedAt)`).
5. Loại candidate chồng với `ShowTime` đã tồn tại trong cùng phòng (kể cả suất thủ công) — đảm
   bảo insert-only, không bao giờ đè suất đã có.

Số liệu thật đo được: 1 phim/1 cụm/2 phòng/6 ngày/lưới 15 phút → **2.142 candidate thô**. Đây là
lý do bước lọc cứng ở trên bắt buộc phải chạy **trước** khi tạo biến CP-SAT, không được tạo tích
Descartes đầy đủ rồi mới lọc.

## 5. Thuật toán phân bổ

### 5.1. Chấm điểm chung (`AutoShowtimeCandidateScorer`) — dùng chung cho cả 2 optimizer

```text
score = movieScore·movieDemandWeight + clusterScore·clusterDemandWeight
      + timeScore·timeSlotDemandWeight + formatScore·formatDemandWeight
      + roomCapacityScore·roomCapacityWeight
```

- `movieScore`/`clusterScore`: chuẩn hóa 0–100 → 0–1 từ `movie_scheduling_profile`/
  `cinema_cluster_demand_profile` (dữ liệu admin nhập tay, chưa phải học từ lịch sử bán vé).
- `timeScore`: tra `showtime_daypart_policy` theo khung giờ + ngày thường/cuối tuần; nếu không
  khớp daypart nào thì lùi về quy tắc peak-window cũ.
- `formatScore`: độ ưu tiên định dạng ÷ độ ưu tiên cao nhất được cấu hình.
- `roomCapacityScore`: **không phải tỷ lệ sức chứa đơn thuần**. Tính `expectedAttendance` (heuristic
  xác định, có thể giải thích, chưa phải dự báo) từ movie/cluster/time/format score × sức chứa
  phòng lớn nhất cụm, rồi phạt cả nhu cầu vượt sức chứa lẫn ghế trống (trọng số ghế trống = 0.5×) —
  cố ý để phòng lớn nhất không luôn luôn "thắng".
- Mỗi candidate được chọn lưu nguyên `ShowtimeScoreBreakdown` (daypart, từng thành phần điểm,
  `expectedAttendance`, sức chứa phòng) để màn hình review không cần tính lại từ policy hiện tại.

### 5.2. LEGACY — greedy 2 vòng (`AutoShowtimeCandidateSelector`)

- Vòng 1 (round-robin): với mỗi `(movie, cluster, businessDate)`, cấp tối thiểu
  `min(max(policy.minimumCoverage, profile.minDailyShows), profile.maxDailyShowsPerMovie)` suất,
  xoay vòng qua từng tổ hợp để phim điểm cao nhất không chiếm hết phòng trước khi phim khác được
  xét.
- Vòng 2: candidate còn lại được xếp theo điểm giảm dần, cấp thêm tới `maxDailyShowsPerMovie`.
- Ràng buộc cứng trong lúc chọn: thiếu demand profile → skip; vượt tỷ lệ phòng đồng thời
  (`exceedsConcurrentRoomShare`, chỉ tính phòng **đang chiếu cùng lúc**, không phải mọi phòng
  chạm trong ngày); cách nhau tối thiểu giữa 2 suất cùng phim khác phòng
  (`sameMovieStaggerMinutes`); chồng giờ sau cleanup buffer trong cùng phòng.

**Giới hạn cố hữu**: mọi ràng buộc/coverage đều tính **theo từng ngày riêng lẻ** — không có khả
năng đánh đổi giữa các ngày trong tuần. Đây là động lực chính để xây CP-SAT.

### 5.3. CP_SAT — tối ưu ràng buộc cả tuần (package `movieservice.service.autoshowtime.optimizer`)

Mô hình toán học:

```text
Biến quyết định: x[movie, version, room, businessDate, startSlot] ∈ {0,1}
  — 1 biến / 1 candidate đã qua lọc cứng ở §4.1, không phải tích Descartes đầy đủ.
```

| Ràng buộc | Cách hiện thực OR-Tools | Phạm vi |
|---|---|---|
| Phòng không chồng giờ | `AddNoOverlap` trên các `IntervalVar` tùy chọn của từng phòng | theo phòng |
| Tỷ lệ phòng đồng thời | `AddCumulative(capacity)` với demand=1/candidate | theo (movie, cluster, ngày) |
| Số suất tối đa/phim/ngày | `Σx ≤ maxDailyShowsPerMovie` | theo (movie, cluster, ngày) |
| Cách nhau giữa 2 suất cùng phim | `AddBoolOr([¬xᵢ, ¬xⱼ])` từng cặp trong cùng nhóm | theo (movie, cluster, ngày) |
| **Minimum coverage theo TUẦN** (khác biệt cốt lõi so với LEGACY) | `Σx (cả tuần) ≥ weeklyMinimum = min(perDayMinimum × số ngày có candidate, tổng candidate)` | theo (movie, cluster), toàn bộ khoảng ngày |
| Mục tiêu mềm vượt mức tối thiểu | biến `shortfall ≥ 0`; `shortfall + Σx ≥ softTarget` | theo (movie, cluster) |

Hàm mục tiêu (hệ số nguyên bắt buộc vì CP-SAT chỉ nhận số nguyên):

```text
maximize: Σ round(candidate.score × 1_000_000) · x
        − Σ round(shortfallPenaltyWeight × 1_000_000) · shortfall
```

Kịch bản (`ScenarioParameters`) chỉ đổi 3 số truyền vào **cùng một** đoạn code, không nhân bản
logic solver:

| Kịch bản | roomShareMultiplier | softTargetMultiplier | shortfallPenaltyWeight |
|---|---|---|---|
| CONSERVATIVE | 0.8 | 1.1 | 0.15 |
| BALANCED | 1.0 | 1.3 | 0.25 |
| REVENUE_FOCUSED | 1.15 | 1.6 | 0.10 |

Cluster thiếu demand profile bị loại **trước khi** dựng biến CP-SAT (không tạo biến vô nghĩa).
Có thể cấu hình `max_candidates_per_movie_per_day` để cắt bớt candidate điểm thấp trước khi giải
(candidate bị cắt vẫn được ghi nhận lý do, không âm thầm biến mất).

**`gapPenalty`/`stabilityPenalty` KHÔNG nằm trong hàm mục tiêu** — chỉ tính hậu-kỳ (sau khi giải
xong) để hiển thị chẩn đoán, vì đưa vào mục tiêu cần thêm biến phụ mà giá trị mang lại chưa
tương xứng ở giai đoạn P1 này. `stabilityPenalty` luôn = 0 vì chưa có khái niệm "kế hoạch trước
đó" — chỉ có ý nghĩa khi rolling replanning (P2) được xây.

Ánh xạ trạng thái solver:

| `CpSolverStatus` | `SolverStatus` (nội bộ) | Ý nghĩa xử lý |
|---|---|---|
| `OPTIMAL` | `OPTIMAL` | Đã chứng minh tối ưu, dùng kết quả |
| `FEASIBLE` | `FEASIBLE` | Hợp lệ nhưng chưa chứng minh tối ưu, vẫn dùng kết quả, `optimalityProven=false` |
| `INFEASIBLE` | `INFEASIBLE` | **Không được** tạo bản nháp rỗng rồi báo thành công — trả về toàn bộ candidate bị từ chối, để `NO_USABLE_PARTITION` xử lý như lỗi kỹ thuật |
| `MODEL_INVALID`/`UNKNOWN` | tương ứng | Xử lý như INFEASIBLE — không bao giờ coi UNKNOWN là tối ưu |

### 5.4. Chế độ chọn optimizer (`ScheduleOptimizerResolver`)

- `LEGACY`: chạy §5.2, luôn trả `SolverStatus.FEASIBLE` (không chứng minh tối ưu/bất khả thi).
- `CP_SAT`: chạy §5.3; nếu solver ném exception (kể cả `Error` như `UnsatisfiedLinkError` — xem
  §7) hoặc trả trạng thái không dùng được, và `optimizer_fallback_to_legacy_on_error=true` (mặc
  định) → tự động chạy lại bằng LEGACY, vẫn ghi nhận trạng thái CP-SAT gốc vào diagnostics.
- `SHADOW_COMPARE`: chạy cả hai trên **cùng** candidate đầu vào; chỉ kết quả LEGACY được lưu/dùng
  thật; kết quả CP-SAT được đính kèm vào `shadowComparison` để so sánh, không bao giờ ghi ra
  Showtime.

### 5.5. Post-validation (`AutoShowtimePlanValidator`)

Chạy lại **trên tập đã chọn cuối cùng** (không phải trong lúc chọn), sinh blocker dạng chuỗi có
cấu trúc để UI parse:

```text
MINIMUM_COVERAGE: movie=<id> cluster=<id> date=<date> required=<n> actual=<n>
ROOM_OVERLAP: room=<id> date=<date>
OPERATIONAL_ELIGIBILITY: room=<id> date=<date> reasons=<comma-separated>
MAXIMUM_CONCURRENT_ROOM_SHARE: movie=<id> cluster=<id> date=<date> max=<n> actual=<n>
SAME_MOVIE_START_STAGGER: movie=<id> cluster=<id> date=<date> required=<n>
```

`blockerCount > 0` chặn publish. `OPERATIONAL_ELIGIBILITY` gọi lại
`SchedulingOperationalConstraintService` để bắt trường hợp phòng/cụm bị đổi trạng thái hoặc bảo
trì **sau khi** đã generate — draft cũ không được phép bỏ qua thay đổi này.

## 6. State machine

### 6.1. `ShowtimeGenerationRun.status`

```text
ACCEPTED --(worker claim)--> RUNNING --(mọi partition OK)--> COMPLETED
                                     --(có OK, có lỗi)-----> PARTIALLY_COMPLETED
                                     --(không partition nào dùng được)--> FAILED
```

Business skip (candidate bị loại vì lý do nghiệp vụ) **không** tự làm run thành
`PARTIALLY_COMPLETED` — chỉ lỗi kỹ thuật khi persist mới tính.

### 6.2. `SchedulePlan.status`

```text
DRAFT_GENERATED --submit-review--> IN_REVIEW --request-changes--> CHANGES_REQUESTED --submit-review--> IN_REVIEW
                                            \--publish (blockerCount=0)--> PUBLISHED (terminal, publish lại = idempotent)
```

### 6.3. `ShowTime.status`

```text
SCHEDULED --(mở bán)--> ON_SALE --(tạm dừng)--> SUSPENDED --(mở lại)--> ON_SALE
                       \--(hủy, cần lý do)--> CANCELLED
                       \--(qua giờ chiếu)--> COMPLETED
```

## 7. Sự cố đã gặp và cách xử lý (đáng đọc trước khi vận hành CP-SAT)

**Run treo vô thời hạn ở `RUNNING` (quan sát thật, run #15, ~2 phút, vượt giới hạn 30s cấu
hình).** Nghi vấn nguyên nhân: OR-Tools nạp thư viện native (JNI, `System.load`) gắn với
classloader tại thời điểm nạp; Spring Boot DevTools hot-reload tạo classloader mới mỗi lần
restart — nạp lại native lib dưới classloader khác ném `UnsatisfiedLinkError`
(`java.lang.Error`, không phải `RuntimeException`). Lỗi này trước đây lọt qua hết các khối catch
(`AutoShowtimeRunExecutor` chỉ bắt `RuntimeException`), thoát khỏi luồng async mà không gọi
`runStateService.fail()` — run đứng yên ở `RUNNING` vĩnh viễn, không ai biết vì sao.

**Đã vá**: `ScheduleOptimizerResolver.runCpSatWithFallback()`/`runShadowCompare()` bắt cả
`RuntimeException | Error`. Native lib lỗi giờ sẽ hoặc rơi về LEGACY (nếu
`optimizer_fallback_to_legacy_on_error=true`) hoặc set `FAILED` nhanh — không còn treo vô thời
hạn. **Chưa có lần chạy thật nào xác nhận bản vá hoạt động đúng** — cần kiểm chứng khi có dữ liệu
catalog để test lại (xem `FEATURE_BRIEF.md` §10).

**Khuyến nghị vận hành**: khi kiểm thử `CP_SAT`, khởi động `movie-service` bằng full restart
(`mvnw spring-boot:run` mới hoặc restart container), tránh dựa vào DevTools hot-reload cho tới
khi xác nhận vấn đề trên không còn tái diễn.

## 8. API tóm tắt

Xem `API_LIST.md` để có mẫu request/response Postman đầy đủ. Điểm khác biệt so với bản trước khi
có CP-SAT:

- `POST /api/schedules/auto-generation-runs` nhận thêm `optimizer` (`LEGACY`/`CP_SAT`/
  `SHADOW_COMPARE`, mặc định theo policy nếu bỏ trống), `scenario` (mặc định `BALANCED`),
  `replanMode` (luôn bị từ chối nếu `true`).
- `GET /api/schedules/auto-generation-runs/{id}` trả thêm `optimizerMode`, `scenario`,
  `solverStatus`, `solveDurationMillis`, `objectiveScore`, và 3 field JSON dạng chuỗi
  (`objectiveBreakdown`, `solverDiagnostics`, `shadowComparison` — field cuối chỉ có khi
  `SHADOW_COMPARE`).

## 9. Cấu hình & vận hành

- Tất cả trọng số/quota nằm trong `showtime_allocation_policy`, **không hard-code trong Java**.
  Hiện chưa có UI/API quản lý bảng này — sửa trực tiếp bằng SQL.
- Migration dùng Flyway, idiom bắt buộc: `ADD COLUMN IF NOT EXISTS` +
  `DROP CONSTRAINT IF EXISTS` rồi `ADD CONSTRAINT` (Postgres không hỗ trợ
  `ADD CONSTRAINT IF NOT EXISTS`) — để migration replay được trên DB đã hand-baseline.
  `out-of-order: true` được bật vì nhiều nhánh song song từng chọn trùng số version.
- OR-Tools (`com.google.ortools:ortools-java`) tải native lib cho mọi platform qua transitive
  dependency — không cần profile riêng theo OS.

## 10. Kiểm thử đã có

- `OrToolsNativeLibrarySmokeTest`: xác nhận native lib nạp và giải được model tối thiểu trên máy
  chạy thật (không phải giả định).
- `CpSatConstraintFactoryPipelineTest`: 3 known-solution test, gồm 1 test chứng minh trực tiếp
  CP-SAT thắng greedy ở kịch bản phân bổ theo tuần (dồn minimum coverage của phim nhu cầu thấp
  vào 1 ngày thay vì ép đều mỗi ngày).
- `FlywayMigrationIntegrationTest`: 40 migration chạy sạch từ DB rỗng, và replay được trên DB đã
  hand-baseline (giả lập trường hợp deploy thật).
- Bộ test service/repository hiện có (302+ test) cho luồng LEGACY, room layout, bulk showtime...
  — 7-8 lỗi còn tồn đọng đã xác minh là **có trước** (không do các thay đổi CP-SAT gây ra, kiểm
  chứng bằng cách chạy lại trên `develop` gốc chưa có thay đổi).
- **Chưa có**: performance benchmark quy mô thật, integration test CP-SAT qua toàn bộ pipeline
  execute→persist→publish với dữ liệu thật (bị chặn bởi sự cố treo run ở §7 và việc catalog vừa
  bị xóa sạch để import lại).
