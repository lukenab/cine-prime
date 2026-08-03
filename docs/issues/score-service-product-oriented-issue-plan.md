# Score Service — Product-oriented issue plan

> Ngày rà soát: 21/07/2026  
> Phạm vi: thiết kế Score Service để thay dữ liệu profile/seed hiện tại bằng điểm demand có thể truy vết, đồng thời cung cấp snapshot an toàn cho Auto Showtime trong `server/movie-service`.  
> Mẫu issue áp dụng: `docs/issues/ISSUE_TEMPLATE.md`  
> Quy ước ưu tiên: **P0 = có dữ liệu điểm đúng và không làm sai lịch**, **P1 = vận hành/reconciliation**, **P2 = tối ưu dự báo**.
>
> Đây là backlog đề xuất, không phải issue đã được tạo/assign. Booking, Movie và Payment là owner độc lập; tài liệu chỉ mô tả contract mà Score Service cần tiêu thụ/cung cấp, không giao việc nội bộ của service khác nếu chưa có owner thống nhất.

## 1. Kết luận ngắn

Score Service nên là **nguồn tính toán demand score**, không phải service tạo showtime và cũng không được đọc trực tiếp database của Booking/Movie. Nó nhận các business event đã được chuẩn hoá từ Booking (và sau này Payment/Search), tổng hợp theo cửa sổ thời gian, tính điểm cho tổ hợp **movie × cinema cluster × ngày/nhóm ngày × time window**, rồi phát hành một **versioned scheduling-score snapshot**.

Movie Service vẫn sở hữu Auto Showtime và quyết định hard constraint: movie availability, format-room compatibility, giờ mở cửa, overlap, cleanup buffer và quota. Trước mỗi generation run, Movie lấy một snapshot score đã hoàn chỉnh, lưu lại `scoreSnapshotVersion`/`asOf` trên run và materialize hai input mà engine hiện dùng. Nhờ vậy một run có thể replay/audit được; Score Service lỗi hoặc điểm mới thay đổi giữa chừng cũng không làm một run dùng lẫn nhiều phiên bản.

Không nên thay seed bằng cách để Movie Service gọi Score Service cho từng candidate. Cách đó vừa tạo N×M remote call, vừa khiến lịch không deterministic. Movie chỉ đọc theo batch **một phiên bản snapshot**, sau đó scorer chạy hoàn toàn local.

## 2. Baseline hiện tại và các khoảng trống cần xử lý

### 2.1. Những gì project đã có

| Thành phần | Hiện trạng đã rà soát | Ý nghĩa với Score Service |
|---|---|---|
| Auto Showtime | `AutoShowtimeCandidateScorer` đọc `MovieSchedulingProfile.popularityScore/priorityOverride`, `CinemaClusterDemandProfile.demandScore`, thời gian peak, format priority và capacity | Đây là consumer đầu tiên của score; cần thay input seed bằng snapshot versioned nhưng không đưa logic score sang Movie. |
| Profile hiện tại | V35/V36 tạo `cinema_cluster_demand_profile`, `movie_scheduling_profile` và `showtime_allocation_policy`; V36 có `score_source = MANUAL/TMDB/DERIVED` | Các bảng này hiện là read model của Movie; không nên tiếp tục là nơi Score Service tự ghi DB chéo. |
| Generation audit | `showtime_generation_run` đã có status/count/audit, showtime có `generation_run_id` | Cần thêm snapshot version và thời điểm dữ liệu để giải thích vì sao một lịch được chọn. |
| Booking | Có `booking`, `booking_detail`, ticket và `PENDING/CONFIRMED/CANCELLED`; module đã có dependency `spring-kafka` | Chưa có outbox/event aggregate chuẩn; đây là nguồn demand thực tế cần được formalize. |
| Giá trị tiền | `BookingService.createBookingAndHoldSeats` đang đặt `seatPrice = 85000`, không có payment-confirmed flow hoàn chỉnh | Chưa được dùng doanh thu hiện tại làm truth. P0 chỉ dùng booking/ticket đã xác nhận sau khi contract lifecycle được chốt; revenue chỉ bật khi Payment/Booking phát hành event authoritative. |

### 2.2. Rủi ro nếu chỉ thay số hard-code bằng query trực tiếp

- `AutoShowtimeCandidateScorer` đang trả `0` khi thiếu profile. Với dữ liệu thật, timeout/thiếu đồng bộ không được phép bị hiểu là phim hoặc rạp “nhu cầu thấp”.
- `CinemaClusterDemandProfile` chỉ có một score aggregate theo cluster; không trả lời được “phim A ở Q9 tối thứ Bảy có nhu cầu bao nhiêu”.
- Không có metric date range, source event, calculation version hay chất lượng dữ liệu; không thể audit hoặc replay.
- Booking hiện giữ seat lock cục bộ và có giá test. Score Service tuyệt đối không suy luận demand từ lock, `PENDING` booking hay ghế hold: đó là ý định tạm thời, dễ bị bot/timeout làm nhiễu.
- Candidate factory hiện có lỗi cần sửa độc lập: nó kiểm tra closing time bằng `endTime.minusMinutes(cleanupBuffer)` thay vì `endTime.plusMinutes(cleanupBuffer)`. Score đúng vẫn có thể sinh suất vượt giờ đóng cửa nếu hard constraint này chưa được sửa.

