# Issue pack — Hoàn thiện flow xếp lịch chiếu tự động

Tài liệu này tách phần refinement của issue `#200 — [Backend] Implement automatic demand-based showtime generation` thành các issue độc lập, có thể assign và review riêng. Các issue tuân theo `docs/issues/ISSUE_TEMPLATE.md`.

## Kết quả rà soát implementation hiện tại

- `GenerationRunStatus.PARTIALLY_COMPLETED` và database constraint đã tồn tại, nhưng `AutoShowtimeRunExecutor` vẫn luôn gán `COMPLETED` sau khi xử lý candidate. Issue P0-01 chỉ hoàn thiện semantics và orchestration, không tạo lại enum.
- `ShowTime` vẫn lưu `showDate`, `startTime`, `endTime`; cách biểu diễn này không mô hình hóa chắc chắn suất qua nửa đêm.
- `ShowTime` đã có `format`, `languageCode`, `subtitleCode`, nhưng chưa có một screening-version identity bất biến để ngăn tổ hợp format/audio/subtitle không hợp lệ.
- `MovieAvailability` mới biểu diễn cửa sổ phát hành theo cluster; chưa đủ dữ liệu quyền khai thác, territory, license và classification để làm eligibility gate.
- Selector có vòng minimum coverage nhưng duyệt toàn bộ candidate theo score; phim có score cao vẫn có thể lấy nhiều slot trước khi phim khác nhận được lượt đầu tiên. Chưa có post-validation chứng minh quota cuối cùng đã đạt.
- Engine hiện persist trực tiếp `ShowTime`; chưa có lớp kế hoạch nháp để review trước khi publish.

## Thứ tự triển khai đề xuất

| Wave | Thứ tự | Issue | Mục tiêu |
|---|---:|---|---|
| Data foundation | 1 | AS-P0-03 | Chuẩn hóa `startAt/endAt`, xử lý qua nửa đêm |
| Data foundation | 2 | AS-P0-04 | Screening version bất biến |
| Data foundation | 3 | AS-P0-05 | Rights/license/classification eligibility |
| Workflow | 4 | AS-P0-02 | Tách generate draft, review và publish |
| Correctness | 5 | AS-P0-07 | Round-robin minimum coverage và post-validation |
| Compliance | 6 | AS-P0-06 | Policy tỷ lệ phim Việt theo hiệu lực |
| Reliability | 7 | AS-P0-01 | Partial completion đúng semantics |
| UI | 8 | AS-P0-08 | Review/publish workspace cho admin |
| Business realism | 9–14 | AS-P1-01 → AS-P1-06 | Turnaround, film plan, demand, forecast, freeze và snapshot |

> P0 là điều kiện để schedule có thể được publish. P1 tăng chất lượng kinh doanh nhưng không được làm yếu các hard constraints của P0.

---

# AS-P0-01

## Title

`[Backend] Handle partial auto-schedule execution and PARTIALLY_COMPLETED correctly`

## Labels

`Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Sửa orchestration của generation run để một partition lỗi không rollback những partition đã hoàn thành, đồng thời phản ánh đúng kết quả bằng `COMPLETED`, `PARTIALLY_COMPLETED` hoặc `FAILED`. Tách business rejection dự kiến khỏi technical failure để số liệu run không gây hiểu nhầm.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Không tạo lại `GenerationRunStatus.PARTIALLY_COMPLETED`; tái sử dụng enum và DB constraint hiện có.
- [ ] Run được chia thành partition ổn định tối thiểu theo `clusterId + businessDate`; mỗi partition có transaction boundary riêng.
- [ ] Một partition lỗi không rollback draft slots/showtimes của partition đã commit thành công.
- [ ] `COMPLETED` khi mọi partition xử lý thành công; business skip hợp lệ không tự biến run thành partial failure.
- [ ] `PARTIALLY_COMPLETED` khi có ít nhất một partition thành công và ít nhất một partition technical-failed.
- [ ] `FAILED` khi không partition nào tạo được kết quả sử dụng được hoặc run thất bại trước khi bắt đầu xử lý.
- [ ] Bổ sung `failedPartitionCount`, `successfulPartitionCount` và failure details có mã lỗi ổn định.
- [ ] Retry chỉ chạy lại partition lỗi và không tạo duplicate nhờ idempotency key/unique constraint.
- [ ] Test chứng minh 2 cluster: cluster A thành công, cluster B lỗi → A vẫn còn dữ liệu và run là `PARTIALLY_COMPLETED`.

---

## API Specifications (if applicable)

### API 1 — Get generation run result

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/schedules/auto-generation-runs/{generationRunId}` |
| Description | Trả trạng thái run và kết quả theo partition |
| Auth Required | Yes — `ADMIN` / scheduling operator |