## 3. Ownership và nguyên tắc bắt buộc

### 3.1. Ownership

| Dữ liệu/capability | Owner | Trách nhiệm của Score Service | Trách nhiệm của Movie Service |
|---|---|---|---|
| Movie lifecycle, availability, format, room, cluster, operating hours | Movie Service | Chỉ cache metadata tối thiểu nếu cần validate ID; không sở hữu/cập nhật lifecycle | Authoritative hard constraints và showtime |
| Booking/ticket lifecycle, seat count, booking cancellation | Booking Service | Tiêu thụ event đã chuẩn hoá, deduplicate và aggregate | Không query `booking_db` |
| Thu tiền/refund thực tế | Payment Service | Tiêu thụ `PAYMENT_CAPTURED`/`REFUND_COMPLETED` khi contract sẵn sàng | Không dùng `booking.totalAmount` giả làm doanh thu chuẩn |
| Raw metric, feature, score, calculation run, snapshot | Score Service | Sở hữu DB, công thức, quality gate, version, API/event phát hành | Chỉ consume snapshot |
| Allocation policy, min coverage, max room share, format priority | Movie Service | Cung cấp feature/score, không tự quyết định quota | Sở hữu policy và selection |

### 3.2. Invariants bắt buộc

- Score Service không có foreign key, join, JPA entity hay SQL query sang `booking_db`/`movie_db`; mọi ID external là reference và mọi metadata cần thiết đi qua contract/event.
- Chỉ event terminal hoặc event có semantic rõ ràng được tính metric: `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `TICKET_USED`, `PAYMENT_CAPTURED`, `REFUND_COMPLETED`. Không tính `PENDING`, seat lock, page view raw chưa dedup.
- Mỗi input event có `eventId`, `eventVersion`, `occurredAt`, `publishedAt`, `correlationId`; inbox unique theo `eventId`. Retry/out-of-order không được làm tăng metric hai lần.
- Score luôn có `scoreVersion`, `calculationRunId`, `windowStart`, `windowEnd`, `asOf`, `qualityStatus`, feature snapshot và reason/explanation tối thiểu.
- Một Auto Showtime run dùng duy nhất một `scoreSnapshotVersion`. Điểm không được đổi ở giữa `Factory -> Scorer -> Selector -> Persist`.
- Score thiếu/stale/degraded là một trạng thái có chủ đích, không map về `0`. Movie Service chỉ được fallback theo policy rõ ràng: snapshot cuối cùng còn hợp lệ hoặc profile MANUAL đã được admin duyệt.
- Score quyết định xếp hạng demand; nó không được bypass format compatibility, availability, opening/closing, cleanup, overlap hay `maximum_room_share`.
- Tất cả timestamp kỹ thuật dùng UTC (`TIMESTAMPTZ`, `Instant`); việc nhóm “ngày chiếu/peak” dùng `Asia/Ho_Chi_Minh` hoặc timezone của cluster do Movie Service cung cấp.

## 4. Luồng mục tiêu

```text
Booking Service ── booking/ticket events ─┐
Payment Service ── captured/refund events ├─> Score Service
Movie Service ── catalog/cluster metadata ┘       │
                                                  ├─ raw event inbox + daily aggregates
                                                  ├─ feature calculation + quality gate
                                                  └─ versioned scheduling-score snapshot
                                                             │
                                     score snapshot event / batch internal API
                                                             │
Movie Service ── materialize profile snapshot ──> generation run pins score version
                                                             │
                   hard constraints -> candidate -> local score/rank -> quota -> showtimes
```

### 4.1. Hai đường tích hợp, một nguồn dữ liệu

1. **Đường chính (push):** Score publish `scheduling.score-snapshot-published`; Movie consumer idempotent lưu snapshot vào read model local. Đây là đường nhanh, không làm job schedule phụ thuộc network.
2. **Đường đối soát/fallback (pull):** trước khi chạy một `ACCEPTED` run, Movie gọi một batch internal API của Score với scope movie/cluster/date. Response trả nguyên một `snapshotVersion`; Movie chỉ pin version này nếu `qualityStatus=READY`. Nếu event bị mất, Movie chủ động sync lại. Không gọi API cho từng candidate.

Hai đường phải trả cùng payload/version. Pull không cho Score gọi ngược sang Movie để tạo showtime.

### 4.2. Mức độ hạt dữ liệu

P0 nên phát hành ba mức score, để engine hiện tại có thể dùng ngay và vẫn có đường nâng cấp:

| Grain | Field chính | Mục đích |
|---|---|---|
| Movie global | `movieDemandScore` | Thay `movie_scheduling_profile.popularity_score` khi chưa đủ lịch sử theo rạp. |
| Cluster global | `clusterDemandScore` | Thay `cinema_cluster_demand_profile.demand_score`. |
| Movie × cluster × service date × time window | `demandScore`, `predictedOccupancy`, `confidence` | Dùng để thay phép cộng độc lập movie+cluster và cố định peak/off-peak khi Auto Showtime được nâng cấp. |

Time window P0 nên là bucket cấu hình, ví dụ `MORNING`, `AFTERNOON`, `EVENING_PEAK`, `LATE`; không dùng giờ phút đơn lẻ để tránh sparse data. `formatId` là dimension P1, chỉ thêm sau khi booking event có format/showtime metadata đáng tin cậy.

## 5. Mô hình điểm đề xuất

### 5.1. Metric đầu vào

Trong rolling window 28 ngày, so sánh cùng thứ trong tuần/khung giờ với baseline 8 tuần trước (khi đủ dữ liệu):

```text
confirmedSeats          = sum(seatCount của BOOKING_CONFIRMED)
netRevenue              = capturedAmount - completedRefundAmount
occupancyRate           = confirmedSeats / sum(showtimeCapacity)
repeatDemand            = số customer distinct đã confirm (tuỳ policy privacy)
cancellationRate        = cancelledConfirmedSeats / confirmedSeats
recency                 = decay theo ngày, recent event có trọng số cao hơn
```

`occupancyRate` chỉ tính khi Score nhận được `showtimeCapacity` snapshot từ Movie hoặc event lịch chiếu. Nếu chưa có denominator đáng tin cậy, feature này là `UNKNOWN`, không mặc định `0`.

### 5.2. Công thức P0: rule-based, giải thích được

Chuẩn hoá mỗi feature về `0..100`, winsorize để một blockbuster không chi phối toàn bộ. Điểm đề xuất:

```text
baseDemand =
  0.35 * normalizedConfirmedSeats
  + 0.25 * normalizedOccupancy
  + 0.20 * normalizedNetRevenue
  + 0.10 * normalizedRecency
  + 0.10 * normalizedRepeatDemand