---

## Technical Notes / Constraints

- Không dùng `skippedCount > 0` để kết luận `PARTIALLY_COMPLETED`; quota, no-slot hoặc conflict hợp lệ là business rejection.
- Tránh một outer transaction bao toàn bộ run nếu bên trong đã dùng `REQUIRES_NEW` nhưng entity run vẫn bị rollback/ghi đè trạng thái.
- Failure log không được chứa secret hoặc raw stack trace trong API response.

---

## Related

- Branch: `fix/auto-schedule-partial-completion`
- Depends on: AS-P0-02
- Related: `#200`
- Docs: `docs/issues/auto-showtime-production-flow-issue-pack.md`

---

# AS-P0-02

## Title

`[Backend] Introduce generated schedule draft review and publish workflow`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Không persist schedule do engine tạo thẳng thành showtime đang hoạt động. Generation tạo một immutable draft plan để operator review; chỉ command publish mới materialize các showtime hợp lệ.

---

## Estimate

- [x] XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có `schedule_plan` và `schedule_plan_slot` hoặc aggregate tương đương, tách khỏi `show_time` đang được mở bán.
- [ ] Chuẩn hóa state machine thành `DRAFT_GENERATED → IN_REVIEW → PUBLISHED`; `REVIEW` và `PUBLISH` là command, không dùng làm tên trạng thái.
- [ ] Chỉ generation run hợp lệ mới tạo `DRAFT_GENERATED`; không tạo `ShowTime` sellable ở bước này.
- [ ] Submit review khóa input version của plan; thay đổi policy/input sau đó không âm thầm đổi plan đang review.
- [ ] Publish chạy eligibility và overlap validation lần cuối trước khi materialize showtime.
- [ ] Publish idempotent: gọi lại cùng command không tạo duplicate.
- [ ] Plan có blocker không được publish; warning có thể override chỉ khi actor có quyền và nhập reason.
- [ ] Có audit actor, timestamp, from/to status, reason và correlation ID cho mọi transition.
- [ ] Test cover transition hợp lệ, transition sai, publish conflict và double-submit.

---

## API Specifications (if applicable)

### API 1 — Submit schedule plan for review

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/schedule-plans/{planId}/submit-review` |
| Description | Chuyển draft sang trạng thái review |
| Auth Required | Yes — scheduling operator |

### API 2 — Publish schedule plan

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/schedule-plans/{planId}/publish` |
| Description | Validate và materialize plan thành showtimes |
| Auth Required | Yes — `ADMIN` / authorized approver |

---

## Technical Notes / Constraints

- Không overload `GenerationRunStatus` để chứa cả execution state và approval state; đây là hai lifecycle khác nhau.
- Slot draft phải tham chiếu screening version và lưu `startAt/endAt`.
- Publish nên atomic theo partition `cluster + businessDate`; kết quả nhiều partition dùng semantics của AS-P0-01.

---

## Related

- Branch: `feat/schedule-plan-review-publish`
- Depends on: AS-P0-03, AS-P0-04, AS-P0-05
- Related: `#200`
- Docs: `docs/issues/auto-showtime-production-flow-issue-pack.md`

---

# AS-P0-03

## Title

`[Database] Migrate showtimes to timezone-safe startAt and endAt`

## Labels

`Layer::Database`, `Type::Bug`, `Priority::High`

## Summary / Objective

Thay mô hình `showDate + startTime + endTime` bằng hai mốc thời gian đầy đủ `startAt/endAt`. Mục tiêu là xử lý đúng suất chiếu kết thúc qua nửa đêm, operating hours qua ngày và overlap ở cấp database.

---

## Estimate