penalty = 0.15 * normalizedCancellationRate

rawScore = clamp(baseDemand - penalty, 0, 100)
finalScore = confidence * rawScore + (1 - confidence) * fallbackScore
```

- `fallbackScore`: profile MANUAL đã duyệt hoặc `50` **chỉ khi policy quy định**, không phải `0` ngầm định.
- `confidence`: tăng theo số ngày có dữ liệu, số confirmed seats và độ mới của data; ví dụ `LOW/MEDIUM/HIGH` dùng cho policy, không expose một xác suất giả chính xác.
- `priorityOverride` vẫn là quyết định vận hành của Movie. Nó phải được ghi reason `MANUAL_OVERRIDE`, có expiry/review date và được áp sau score derived, không bị Score tự ghi đè.

P0 không dùng ML. Khi metric đủ ổn định, P2 mới thay `rawScore` bằng model dự báo occupancy; output contract, quality gate và snapshot version giữ nguyên để Movie không cần đổi integration.

### 5.3. Quality gate

Snapshot chỉ ở `READY` khi toàn bộ điều kiện policy thỏa, ví dụ:

- lag event tối đa 30 phút;
- không có duplicate/error rate vượt ngưỡng;
- window có tối thiểu N ngày hoặc được đánh `BOOTSTRAP` rõ ràng;
- catalog/cluster references trong scope vẫn hợp lệ;
- metric reconciliation không âm hoặc vượt biên vô lý.

Các trạng thái: `READY`, `BOOTSTRAP`, `STALE`, `DEGRADED`, `FAILED`. Movie chỉ chạy auto generation với `READY` hoặc `BOOTSTRAP` được policy cho phép; `STALE/DEGRADED` phải giữ snapshot last-known-good hoặc chỉ tạo minimum coverage theo manual fallback, đồng thời audit lý do.

## 6. Roadmap và thứ tự triển khai

| Thứ tự | ID | Priority | Estimate | Mục tiêu |
|---:|---|---|---|---|
| 1 | SC-P0-00 | P0 | L | Chốt ownership, semantic event và Score DB baseline |
| 2 | SC-P0-01 | P0 | XL | Booking phát outbox event terminal, không dùng lock/pending |
| 3 | SC-P0-02 | P0 | XL | Score inbox, aggregate, calculation run và snapshot versioned |
| 4 | SC-P0-03 | P0 | L | Rule-based scoring + quality gate + admin/audit query |
| 5 | SC-P0-04 | P0 | XL | Contract Score → Movie và materialized read model/pinned run |
| 6 | SC-P0-05 | P0 | L | Sửa engine để dùng snapshot, kiểm thử end-to-end và sửa hard-constraint cleanup |
| 7 | SC-P1-01 | P1 | L | Reconciliation, replay/backfill và observability |
| 8 | SC-P1-02 | P1 | L | Bổ sung time-window/format score và Payment revenue authoritative |
| 9 | SC-P2-01 | P2 | XL | Forecast/adaptive scheduling có guardrail |

### 6.1. Kế hoạch làm song song khi Booking và Payment chưa hoàn thành

Score Service không nên chờ Booking/Payment code xong mới bắt đầu. Tách công việc thành **đường không phụ thuộc dữ liệu thật** và **điểm bàn giao contract**. Mục tiêu là khi Booking phát event đầu tiên, Score chỉ cần bật consumer/replay thay vì mới bắt đầu thiết kế schema hay sửa Auto Showtime.

| Giai đoạn | Bạn/Score Service làm ngay | Booking/Payment cần bàn giao | Kết quả có thể demo |
|---|---|---|---|
| A — Foundation | Tạo `score-service`, `score_db`, migration inbox/aggregate/snapshot/run; định nghĩa event DTO và OpenAPI internal resolve | Chỉ cần review/đồng ý event schema, chưa cần code | Có API resolve snapshot `BOOTSTRAP` từ fixture/manual profile |
| B — Calculation | Viết consumer idempotent, aggregate, rule calculator, quality state, calculation scheduler; dùng JSON fixture/replay local | Booking chốt semantic `CONFIRMED/CANCELLED`, Payment chốt `CAPTURED/REFUND` | Gửi duplicate/late fixture vẫn ra score đúng, snapshot có version |
| C — Movie integration | Movie typed client, local read model, pin `scoreSnapshotVersion` trên generation run; engine dùng snapshot local | Không cần event thật, chỉ cần Score API chạy | Auto Showtime dùng score từ Score Service thay seed DB, vẫn chạy bằng bootstrap data |
| D — Booking go-live | Bật Kafka consumer, monitor inbox/lag; chạy backfill/replay dữ liệu được Booking cung cấp | Booking triển khai outbox `BOOKING_CONFIRMED`, `BOOKING_CANCELLED` và metadata showtime | Score chuyển `BOOTSTRAP` sang `READY` theo confirmed seats thực tế |
| E — Payment enrichment | Bật revenue feature, refund correction và reconciliation | Payment triển khai `PAYMENT_CAPTURED`, `REFUND_COMPLETED` | Score có net revenue; không còn dùng amount test từ Booking |

#### Work package đề xuất cho bạn ngay bây giờ

1. **Chốt contract trước code (0.5–1 ngày).** Gửi Booking/Payment một event JSON chung và chốt rõ event nào là terminal. Không chờ họ implement; chỉ cần thống nhất `eventId`, `bookingId`, `showtime` snapshot, `seatCount`, timestamp, cancellation/refund reference.
2. **Tạo Score Service và schema (1 ngày).** Làm SC-P0-00: inbox, daily aggregate, calculation run và immutable snapshot. Setup Kafka consumer nhưng chạy bằng test topic/fixture.
3. **Làm calculation với fixture (1–2 ngày).** Chuẩn bị dữ liệu JSON gồm booking confirmed, duplicate, cancellation, event đến trễ; tính score 0–100, confidence và `BOOTSTRAP/READY/STALE`. Không dùng dữ liệu DB Booking.
4. **Kết nối Movie trước (1–2 ngày).** Implement batch API `POST /internal/scheduling-score-snapshots:resolve`; sửa Movie để pin snapshot version rồi đưa score local vào `AutoShowtimeCandidateScorer`. Ban đầu trả bootstrap score từ fixture/manual profile.
5. **Làm contract test với Booking/Payment (song song).** Test producer payload của họ với consumer của bạn bằng JSON/schema test. Khi service khác merge, bạn chỉ bật outbox/topic/config và chạy replay.
6. **Bật dữ liệu thật theo hai bước.** Booking xong trước thì tính `confirmedSeats`/cancel rate/occupancy; Payment chưa xong thì revenue vẫn `UNKNOWN`. Payment xong mới bật `netRevenue` weight bằng feature flag.

#### Điểm chờ và điều kiện handoff tối thiểu

| Dependency | Không cần chờ để bắt đầu | Chỉ chờ khi nào? | Handoff tối thiểu cần nhận |
|---|---|---|---|
| Movie Service | Không; Auto Showtime, movie/cluster IDs và profile hiện đã tồn tại | Khi tích hợp run pin snapshot | Service credential + chỗ thêm score version/read model; không cần Movie đổi thuật toán ngay từ đầu |
| Booking Service | Không; dùng fixture và bootstrap score | Trước khi score được gắn `READY` từ demand thật | Outbox/event `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`; `showtimeId/movieId/clusterId/serviceDate/seatCount` trong payload |
| Payment Service | Không; để revenue feature `UNKNOWN` | Trước khi dùng doanh thu trong công thức | Event `PAYMENT_CAPTURED`, `REFUND_COMPLETED`, amount/currency/payment/booking reference |
| Lịch sử dữ liệu | Không; dùng `BOOTSTRAP` + manual profile | Trước khi tin score derived ở mức `HIGH` confidence | Backfill event hoặc daily aggregate có định nghĩa nhất quán |

**Nguyên tắc triển khai:** chưa có Booking thật thì score chỉ được dùng như `BOOTSTRAP`, có manual fallback/audit; không được tuyên bố đó là demand thực tế. Booking xong không đồng nghĩa phải chờ Payment: bạn đã có thể chạy score bằng số ghế confirmed và occupancy, sau đó thêm doanh thu một cách độc lập.

---

# SC-P0-00 — [Docs/Database] Define Score Service ownership, event semantics and schema baseline

**Labels:** `Layer::Database`, `Type::Feature`, `Priority::High`

## Summary / Objective

Tạo Score Service database độc lập và data contract registry trước khi viết thuật toán. Schema phải lưu được raw event đã deduplicate, aggregate theo thời gian, feature, calculation run và snapshot; không sao chép bảng booking/showtime thành nguồn truth thứ hai.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Bổ sung module `server/score-service`, database `score_db`, migration versioned và init script; không dùng `ddl-auto=update` cho production.
- [ ] Có các bảng tối thiểu: `score_event_inbox`, `demand_metric_daily`, `demand_feature_snapshot`, `score_calculation_run`, `scheduling_score_snapshot`, `scheduling_score_snapshot_item`, `score_consumer_offset` hoặc cơ chế tương đương.
- [ ] `score_event_inbox.event_id` unique; lưu event type/version, occurred/published/received timestamp, source, correlation ID, canonical payload hash và trạng thái parse/process.
- [ ] Item snapshot unique theo `(snapshot_version, movie_id, cluster_id, service_date, time_window, format_id nullable)`; có `score`, `confidence`, `quality_status`, feature/explanation JSON có schema version.
- [ ] Không có cross-database FK đến Booking/Movie/Payment; ID external chỉ là scalar reference và event payload được snapshot tối thiểu.
- [ ] Tất cả timestamp kỹ thuật dùng `TIMESTAMPTZ`/`Instant`, money dùng `NUMERIC`, score dùng `NUMERIC(5,2)` và constraint `0..100`.
- [ ] Document quyết định semantic cho event: event nào tăng/giảm seat, revenue, cancel/refund; event nào không được tính.
- [ ] Có retention policy: raw inbox có thể archive; aggregate/snapshot phải giữ đủ để giải thích generation run còn được retention.

## Technical Notes / Constraints

- `eventId` là identity của producer, không tạo bằng hash payload ở consumer.
- Một `BOOKING_CONFIRMED` phải có seat count, movieId, clusterId, showtimeId, show date/time window snapshot; Score không gọi Movie sau này để “đoán lại” lịch sử.
- Nếu Payment chưa authoritative, `netRevenue` phải có trạng thái `UNAVAILABLE`; không lấy `Booking.totalAmount` test làm doanh thu.

## Related

- Branch: `feat/score-service-baseline`
- Blocks: `SC-P0-01`, `SC-P0-02`, `SC-P0-03`
- Docs: `docs/api-specs/movie-service/AUTO_SHOWTIME_API_CONTRACT.md`

---

# SC-P0-01 — [Backend] Publish authoritative booking demand events through outbox

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Booking Service phát semantic event durable cho những chuyển trạng thái làm thay đổi demand. Score Service chỉ consume event này; không poll hoặc đọc trực tiếp `booking_db`, không tính seat hold/PENDING booking.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Chốt và triển khai outbox cùng transaction với transition `CONFIRMED`, cancellation đã hoàn tất và ticket used nếu lifecycle hiện hành hỗ trợ; publisher Kafka retry nhưng không publish duplicate semantic effect.
- [ ] Chưa phát `BOOKING_CONFIRMED` từ `createBookingAndHoldSeats`, vì method đó hiện tạo booking `PENDING` và lock 10 phút.
- [ ] Event chứa identity/snapshot tối thiểu: `eventId`, `eventType`, `eventVersion`, `bookingId`, `showtimeId`, `movieId`, `clusterId`, `cinemaRoomId`, `formatId`, `serviceDate`, `timeWindow`, `seatCount`, `occurredAt`, `correlationId`.
- [ ] Cancellation/refund event tham chiếu booking/event gốc để Score trừ đúng metric một lần; không gửi số âm mơ hồ.
- [ ] Event contract có versioning/backward compatibility và contract test với Score consumer.
- [ ] Cùng booking transition retry hoặc relay restart không làm Score tăng confirmed seats/revenue hai lần.

## Event contract Booking Service publishes

Topic đề xuất: `booking.demand-events.v1`, key = `bookingId`.

```json
{
  "eventId": "5c0fb6a7-7e4f-4de0-98c9-f05e0376e247",
  "eventType": "BOOKING_CONFIRMED",
  "eventVersion": 1,
  "occurredAt": "2026-07-21T08:20:00Z",
  "publishedAt": "2026-07-21T08:20:02Z",
  "correlationId": "booking-1b9d",
  "bookingId": "booking-1b9d",
  "showtime": {
    "showtimeId": 55,
    "movieId": 2,
    "clusterId": 7,
    "cinemaRoomId": 3,
    "formatId": 1,
    "serviceDate": "2026-07-25",
    "startTime": "19:00:00",
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "seatCount": 2,
  "amount": null,
  "currency": "VND"
}
```

`amount: null` là hợp lệ cho P0 trước khi Payment contract được bật. Score phải phân biệt `unknown` với `0`.

## Technical Notes / Constraints

- Kafka dependency đã có trong booking-service nhưng chưa đủ để bảo đảm transactional outbox; không gọi Kafka trực tiếp trong business transaction rồi coi đó là reliable.
- Hợp đồng này phụ thuộc việc Booking/Movie inventory contract trả metadata showtime/seat authoritative thay cho `seatCode = seatId` và `seatPrice = 85000` đang có.
- Service credential/internal endpoint phải được tách với member JWT; raw PII customer không được đưa vào topic score.

## Related

- Branch: `feat/booking-demand-outbox`
- Depends on: `SC-P0-00`, Booking payment/inventory lifecycle owner
- Blocks: `SC-P0-02`

---

# SC-P0-02 — [Backend] Build idempotent metric aggregation and scheduling snapshot pipeline

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Score Service tiêu thụ demand events idempotently, aggregate theo calendar nghiệp vụ và phát hành snapshot immutable. Pipeline phải xử lý retry, event tới trễ và replay mà không làm thay đổi snapshot đã được Movie pin cho generation run cũ.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Consumer validate schema/event version, persist inbox trước khi mutate aggregate và deduplicate theo `eventId`.
- [ ] Aggregate tối thiểu theo `movieId + clusterId + serviceDate + timeWindow`; global movie/cluster score có thể được roll-up từ cùng aggregate, không tạo hai phép tính độc lập thiếu nhất quán.
- [ ] Xử lý event out-of-order/late trong allowed lateness; calculation run có thể recompute cửa sổ bị ảnh hưởng thay vì cộng trừ lặp không kiểm soát.
- [ ] Mỗi calculation tạo `snapshotVersion` immutable, trạng thái `DRAFT/READY/BOOTSTRAP/STALE/DEGRADED/FAILED` và checksum/scope rõ ràng.
- [ ] Snapshot `READY` chỉ publish sau transaction commit; duplicate publisher retry dùng cùng `snapshotVersion`/event ID.
- [ ] Có scheduler chạy định kỳ và endpoint admin nội bộ để recompute một date range có audit requester/reason.
- [ ] Có test: duplicate event, cancel trước confirm, late cancel, restart giữa inbox/aggregate, replay cùng event range, and snapshot immutability.

## Technical Notes / Constraints

- Group service date bằng timezone trong event (`Asia/Ho_Chi_Minh`), không bằng timezone JVM/server.
- Thứ tự event Kafka theo `bookingId` không giải quyết được out-of-order giữa booking/refund khác nhau; aggregate phải idempotent theo event identity.
- Snapshot history không được update in-place khi đã được Movie dùng. Tạo version mới và để Movie chọn/pin theo policy.

## Related

- Branch: `feat/score-metric-snapshots`
- Depends on: `SC-P0-00`, `SC-P0-01`
- Blocks: `SC-P0-03`, `SC-P0-04`

---

# SC-P0-03 — [Backend] Implement explainable demand scoring, quality gates and audit APIs

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Tính score rule-based từ aggregate đã chuẩn hoá, có confidence, fallback và explanation. Mục tiêu là thay seed cứng bằng số liệu đúng nghiệp vụ nhưng vẫn cho operation biết score đến từ đâu và có được phép dùng cho scheduling không.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Công thức, trọng số, rolling window, recency decay, outlier cap và threshold quality được version trong `score_calculation_run`; thay config không làm lịch sử đổi nghĩa.
- [ ] Score output trả raw/final score, confidence, quality status, source window, calculation version và top feature contributions; không chỉ trả một `double`.
- [ ] Bootstrap không đủ lịch sử dùng explicit fallback `MANUAL_PROFILE` hoặc `NEUTRAL_POLICY`, mang `qualityStatus=BOOTSTRAP`; không map missing data về score `0`.
- [ ] Rule kiểm tra data lag, metric âm, spike bất thường, sample size thấp; trạng thái không đạt quality không được publish là `READY`.
- [ ] API admin đọc snapshot/calculation run, filter movie/cluster/date, pagination; API internal batch chỉ mở cho Movie Service credential.
- [ ] Unit test cover input 0, missing revenue, cancellation high, stale data, outlier, fallback và deterministic same input -> same score.

## API Specifications

### API 1 — Movie Service lấy snapshot batch

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/internal/scheduling-score-snapshots:resolve` |
| Description | Resolve một snapshot nhất quán cho scope generation, không tính lại mỗi candidate. |
| Auth Required | Service-to-service: Movie Service only |

```json
{
  "serviceDates": ["2026-07-25"],
  "movieIds": [2, 4],
  "clusterIds": [7],
  "requiredQuality": "READY",
  "businessTimezone": "Asia/Ho_Chi_Minh"
}
```

```json
{
  "code": 1000,
  "result": {
    "snapshotVersion": "ss-20260721T083000Z-0042",
    "qualityStatus": "READY",
    "asOf": "2026-07-21T08:30:00Z",
    "items": [
      {
        "movieId": 2,
        "clusterId": 7,
        "serviceDate": "2026-07-25",
        "timeWindow": "EVENING_PEAK",
        "movieDemandScore": 83.40,
        "clusterDemandScore": 76.10,
        "demandScore": 88.20,
        "confidence": "HIGH",
        "qualityStatus": "READY",
        "calculationVersion": "rule-v1"
      }
    ]
  }
}
```

| Condition | HTTP | Error response |
|---|---:|---|
| Caller không phải Movie Service | 403 | `{ "code": 5206, "message": "UNAUTHORIZED_SERVICE" }` |
| Không có snapshot bao phủ toàn scope | 409 | `{ "code": 5207, "message": "SCORE_SNAPSHOT_NOT_READY", "result": { "missingMovieClusterDates": [...] } }` |
| Snapshot có nhưng stale/degraded so với quality yêu cầu | 409 | `{ "code": 5208, "message": "SCORE_SNAPSHOT_QUALITY_NOT_ACCEPTABLE", "result": { "status": "STALE" } }` |
| Request scope/timezone không hợp lệ | 400 | `{ "code": 5209, "message": "INVALID_SCORE_RESOLUTION_SCOPE" }` |

## Related

- Branch: `feat/score-demand-calculation`
- Depends on: `SC-P0-02`
- Blocks: `SC-P0-04`

---

# SC-P0-04 — [Backend] Integrate versioned Score snapshots into Movie Service scheduling inputs

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Movie Service consume score snapshot qua typed internal client/event consumer, materialize local read model và pin version trên generation run. Không cho Score Service ghi trực tiếp `movie_scheduling_profile` hay `cinema_cluster_demand_profile` trong `movie_db`.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Có typed `ScoreServiceClient` và service credential; không forward admin/member JWT sang Score Service.
- [ ] Bổ sung migration Movie: `showtime_generation_run.score_snapshot_version`, `score_snapshot_as_of`, `score_quality_status`, `score_resolution_source`; index/audit phù hợp.
- [ ] Có local read model theo snapshot version hoặc mapping rõ từ `scheduling_score_snapshot_item` sang `MovieSchedulingProfile`/`CinemaClusterDemandProfile`; update có idempotency theo version/item key.
- [ ] Khi submit/execute run, Movie resolve **một batch snapshot** bao phủ toàn scope. Nếu `READY` không đủ coverage, fail/hold run theo policy rõ ràng, không thầm dùng `0`.
- [ ] `AutoShowtimeCandidateScorer` nhận score data local của version đã pin, không query remote trong stream candidate.
- [ ] MANUAL `priorityOverride` còn hiệu lực có precedence được document: chỉ override movie score, có audit/expiry, không xoá snapshot derived.
- [ ] Consumer event `scheduling.score-snapshot-published` và pull resolve trả cùng version/payload; test event mất rồi pull reconciliation.

## Technical Notes / Constraints

- Để giảm scope P0, Movie có thể materialize `movieDemandScore` vào `movie_scheduling_profile.popularity_score` với `scoreSource=DERIVED` và cluster score vào profile hiện có, nhưng phải lưu snapshot version/time riêng; đây chỉ là cache/read model, không là owner.
- P0 scorer hiện cộng các score global và time score peak cố định. Khi có `movie×cluster×timeWindow` item, tạo adapter/feature flag để chuyển từng phần, không đổi toàn bộ quota cùng lúc.
- `showtime_generation_run` idempotency key hiện chỉ gồm policy/date/movie/cluster. Cần quyết định rõ: retry cùng scope phải dùng run/snapshot cũ; muốn dùng score mới phải tạo explicit re-generation request/version, không overwrite kết quả cũ.

## Related

- Branch: `feat/movie-score-snapshot-integration`
- Depends on: `SC-P0-03`, Movie Service owner
- Blocks: `SC-P0-05`

---

# SC-P0-05 — [Backend] Make Auto Showtime consume pinned score snapshots safely

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Hoàn tất đường đi từ score snapshot đến allocation engine và sửa các hard-constraint hiện có có thể làm score tốt sinh lịch sai. Mục tiêu không phải viết lại generator; chỉ bảo đảm score thật đi vào đúng vị trí, deterministic và không phá safety constraint.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] `AutoShowtimeCandidateScorer` dùng score snapshot đã pin cho movie/cluster/time window và ghi `calculationVersion`/reason vào run audit hoặc candidate explanation.
- [ ] Không có remote I/O trong `scoreAndRank`; thiếu item được xử lý bằng fallback policy có audit `SCORE_FALLBACK_USED`.
- [ ] Sửa closing-time validation ở `AutoShowtimeCandidateFactory`: điều kiện phải kiểm `endTime + cleanupBuffer <= closesAt`, không dùng `minusMinutes`.
- [ ] Test với cùng snapshot/scope chạy hai lần có cùng ranking và không tạo duplicate; snapshot mới chỉ ảnh hưởng run mới.
- [ ] Test với high score nhưng room/format/availability không hợp lệ: candidate vẫn bị loại trước scoring.
- [ ] Test 10 room/4 movie: hot movie được ưu tiên theo score, movie thường vẫn đạt minimum coverage, max room share và cleanup không bị vi phạm.
- [ ] Response GET generation run có `scoreSnapshotVersion`, `asOf`, quality/fallback indicator để QA giải thích kết quả.