- [x] XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] `show_time` có `start_at` và `end_at` dùng `TIMESTAMPTZ`; `end_at > start_at` bằng check constraint.
- [ ] Business date được derive theo timezone của cinema cluster, không lấy trực tiếp từ timezone JVM.
- [ ] Suất `2026-07-24 23:30` đến `2026-07-25 01:50` được lưu, query và hiển thị chính xác.
- [ ] Overlap/exclusion constraint sử dụng range từ `start_at` đến thời điểm room available again.
- [ ] Migration backfill dữ liệu cũ có kiểm tra; record có `endTime < startTime` được hiểu là kết thúc ngày kế tiếp.
- [ ] API chuyển sang ISO-8601 offset datetime; có compatibility window hoặc migration guide cho frontend cũ.
- [ ] Không còn so sánh overlap bằng `LocalTime` trong auto-schedule pipeline.
- [ ] Test cover midnight, timezone, daylight-boundary-safe behavior và query theo business date.

---

## API Specifications (if applicable)

**Showtime time contract:**

```json
{
  "startAt": "2026-07-24T23:30:00+07:00",
  "endAt": "2026-07-25T01:50:00+07:00",
  "businessDate": "2026-07-24"
}
```

---

## Technical Notes / Constraints

- Java ưu tiên `OffsetDateTime` cho API/entity mapping và `ZoneId` của cluster khi tính business date.
- Không xóa cột legacy trong cùng migration nếu frontend/API cũ chưa chuyển hoàn toàn; thực hiện expand → backfill → switch → contract.

---

## Related

- Branch: `feat/showtime-start-end-at`
- Depends on: migration framework của movie-service
- Related: `#198`, `#200`
- Docs: `docs/api-specs/movie-service/auto-showtime.yaml`

---

# AS-P0-04

## Title

`[Backend] Model immutable screening versions for showtime scheduling`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Mô hình hóa phiên bản chiếu như một tổ hợp có định danh gồm format trình chiếu, audio language/version và subtitle language. Engine phải schedule một screening version cụ thể thay vì ghép các string rời rạc trên `ShowTime`.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có `MovieScreeningVersion` hoặc aggregate tương đương gắn với movie.
- [ ] Tối thiểu lưu `formatId`, `audioLanguageCode`, `subtitleLanguageCode` (nullable khi không phụ đề), trạng thái và effective window.
- [ ] Unique business key ngăn duplicate cùng tổ hợp cho một movie.
- [ ] Room eligibility kiểm tra screening version với room format capability.
- [ ] Candidate, plan slot và published showtime đều tham chiếu `screeningVersionId`.
- [ ] Không tự tạo tổ hợp audio/subtitle/format chưa được cấu hình/approved.
- [ ] Screening version đã được dùng bởi showtime không bị sửa in-place; thay đổi tạo version mới hoặc supersede có audit.
- [ ] Test cover phim có bản lồng tiếng Việt, tiếng Anh phụ đề Việt, 2D và IMAX.

---

## Technical Notes / Constraints

- Có thể giữ các cột `format_id/language_code/subtitle_code` trên showtime như snapshot đọc nhanh, nhưng nguồn sự thật phải là screening version.
- Không coi `ATMOS` là movie presentation format nếu hệ thống đang mô hình nó như audio capability; cần map capability rõ ràng.

---

## Related

- Branch: `feat/movie-screening-version`
- Depends on: screening format và room capability hiện có
- Related: `#177`, `#199`, `#200`
- Docs: `docs/issues/auto-showtime-production-flow-issue-pack.md`

---

# AS-P0-05

## Title

`[Backend] Enforce theatrical rights license and classification eligibility`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Bổ sung eligibility gate để chỉ xếp và publish phim có quyền khai thác hợp lệ tại đúng cluster, territory và khoảng thời gian, đồng thời đã có phân loại độ tuổi được phê duyệt. `MovieAvailability` không được xem là bằng chứng đầy đủ về quyền phát hành.

---

## Estimate

- [x] XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có dữ liệu quyền/license tối thiểu: movie, distributor/licensor, territory, eligible clusters hoặc scope, `validFrom`, `validUntil`, allowed screening versions/formats và status.
- [ ] Có classification record theo thị trường Việt Nam với status phê duyệt và effective date.
- [ ] Một `SchedulingEligibilityService` duy nhất được dùng ở candidate generation, submit review và publish.
- [ ] Reject movie ngoài license window, sai territory/cluster, format không được cấp quyền, classification thiếu/hết hiệu lực hoặc availability chưa mở.
- [ ] Cross-midnight showtime phải nằm trong license window theo rule đã document (theo `startAt` hoặc toàn bộ interval); không để mỗi service hiểu khác nhau.
- [ ] Mọi rejection có stable reason code và dữ liệu giải thích cho UI.
- [ ] Manual override chỉ áp dụng cho warning được policy cho phép; hard rights violation không được override.
- [ ] Test cover re-release, license hết hạn giữa horizon và license chỉ áp dụng một nhóm cluster.

---

## Technical Notes / Constraints

- Không đưa hợp đồng pháp lý hoặc tài liệu nhạy cảm vào payload công khai; chỉ lưu metadata vận hành và reference an toàn.
- `MovieAvailability` vẫn quản lý kế hoạch khai thác theo cluster; rights/license là điều kiện đầu vào độc lập.

---

## Related

- Branch: `feat/showtime-rights-eligibility`
- Depends on: AS-P0-03, AS-P0-04
- Related: `#173`, `#194`, `#200`
- Docs: `docs/api-specs/movie-service/MOVIE_LIFECYCLE_CONTRACT.md`

---

# AS-P0-06

## Title

`[Backend] Enforce configurable Vietnamese-film programming share policy`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Bổ sung compliance rule cho tỷ lệ lập lịch phim Việt theo giai đoạn hiệu lực và phạm vi đo lường được cấu hình. Không hard-code một con số “năm 2026” trong thuật toán; giá trị áp dụng phải được legal/compliance xác nhận và version hóa.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có policy record gồm `effectiveFrom`, `effectiveTo`, market/territory, scope, measurement basis, required share và source/reference.
- [ ] Movie có thuộc tính/taxonomy xác định phim Việt từ dữ liệu đã verify; không suy đoán chỉ từ ngôn ngữ.
- [ ] Policy định nghĩa rõ mẫu số: số suất, screen-time minutes hoặc capacity-weighted slots; engine và report dùng cùng một cách tính.
- [ ] Allocator giữ đủ capacity cho quota trước khi fill theo demand score.
- [ ] Post-validation trả actual share, required share, pass/fail và contributing slots.
- [ ] Plan không đạt hard quota không được publish, trừ khi policy cho phép override và actor nhập reason có audit.
- [ ] Boundary date chọn đúng policy version; không sửa lịch sử khi policy mới có hiệu lực.
- [ ] Test cover dưới quota, đúng quota, vượt quota và policy đổi giữa hai horizon.

---

## Technical Notes / Constraints

- Product owner/legal phải xác nhận tỷ lệ, phạm vi và ngày hiệu lực từ nguồn pháp lý chính thức trước production rollout.
- Không ghi cứng “2026” trong tên field hoặc Java constant; dùng effective-dated policy.

---

## Related

- Branch: `feat/vietnamese-film-scheduling-policy`
- Depends on: AS-P0-02, AS-P0-05
- Related: `#200`
- Docs: `docs/issues/auto-showtime-production-flow-issue-pack.md`

---

# AS-P0-07

## Title

`[Backend] Allocate minimum movie coverage with round-robin and post-validation`

## Labels

`Layer::Backend`, `Type::Bug`, `Priority::High`

## Summary / Objective

Thay vòng minimum coverage đang duyệt candidate theo score bằng round-robin thực sự theo movie trong từng cluster/business date. Sau allocation phải có validator độc lập chứng minh coverage đã đạt hoặc trả blocker rõ ràng.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Group candidate theo `cluster + businessDate + movie` và sắp xếp nội bộ theo score/tie-breaker ổn định.
- [ ] Mỗi pass cấp tối đa một slot cho mỗi movie còn thiếu coverage trước khi quay lại pass tiếp theo.
- [ ] Thứ tự movie được rotate/deterministic seed để không luôn ưu tiên cùng một movie khi tài nguyên thiếu.
- [ ] Chỉ sau coverage phase mới chạy demand-fill phase.
- [ ] Có post-validator độc lập kiểm tra minimum coverage, maximum room share, overlap, operating window, rights và compliance quota.
- [ ] Không đủ tài nguyên phải trả `UNSATISFIED_MINIMUM_COVERAGE` kèm movie/cluster/date và deficit; không báo `COMPLETED` giả.
- [ ] Draft có blocker coverage không được publish.
- [ ] Test chứng minh một phim score cao không chiếm hết slot trước lượt đầu của các phim eligible khác.

---

## Technical Notes / Constraints

- Round-robin là fairness phase, không thay thế scoring. Candidate tốt nhất của từng movie vẫn được chọn trong lượt của movie đó.
- Tie-breaker phải deterministic để replay cùng snapshot cho cùng kết quả.

---

## Related