## Related

- Branch: `fix/auto-showtime-pinned-score`
- Depends on: `SC-P0-04`
- Docs: `docs/api-specs/movie-service/AUTO_SHOWTIME_API_CONTRACT.md`

---

# SC-P1-01 — [Backend] Add reconciliation, replay and score observability

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Cho phép vận hành đối soát Score với Booking/Payment aggregate đã được owner công bố, replay event an toàn và phát hiện snapshot stale/degraded trước khi ảnh hưởng scheduling.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Có daily aggregate contract từ Booking/Payment để so sánh count/amount theo date và phát hiện drift.
- [ ] Replay theo topic offset/date range có `replayRunId`, dry-run, immutable output và không overwrite snapshot đã pinned.
- [ ] Dashboard/metric tối thiểu: consumer lag, duplicate rate, invalid event rate, last READY snapshot, score distribution, fallback rate và score-to-occupancy error khi actual data có mặt.
- [ ] Alert khi score snapshot stale, quality degrade, aggregate drift hoặc snapshot coverage không đủ planning horizon.
- [ ] Admin override có creator/reason/expiry/audit; không có endpoint cho UI sửa raw score derived trực tiếp.

## Related

- Branch: `feat/score-reconciliation-observability`
- Depends on: `SC-P0-02`, `SC-P0-04`

---

# SC-P1-02 — [Backend] Enrich score with time-window, format and authoritative payment revenue

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Bổ sung signal để score phản ánh nhu cầu thật theo khung giờ và format, đồng thời đưa doanh thu/refund từ Payment Service vào sau khi payment lifecycle đã authoritative.

## Estimate

L (4–8h)

## Acceptance Criteria (Definition of Done)

- [ ] Payment publish `PAYMENT_CAPTURED` và `REFUND_COMPLETED` idempotent, reference booking/showtime, amount/currency/payment ID; Score chỉ dùng event này cho net revenue.
- [ ] Snapshot item hỗ trợ `timeWindow`/`formatId`; sparse bucket có backoff về movie-cluster/global score và confidence giảm rõ ràng.
- [ ] Movie scorer map candidate start time sang timezone/bucket chung với Score; peak config không mâu thuẫn với score window.
- [ ] Có báo cáo calibration: score range vs actual occupancy/net revenue theo movie/cluster/window.

## Related

- Branch: `feat/score-time-window-revenue`
- Depends on: Payment Service contract, `SC-P1-01`

---

# SC-P2-01 — [Backend] Add forecast-driven adaptive scheduling with guardrails

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::Low`

## Summary / Objective

Khi data quality đã ổn định, thay rule score bằng forecast occupancy/revenue nhưng giữ nguyên snapshot contract. Adaptive re-plan chỉ áp dụng cho suất xa giờ chiếu, chưa bán/hold và phải có audit/rollback.

## Estimate

XL (> 1 day)

## Acceptance Criteria (Definition of Done)

- [ ] Model/prediction có training-data version, feature version, backtest metric, drift threshold và fallback rule-based.
- [ ] Không replan `ON_SALE`, showtime có booking/hold hoặc nằm trong cutoff policy; không tự huỷ showtime đã bán.
- [ ] Mọi đề xuất replan có before/after score, impact, reason, approval/audit và rollback path.
- [ ] A/B hoặc shadow mode chứng minh forecast tốt hơn baseline trước khi tạo showtime thật từ output model.

## Related

- Branch: `feat/score-forecast-adaptive-scheduling`
- Depends on: `SC-P1-01`, `SC-P1-02`

---

## 7. Failure matrix xuyên service

| Failure point | Score result | Movie/Auto Showtime action |
|---|---|---|
| Booking event publish lost after booking commit | Outbox relay retry với cùng `eventId` | Không tính thiếu vĩnh viễn; snapshot sau reconcile mới được publish |
| Score nhận duplicate event | Inbox unique trả processed result | Metric không tăng lần hai |
| Cancel đến trước confirm | Lưu pending causal relation/recompute window | Không tạo metric âm; không publish READY nếu data inconsistent |
| Score consumer lag/stale | Snapshot `STALE` | Movie dùng last-known-good theo policy hoặc giữ run `ACCEPTED`; không hiểu là score 0 |
| Score snapshot thiếu một movie/cluster/date | `SCORE_SNAPSHOT_NOT_READY` | Không execute một phần scope im lặng; fail/hold theo policy |
| Score publish event lost | Movie pull resolve nhận cùng snapshot version | Materialize idempotently rồi chạy run mới |
| Score thay đổi giữa generation run | Snapshot mới tạo version mới | Run đang chạy dùng version pinned, không đổi ranking giữa chừng |
| Movie remote call timeout | Không tự downgrade | Retry/query snapshot version; nếu không resolve được thì không chạy schedule mới |
| Payment amount chưa authoritative | revenue feature `UNKNOWN` | Rule calculator dùng fallback/confidence thấp; không dùng `85000` test |
| Candidate vượt giờ đóng cửa/không tương thích format | Không liên quan score | Candidate factory/persistence loại trước scoring/persist |

## 8. Quyết định cần Leader chốt trước khi code

1. Score Service có được tạo ngay như module microservice mới, hay P0 tạm đặt module package trong Movie Service? Khuyến nghị: tạo service mới nếu team thật sự cần Score là reusable owner; nếu deadline ngắn, implement contract/schema độc lập nhưng deploy cùng Movie chỉ như giai đoạn chuyển tiếp, không đọc DB chéo.
2. Event nào chứng minh doanh thu: `PAYMENT_CAPTURED` hay Booking `CONFIRMED`? Khuyến nghị: Payment captured cho revenue, Booking confirmed cho demand seat.
3. Rolling window/threshold ban đầu: 28 ngày + 8 tuần baseline, lag 30 phút, và minimum sample cần thống nhất theo quy mô data demo.
4. Khi score `STALE`, policy có cho Auto Showtime chạy bằng manual profile không? Khuyến nghị: chỉ allowed với `BOOTSTRAP` được audit, không dùng fallback im lặng cho `STALE`.
5. Score mới có được thay đổi idempotency của generation run không? Khuyến nghị: retry scope cũ dùng snapshot cũ; score mới phải explicit run/re-generation mới để audit không mơ hồ.

## 9. Definition of Done toàn luồng

- Không còn seed score là nguồn runtime chính cho Auto Showtime; seed chỉ còn bootstrap/manual fallback có audit.
- Một booking confirmed/cancel/refund đi qua outbox → Score → snapshot → Movie read model và có thể trace bằng correlation ID.
- Một generation run trả được `scoreSnapshotVersion`, quality status và explain được score input; chạy lại không trộn phiên bản.
- Event duplicate, retry, consumer restart, late event và Score unavailable đều có test evidence; không tạo metric double count hoặc lịch auto sai an toàn.
- Movie vẫn bảo vệ format, room status, availability, closing + cleanup, overlap, minimum coverage và max room share độc lập với score.
- Tài liệu OpenAPI/event contract, database migration và test guide được cập nhật trước merge.