- Branch: `fix/auto-schedule-round-robin-coverage`
- Depends on: AS-P0-03, AS-P0-04, AS-P0-05
- Related: `#200`
- Docs: `docs/issues/auto-showtime-production-flow-issue-pack.md`

---

# AS-P0-08

## Title

`[Frontend] Build schedule plan review and publish workspace`

## Labels

`Layer::Frontend`, `Type::Feature`, `Priority::High`

## Summary / Objective

Hoàn thiện UI để operator xem draft do engine tạo, nhận biết blocker/warning và publish có chủ đích. UI không được biến thành form chọn thủ công từng slot; trọng tâm là review theo exception và so sánh thay đổi.

---

## Estimate

- [x] XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Trang Showtimes hiển thị generation run và schedule plan trong cùng workspace.
- [ ] Có timeline/calendar theo cluster, room và business date; suất qua nửa đêm hiển thị nối sang ngày sau nhưng vẫn giữ business date.
- [ ] Hiển thị rõ screening version: format, audio và subtitle.
- [ ] Có summary blocker/warning cho rights, classification, quota, coverage và overlap; click item focus đúng slot.
- [ ] Actions theo state: Generate draft, Submit for review, Request changes, Publish.
- [ ] Publish button disabled khi có blocker; warning override yêu cầu reason nếu backend cho phép.
- [ ] `PARTIALLY_COMPLETED` hiển thị partition thành công/thất bại và nút retry phần lỗi.
- [ ] Loading/error/empty states, dark/light mode và responsive layout được kiểm tra.

---

## UI Reference / Mockup

- Tái sử dụng hướng single-panel của trang Showtimes hiện tại.
- Calendar là vùng chính; validation summary là panel phụ hoặc drawer, không che lịch.

---

## Related

- Branch: `feat/schedule-plan-review-ui`
- Depends on: AS-P0-01, AS-P0-02, AS-P0-03, AS-P0-04, AS-P0-05, AS-P0-06, AS-P0-07
- Related: `#200`
- Docs: `docs/api-specs/movie-service/auto-showtime.yaml`

---

# AS-P1-01

## Title

`[Backend] Model auditorium pre-show interval and cleanup timing policies`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Thay cleanup buffer toàn cục bằng timeline vận hành có thể override theo cluster, room và screening version. Engine phải phân biệt giờ khách thấy trên vé, thời điểm bắt đầu nội dung chính, intermission và thời điểm phòng sẵn sàng cho suất tiếp theo.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Policy hỗ trợ `preShowMinutes`, `trailerMinutes`, `intermissionMinutes`, `cleanupMinutes` và optional ingress/egress buffer.
- [ ] Có precedence rõ: screening version/film plan override → room → cluster → global default.
- [ ] Lưu hoặc derive rõ `advertisedStartAt`, `featureStartAt`, `featureEndAt`, `roomAvailableAt`.
- [ ] Overlap dùng occupancy interval đầy đủ, không chỉ runtime phim.
- [ ] Suất qua nửa đêm vẫn tính timeline đúng.
- [ ] UI/API giải thích các thành phần thời lượng, không cộng mơ hồ vào runtime movie.
- [ ] Test cover phim có intermission, room premium cleanup dài và standard room dùng default.

---

## Technical Notes / Constraints

- Không mặc định mọi phim có intermission; đây là thuộc tính của film plan/screening version.
- `startAt/endAt` của published showtime phải có semantics được document rõ, tránh đổi nghĩa giữa API.

---

## Related

- Branch: `feat/auditorium-turnaround-policy`
- Depends on: AS-P0-03, AS-P0-04
- Related: `#178`, `#200`
- Docs: `docs/issues/auto-showtime-production-flow-issue-pack.md`

---

# AS-P1-02

## Title

`[Backend] Enforce distributor commitments and film-plan scheduling constraints`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Mô hình hóa các cam kết vận hành với distributor/film plan để allocator không chỉ dựa trên demand score. Các rule phải có effective window, mức độ hard/soft và khả năng truy vết nguồn.

---

## Estimate

- [x] XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Film plan hỗ trợ tối thiểu min/max shows, allowed/prohibited clusters, room/format restrictions và effective dates.
- [ ] Hỗ trợ prime-time commitment, blackout window, exclusivity và minimum run length khi business yêu cầu.
- [ ] Rule phân loại `HARD` hoặc `SOFT` với penalty weight; hard violation chặn publish.
- [ ] Candidate scorer/selector dùng rule từ active film plan, không hard-code theo movie ID/distributor name.
- [ ] Conflict giữa hai commitments được phát hiện trước allocation và trả blocker có source reference.
- [ ] Manual override chỉ cho soft constraint, có actor/reason/audit.
- [ ] Test cover nhiều distributor, overlapping commitments và plan hết hiệu lực giữa horizon.

---

## Related

- Branch: `feat/distributor-film-plan-constraints`
- Depends on: AS-P0-04, AS-P0-05, AS-P0-02
- Related: `#200`
- Docs: `docs/issues/auto-showtime-production-flow-issue-pack.md`

---

# AS-P1-03

## Title

`[Backend] Score contextual demand by cluster day type and daypart`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Nâng demand model từ một score tĩnh theo cluster thành demand context theo weekday/weekend, holiday, daypart, cluster và movie. Engine phải có fallback rõ khi dữ liệu lịch sử thưa hoặc chưa có.

---

## Estimate

- [x] XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Demand input hỗ trợ `clusterId`, `movieId/category`, `businessDate`, `dayType`, `daypart` và score/confidence.
- [ ] Holiday calendar của Việt Nam được version hóa; không hard-code rải rác trong Java.
- [ ] Daypart có effective config theo cluster/market thay vì enum giờ cố định duy nhất.
- [ ] Có fallback hierarchy: movie-cluster-slot → movie-market/daypart → cluster/daypart → global baseline.
- [ ] Low-confidence data không được lấn át hard rules và minimum coverage.
- [ ] Score response có reason breakdown để operator hiểu vì sao slot được ưu tiên.
- [ ] Test cùng phim cho weekday morning, weekend evening và holiday peak cho kết quả khác hợp lý.

---

## Technical Notes / Constraints

- Đây là forecasting input, không phải dữ liệu PII; chỉ dùng aggregate metrics.
- Giữ scorer deterministic theo input snapshot để hỗ trợ replay.

---

## Related

- Branch: `feat/contextual-showtime-demand`
- Depends on: AS-P0-02, AS-P1-06
- Related: `#200`
- Docs: `docs/issues/auto-showtime-production-flow-issue-pack.md`

---

# AS-P1-04

## Title

`[Backend] Add occupancy revenue and pricing forecasts to schedule plans`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Bổ sung forecast cho từng draft slot và toàn plan để operator so sánh phương án theo occupancy, ticket revenue và price assumptions. Forecast là decision support, không thay thế giá bán chính thức của showtime.

---

## Estimate

- [x] XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Mỗi plan slot có `predictedOccupancyRate`, `predictedAdmissions`, `referencePrice` và `predictedGrossRevenue`.
- [ ] Công thức sử dụng capacity sellable, screening version surcharge, cluster/daypart demand và pricing policy version.
- [ ] Có confidence band hoặc confidence score và fallback khi thiếu lịch sử.
- [ ] Plan summary có occupancy/revenue forecast theo movie, cluster, date và room.
- [ ] Forecast không tự ghi đè `basePrice`/price book khi publish.
- [ ] API trả assumptions và model/policy version để giải thích kết quả.
- [ ] UI review hiển thị forecast gọn, có sort/filter nhưng không che hard compliance blockers.
- [ ] Backtest fixture kiểm tra forecast không tạo NaN, âm hoặc vượt capacity.

---

## Related

- Branch: `feat/showtime-plan-forecast`
- Depends on: AS-P1-03, AS-P1-06, seat capacity và pricing policy
- Related: `#135`, `#200`
- Docs: `docs/issues/auto-showtime-production-flow-issue-pack.md`

---

# AS-P1-05

## Title

`[Backend] Protect frozen showtimes and penalize manual schedule changes`

## Labels

`Layer::Backend`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Cho phép operator đóng băng showtime đã cam kết, giữ manual override và giảm churn khi re-plan. Optimizer phải xem frozen slot là hard constraint và dùng change penalty cho slot chưa frozen.

---

## Estimate

- [x] XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] Showtime/plan slot có `frozen`, `frozenAt`, `frozenBy`, reason và optional freeze-until.
- [ ] Showtime đã mở bán/có booking mặc định được bảo vệ theo lifecycle policy.
- [ ] Re-plan không di chuyển/xóa frozen slot; conflict với frozen slot tạo blocker/skip reason rõ ràng.
- [ ] Manual override lưu actor, reason, before/after và không bị generation run sau ghi đè âm thầm.
- [ ] Soft change penalty tính cho move time, change room, change screening version và cancellation.
- [ ] Review UI hiển thị diff: unchanged, added, moved, replaced, removed và penalty tổng.
- [ ] Unfreeze yêu cầu quyền riêng và audit.
- [ ] Test cover re-plan với sold showtime, manually moved slot và double generation.

---

## API Specifications (if applicable)

### API 1 — Freeze showtime

| Field | Details |
|---|---|
| Method | `POST` |
| Endpoint | `/api/showtimes/{showtimeId}/freeze` |
| Description | Đóng băng một showtime khỏi auto re-plan |
| Auth Required | Yes — authorized scheduling role |

---

## Related

- Branch: `feat/showtime-freeze-change-penalty`
- Depends on: AS-P0-02, AS-P0-03
- Related: `#185`, `#200`
- Docs: `docs/issues/auto-showtime-production-flow-issue-pack.md`

---

# AS-P1-06

## Title

`[Database] Version scheduling policies and persist immutable input snapshots`

## Labels

`Layer::Database`, `Type::Feature`, `Priority::Medium`

## Summary / Objective

Đảm bảo một generation run có thể audit và replay bằng đúng policy/input tại thời điểm chạy. Không để việc sửa demand, rights, room capability hoặc weight làm thay đổi ý nghĩa của lịch sử.

---

## Estimate

- [x] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Allocation policy có immutable `policyVersion`, effective period và status; version đã dùng không sửa in-place.
- [ ] Generation run lưu `algorithmVersion`, `policyVersion`, input hash, random/deterministic seed và business timezone.
- [ ] Snapshot tối thiểu gồm selected movies/screening versions, cluster/room capabilities, operating hours, existing/frozen showtimes, rights/classification, demand inputs và compliance policy.
- [ ] Snapshot immutable sau khi run chuyển `RUNNING`; có checksum để phát hiện corruption.
- [ ] API có endpoint tải metadata/snapshot đã redacted cho authorized auditor.
- [ ] Replay cùng algorithm version và snapshot cho cùng candidate ordering/validation result.
- [ ] Có retention policy; không lưu credential, PII hoặc full legal documents.
- [ ] Test chứng minh sửa active policy sau run không làm đổi kết quả/audit của run cũ.

---

## API Specifications (if applicable)

### API 1 — Get generation snapshot metadata

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/schedules/auto-generation-runs/{generationRunId}/snapshot` |
| Description | Trả snapshot đã redacted phục vụ audit/replay |
| Auth Required | Yes — `ADMIN` / authorized auditor |

---

## Technical Notes / Constraints

- Có thể lưu JSONB snapshot cộng các FK/index cần query; snapshot phải có schema version.
- Không chỉ lưu reference đến bảng mutable vì dữ liệu đó có thể thay đổi sau run.

---

## Related

- Branch: `feat/auto-schedule-policy-snapshot`
- Depends on: AS-P0-02
- Related: `#200`
- Docs: `docs/issues/auto-showtime-production-flow-issue-pack.md`

---

## Gợi ý chia nhóm để assign

| Nhóm | Issues | Kỹ năng chính |
|---|---|---|
| Temporal & schema | AS-P0-03, AS-P0-04 | PostgreSQL migration, JPA, time modeling |
| Eligibility & compliance | AS-P0-05, AS-P0-06 | Domain rules, validation, audit |
| Allocation correctness | AS-P0-07, AS-P0-01 | Algorithm, transaction, idempotency |
| Workflow & UI | AS-P0-02, AS-P0-08 | State machine, REST contract, React |
| Theatre operations | AS-P1-01, AS-P1-02 | Operational policy, constraint modeling |
| Optimization | AS-P1-03, AS-P1-04, AS-P1-05 | Scoring, forecast, replanning |
| Reproducibility | AS-P1-06 | Versioning, JSONB snapshot, audit/replay |

## Definition of complete flow

```text
Collect versioned inputs
  → Validate rights/classification/availability
  → Generate candidates using startAt/endAt and screening version
  → Allocate minimum coverage by round-robin
  → Fill remaining capacity by demand/constraints
  → Post-validate hard rules and compliance
  → Persist DRAFT_GENERATED plan
  → Operator reviews exceptions and submits review
  → Authorized approver publishes
  → Materialize showtimes atomically per cluster/business date
  → Report COMPLETED / PARTIALLY_COMPLETED / FAILED
```

