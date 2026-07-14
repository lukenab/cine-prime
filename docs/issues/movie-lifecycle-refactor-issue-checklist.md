# Movie Lifecycle Refactor — Issue Creation Checklist

> Format source: `docs/issues/ISSUE_TEMPLATE.md`  
> Scope: tách Movie content workflow khỏi trạng thái vận hành/phát hành tại rạp.  
> Mỗi mục bên dưới là một GitLab issue độc lập, có thể copy trực tiếp khi tạo issue.

## Thứ tự tạo và triển khai

| Thứ tự | Mã tạm | Layer | Issue | Priority | Phụ thuộc |
|---:|---|---|---|---|---|
| 1 | MOV-LC-01 | Frontend | Normalize Movie Management to content workflow statuses | High | Không |
| 2 | MOV-LC-02 | Docs | Define Movie content and exhibition lifecycle API contract | High | Không |
| 3 | MOV-LC-03 | Database | Add cluster-scoped movie availability schema | High | MOV-LC-02 |
| 4 | MOV-LC-04 | Backend | Implement canonical Movie content lifecycle commands | High | MOV-LC-02 |
| 5 | MOV-LC-05 | Database | Backfill legacy Movie statuses and availability data | High | MOV-LC-03, MOV-LC-04 |
| 6 | MOV-LC-06 | Backend | Implement cluster-scoped Movie Availability APIs | High | MOV-LC-03, MOV-LC-04 |
| 7 | MOV-LC-07 | Backend | Derive public Now Showing and Coming Soon by cluster | High | MOV-LC-05, MOV-LC-06 |
| 8 | MOV-LC-08 | Frontend | Integrate Movie Management with canonical content lifecycle API | Medium | MOV-LC-04, MOV-LC-05 |
| 9 | MOV-LC-09 | Frontend | Add cluster-scoped Movie Availability management UI | Medium | MOV-LC-06 |
| 10 | MOV-LC-10 | Frontend | Consume derived public Movie display status by cluster | High | MOV-LC-07 |

## Checklist tạo issue

- [ ] Tạo MOV-LC-01 — frontend compatibility hiện tại
- [ ] Tạo MOV-LC-02 — chốt contract trước khi đổi backend/database
- [ ] Tạo MOV-LC-03 — schema availability dạng additive migration
- [ ] Tạo MOV-LC-04 — content workflow canonical
- [ ] Tạo MOV-LC-05 — migration và backfill dữ liệu cũ
- [ ] Tạo MOV-LC-06 — availability commands theo cluster
- [ ] Tạo MOV-LC-07 — public display status được suy ra
- [ ] Tạo MOV-LC-08 — bỏ frontend compatibility adapter
- [ ] Tạo MOV-LC-09 — UI quản lý kế hoạch phát hành
- [ ] Tạo MOV-LC-10 — homepage/movies page theo cluster

---

# MOV-LC-01 — [Frontend] Normalize Movie Management to content workflow statuses

**Labels:** `Layer::Frontend`, `Type::Bug`, `Priority::High`, `Review/ QA`

## Summary / Objective

Movie Management hiện đang hiển thị lẫn content-review state (`DRAFT`, `PENDING_REVIEW`, `REJECTED`) với exhibition state (`COMING_SOON`, `NOW_SHOWING`, `SUSPENDED`, `ENDED`). Chuẩn hóa giao diện quản lý nội dung chỉ còn `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `CHANGES_REQUESTED`, `ARCHIVED`, đồng thời giữ compatibility adapter để đọc response từ backend cũ trong giai đoạn chuyển tiếp.

---

## Estimate

- [x] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [x] Status tabs chỉ hiển thị `Draft`, `Pending Review`, `Approved`, `Changes Requested`, `Archived`
- [x] Badge tại table, detail modal và edit modal dùng chung một status metadata source
- [x] `COMING_SOON`, `NOW_SHOWING`, `SUSPENDED` từ backend cũ được trình bày là `APPROVED`
- [x] `REJECTED` từ backend cũ được trình bày là `CHANGES_REQUESTED`
- [x] Các action `release`, `suspend`, `end`, `reinstate` không còn xuất hiện trong Movie Management
- [x] `Reject` đổi nhãn thành `Request Changes`; `Rework` đổi thành `Start Revision`
- [x] Role visibility khớp endpoint backend hiện tại: submit cho ADMIN/EMPLOYEE, approve/request changes/archive cho ADMIN
- [x] `npm run build` thành công
- [ ] Browser QA trên dark mode và light mode
- [ ] Xác nhận luồng `Draft → Pending Review → Approved` bằng backend thật
- [ ] Xác nhận luồng `Pending Review → Changes Requested → Draft` bằng backend thật

---

## UI Reference / Mockup

Trang `/admin/movies` hiện tại. Đính kèm screenshot status tabs và action column sau khi update.

---

## API Specifications (if applicable)

Không thêm endpoint mới. Frontend tạm gọi các legacy endpoint:

| Action UI | Method | Endpoint |
|---|---|---|
| Submit for review | `POST` | `/api/movies/{id}/submit` |
| Approve content | `POST` | `/api/movies/{id}/approve` |
| Request changes | `POST` | `/api/movies/{id}/reject` |
| Start revision | `POST` | `/api/movies/{id}/rework` |

---

## Technical Notes / Constraints

- Compatibility mapping nằm tại `client/src/utils/movieContentStatus.ts` và phải được xóa sau MOV-LC-08.
- `ENDED → ARCHIVED` chỉ là mapping tạm do backend hiện dùng `ENDED` cho cả kết thúc chiếu và soft delete. Mapping này không phải mô hình canonical; MOV-LC-05 phải phân loại dữ liệu đúng khi migration.
- Không sửa homepage customer trong issue này. `NOW_SHOWING` và `COMING_SOON` vẫn là display status hợp lệ ở customer view trong giai đoạn hiện tại.
- Không gọi lại bốn legacy action `release/suspend/end/reinstate` từ Movie Management.

---

## Related

- Branch: `fix/movie-content-workflow-status-ui`
- Depends on: không có
- Docs: `docs/issues/movie-lifecycle-refactor-issue-checklist.md`

---

# MOV-LC-02 — [Docs] Define Movie content and exhibition lifecycle API contract

**Labels:** `Type::Docs`, `Priority::High`, `In Progress`

## Summary / Objective

Chốt contract chính thức trước khi thay đổi backend và database. Tài liệu phải phân biệt rõ Movie content workflow, cluster-scoped availability và customer display status để các MR sau không tiếp tục sử dụng một `Movie.status` cho nhiều mục đích khác nhau.

---

## Estimate

- [ ] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Định nghĩa Movie content states: `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `CHANGES_REQUESTED`, `ARCHIVED`
- [ ] Định nghĩa Availability states: `PLANNED`, `OPEN`, `SUSPENDED`, `CLOSED`
- [ ] Định nghĩa public display states: `NOW_SHOWING`, `COMING_SOON`
- [ ] Có state-transition matrix kèm role, request body và validation cho từng command
- [ ] Xác nhận `NOW_SHOWING`/`COMING_SOON` không được lưu trong `Movie.status`
- [ ] Xác nhận `suspend/resume/close` tác động lên availability hoặc showtime, không tác động global Movie
- [ ] Định nghĩa compatibility/deprecation plan cho endpoint cũ
- [ ] Định nghĩa deployment order cho schema, backend, data migration và frontend
- [ ] Update OpenAPI YAML và `API_CONTRACT.md`
- [ ] Product Owner hoặc reviewer backend xác nhận contract trước khi merge MOV-LC-03/MOV-LC-04

---

## API Specifications (if applicable)

Contract mục tiêu:

| Domain | Commands/Resources |
|---|---|
| Movie content | `submit`, `approve`, `request-changes`, `start-revision`, `archive` |
| Availability | CRUD plan + `open`, `suspend`, `resume`, `close` |
| Public discovery | danh sách phim theo `clusterId`, trả `displayStatus` được suy ra |

---

## Technical Notes / Constraints

- Giữ response envelope hiện tại: `{ code, message, result }`.
- Không yêu cầu CQRS infrastructure hoặc event sourcing; command endpoint và service transaction hiện tại là đủ cho scope dự án.
- Dùng thuật ngữ `CHANGES_REQUESTED` thay cho `REJECTED` đối với nội dung có thể chỉnh sửa và gửi lại.
- `ARCHIVED` là quyết định quản trị catalog; phim hết lịch chiếu không tự động thành `ARCHIVED`.

---

## Related

- Branch: `docs/movie-lifecycle-contract`
- Depends on: không có
- Docs: `docs/api-specs/movie-service/movie-service.yaml`, `docs/api-specs/movie-service/API_CONTRACT.md`

---

# MOV-LC-03 — [Database] Add cluster-scoped movie availability schema

**Labels:** `Layer::Database`, `Type::Feature`, `Priority::High`, `In Progress`

## Summary / Objective

Thêm resource lưu kế hoạch phát hành theo từng cinema cluster thay vì ghi `COMING_SOON`, `NOW_SHOWING`, `SUSPENDED`, `ENDED` trực tiếp trên Movie. Migration phải additive để backend cũ vẫn chạy được trước khi hoàn tất data backfill và cutover.

---

## Estimate

- [ ] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Tạo bảng `movie_availability`
- [ ] Mỗi availability liên kết bắt buộc với một `movie_id` và một `cluster_id`
- [ ] Hỗ trợ nhiều release window của cùng một phim tại cùng cluster
- [ ] Có status `PLANNED`, `OPEN`, `SUSPENDED`, `CLOSED`
- [ ] Có `sales_start_at`, `showing_start_date`, `showing_end_date`
- [ ] Có `suspension_reason`, `created_at`, `updated_at`, `created_by`, `updated_by`
- [ ] Có cột `version` để hỗ trợ optimistic locking
- [ ] Có check constraint `showing_end_date IS NULL OR showing_end_date >= showing_start_date`
- [ ] Có index cho `(cluster_id, status, showing_start_date)` và `(movie_id, cluster_id)`
- [ ] Có unique constraint chống tạo trùng cùng release window
- [ ] Update init SQL và DBML
- [ ] Migration chạy được trên database có dữ liệu mà không xóa/chuyển đổi `movie.status` ngay

---

## API Specifications (if applicable)

Không có API trong issue database này.

---

## Technical Notes / Constraints

Schema đề xuất:

```text
movie_availability
  availability_id BIGINT PK
  movie_id BIGINT FK NOT NULL
  cluster_id BIGINT FK NOT NULL
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED'
  sales_start_at TIMESTAMP NULL
  showing_start_date DATE NOT NULL
  showing_end_date DATE NULL
  suspension_reason VARCHAR(500) NULL
  version BIGINT NOT NULL DEFAULT 0
  created_at TIMESTAMP NOT NULL
  updated_at TIMESTAMP NOT NULL
  created_by VARCHAR(100) NULL
  updated_by VARCHAR(100) NULL
```

- Không dùng unique `(movie_id, cluster_id)` vì cùng một phim có thể được chiếu lại ở release window khác.
- Có thể dùng unique `(movie_id, cluster_id, showing_start_date)` cho MVP.
- Không drop hoặc đổi dữ liệu `movie.status` trong migration này.

---

## Related

- Branch: `feat/movie-availability-schema`
- Depends on: MOV-LC-02
- Docs: `docs/database/movie-service/`, `server/postgres-init/movie_db.sql`

---

# MOV-LC-04 — [Backend] Implement canonical Movie content lifecycle commands

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`, `In Progress`

## Summary / Objective

Refactor Movie lifecycle để `Movie.status` chỉ thể hiện trạng thái nội dung và phê duyệt. Các transition phải được thực thi bằng business command rõ ràng, có authorization, validation, audit và conflict handling; không cho client cập nhật status tùy ý qua create/update payload.

---

## Estimate

- [ ] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `MovieStatus` canonical chỉ còn `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `CHANGES_REQUESTED`, `ARCHIVED`
- [ ] Movie mới luôn được tạo ở `DRAFT`; request không được tự chọn status
- [ ] `DRAFT → PENDING_REVIEW` qua submit
- [ ] `PENDING_REVIEW → APPROVED` qua approve
- [ ] `PENDING_REVIEW → CHANGES_REQUESTED` qua request changes và bắt buộc có note
- [ ] `CHANGES_REQUESTED → DRAFT` qua start revision
- [ ] `APPROVED → ARCHIVED` chỉ dành cho ADMIN và bị chặn khi còn availability/showtime hoạt động
- [ ] Chỉ `DRAFT` được chỉnh sửa trực tiếp; revision phải quay về `DRAFT` trước khi edit
- [ ] Mỗi transition lưu actor, from-state, to-state, reason và timestamp
- [ ] Invalid transition trả HTTP 409 với error code riêng
- [ ] Có optimistic locking hoặc kiểm tra version để tránh hai admin duyệt đồng thời
- [ ] Có unit test cho transition matrix và controller test cho role/invalid transition
- [ ] Legacy endpoints có deprecation plan, không bị xóa trước khi frontend cutover

---

## API Specifications (if applicable)

| Action | Method | Endpoint | Auth |
|---|---|---|---|
| Submit review | `POST` | `/api/movies/{id}/submit` | ADMIN/EMPLOYEE |
| Approve content | `POST` | `/api/movies/{id}/approve` | ADMIN |
| Request changes | `POST` | `/api/movies/{id}/request-changes` | ADMIN |
| Start revision | `POST` | `/api/movies/{id}/start-revision` | ADMIN/EMPLOYEE |
| Archive content | `POST` | `/api/movies/{id}/archive` | ADMIN |

**Request changes body:**

```json
{
  "note": "Poster and Vietnamese synopsis must be updated"
}
```

**Response 200 OK:** trả `MovieResponse` mới nhất thay vì `void`, bao gồm canonical `status`.

---

## Technical Notes / Constraints

- Không triển khai `release/suspend/end/reinstate` trong Movie content service logic mới.
- `DELETE /api/movies/{id}` hiện đang ghi `ENDED`; cần deprecate và thay bằng explicit archive command.
- Trong giai đoạn migration, backend có thể cần đọc cả legacy và canonical status; phải ghi rõ ngày remove compatibility code.
- `APPROVED` không đồng nghĩa đang hiển thị công khai hoặc đang mở bán vé.

---

## Related

- Branch: `feat/movie-content-lifecycle`
- Depends on: MOV-LC-02
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`

---

# MOV-LC-05 — [Database] Backfill legacy Movie statuses and availability data

**Labels:** `Layer::Database`, `Type::Chore`, `Priority::High`, `In Progress`

## Summary / Objective

Chuyển dữ liệu hiện có từ lifecycle trộn lẫn sang content status và availability records mới. Migration phải bảo toàn thông tin vận hành theo cluster dựa trên showtime hiện có, không được mặc định một trạng thái global áp dụng cho mọi cluster.

---

## Estimate

- [ ] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có backup/verification query trước migration
- [ ] `DRAFT → DRAFT`
- [ ] `PENDING_REVIEW → PENDING_REVIEW`
- [ ] `REJECTED → CHANGES_REQUESTED`
- [ ] `COMING_SOON`, `NOW_SHOWING`, `SUSPENDED`, `ENDED → APPROVED` ở content status
- [ ] `COMING_SOON` tạo availability `PLANNED` cho cluster xác định được
- [ ] `NOW_SHOWING` tạo availability `OPEN` cho cluster có showtime tương ứng
- [ ] `SUSPENDED` tạo availability `SUSPENDED` cho cluster xác định được
- [ ] `ENDED` tạo availability `CLOSED`; không tự động archive Movie content
- [ ] Cluster được suy ra từ showtime hiện có; không tự gán phim cho tất cả cluster
- [ ] Record không xác định được cluster được xuất ra migration report để xử lý thủ công
- [ ] Phân biệt legacy `ENDED` do soft delete nếu action log đủ dữ liệu; trường hợp không phân biệt được phải đưa vào report
- [ ] Migration idempotent hoặc có guard chống chạy lặp
- [ ] Có post-migration queries chứng minh không mất Movie, showtime hoặc availability
- [ ] Seed data và Postman IDs được cập nhật nếu cần

---

## API Specifications (if applicable)

Không có API mới. Đây là data migration/cutover issue.

---

## Technical Notes / Constraints

- Không map `ENDED → ARCHIVED` một cách tự động; hai khái niệm khác nhau.
- Với Movie không có showtime, chỉ tạo availability khi có dữ liệu cluster/release plan đáng tin cậy.
- Nên triển khai theo hai bước: insert/backfill availability trước, sau đó update canonical `movie.status`.
- Migration cần chạy trong transaction nếu kích thước dữ liệu cho phép; nếu không, dùng batch và verification checkpoint.

---

## Related

- Branch: `chore/backfill-movie-lifecycle-data`
- Depends on: MOV-LC-03, MOV-LC-04
- Docs: `docs/database/movie-service/`, `server/postgres-init/movie_db.sql`

---

# MOV-LC-06 — [Backend] Implement cluster-scoped Movie Availability APIs

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`, `In Progress`

## Summary / Objective

Xây dựng service/API quản lý release window của một phim tại một cinema cluster. Các command `open`, `suspend`, `resume`, `close` phải tác động lên availability cụ thể, không thay đổi Movie content status toàn hệ thống.

---

## Estimate

- [ ] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Có entity, repository, DTO, mapper và service cho `MovieAvailability`
- [ ] Tạo plan chỉ khi Movie content là `APPROVED`
- [ ] Cluster phải tồn tại và ở trạng thái cho phép lập lịch
- [ ] Date range hợp lệ và không tạo release window trùng/overlap ngoài policy
- [ ] `PLANNED → OPEN` qua open command
- [ ] `PLANNED/OPEN → SUSPENDED` qua suspend command và bắt buộc có reason
- [ ] `SUSPENDED → OPEN` qua resume command
- [ ] `PLANNED/OPEN/SUSPENDED → CLOSED` qua close command
- [ ] `CLOSED` không tự động làm Movie thành `ARCHIVED`
- [ ] Open availability kiểm tra ít nhất một showtime hợp lệ hoặc áp dụng rule presale đã chốt trong MOV-LC-02
- [ ] Mọi command có audit actor/reason/from-state/to-state
- [ ] Có optimistic locking bằng `version`
- [ ] Có controller/integration tests cho role, transition, overlap và concurrency conflict

---

## API Specifications (if applicable)

| Action | Method | Endpoint |
|---|---|---|
| List/filter | `GET` | `/api/movie-availabilities?movieId=&clusterId=&status=` |
| Create plan | `POST` | `/api/movie-availabilities` |
| Update plan | `PUT` | `/api/movie-availabilities/{id}` |
| Open | `POST` | `/api/movie-availabilities/{id}/open` |
| Suspend | `POST` | `/api/movie-availabilities/{id}/suspend` |
| Resume | `POST` | `/api/movie-availabilities/{id}/resume` |
| Close | `POST` | `/api/movie-availabilities/{id}/close` |

**Create request:**

```json
{
  "movieId": 30,
  "clusterId": 1,
  "salesStartAt": "2026-08-01T08:00:00",
  "showingStartDate": "2026-08-13",
  "showingEndDate": "2026-09-12"
}
```

**Suspend request:**

```json
{
  "reason": "Projector maintenance affects all scheduled sessions"
}
```

---

## Technical Notes / Constraints

- Không dùng generic `PATCH { status }`; mỗi transition là một business command.
- Suspend toàn bộ Movie chỉ được xem xét cho legal/compliance takedown và phải là use case riêng, không dùng availability suspend thay thế.
- Showtime cancellation vẫn thuộc Showtime domain; availability suspend không được xóa lịch sử showtime.

---

## Related

- Branch: `feat/movie-availability-api`
- Depends on: MOV-LC-03, MOV-LC-04
- Docs: `docs/api-specs/movie-service/movie-service.yaml`

---

# MOV-LC-07 — [Backend] Derive public Now Showing and Coming Soon by cluster

**Labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`, `In Progress`

## Summary / Objective

Thay public filtering dựa trên `Movie.status` bằng read model được suy ra từ content approval, cluster availability và showtimes. Cùng một phim phải có thể là `NOW_SHOWING` ở cluster A, `COMING_SOON` ở cluster B và không public ở cluster C.

---

## Estimate

- [ ] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Public API nhận `clusterId` và chỉ tính trạng thái trong cluster đó
- [ ] Chỉ Movie content `APPROVED` mới có thể xuất hiện public
- [ ] `NOW_SHOWING` khi availability đang `OPEN` và có ít nhất một showtime saleable theo rule thời gian đã chốt
- [ ] `COMING_SOON` khi có availability tương lai hợp lệ nhưng chưa có showtime hiện hành/saleable
- [ ] `SUSPENDED` hoặc `CLOSED` không xuất hiện như public display status
- [ ] Response trả field `displayStatus`, không dùng content `status` cho customer logic
- [ ] Booking CTA chỉ được bật khi có showtime đặt vé được
- [ ] Query tránh N+1 và có index support
- [ ] Có test cùng một Movie tại ít nhất ba cluster với ba kết quả khác nhau
- [ ] Có test boundary theo timezone `Asia/Ho_Chi_Minh`
- [ ] Public detail không làm lộ `DRAFT`, `PENDING_REVIEW`, `CHANGES_REQUESTED`, `ARCHIVED`

---

## API Specifications (if applicable)

### Public Movie listing

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies/public?clusterId={clusterId}` |
| Auth Required | No |

**Response item:**

```json
{
  "movieId": 30,
  "originalTitle": "The Last Horizon",
  "displayStatus": "NOW_SHOWING",
  "clusterId": 1,
  "nextShowtimeAt": "2026-08-13T18:30:00",
  "bookingAvailable": true
}
```

---

## Technical Notes / Constraints

- `displayStatus` là read-model value, không persist lại vào `movie.status`.
- Phải chốt rõ `SCHEDULED` có được xem là saleable hay chỉ `ON_SALE` trong Showtime contract.
- Nếu cho phép gọi không có `clusterId`, contract phải định nghĩa rõ đó là aggregate discovery và không được dùng để kết luận booking availability tại một rạp cụ thể.

---

## Related

- Branch: `feat/public-movie-display-status`
- Depends on: MOV-LC-05, MOV-LC-06
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`

---

# MOV-LC-08 — [Frontend] Integrate Movie Management with canonical content lifecycle API

**Labels:** `Layer::Frontend`, `Type::Feature`, `Priority::Medium`, `In Progress`

## Summary / Objective

Sau khi backend canonical lifecycle được deploy, xóa compatibility mapping legacy khỏi Movie Management và gọi trực tiếp các endpoint/response mới. UI chỉ dựa trên content status thật từ backend và không chứa exhibition-state fallback.

---

## Estimate

- [ ] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `MovieStatus` frontend chỉ còn năm canonical content states
- [ ] Xóa mapping từ `COMING_SOON/NOW_SHOWING/SUSPENDED/ENDED/REJECTED`
- [ ] Request Changes gọi `/request-changes`
- [ ] Start Revision gọi `/start-revision`
- [ ] Archive gọi `/archive`, không gọi `DELETE` legacy
- [ ] Command response cập nhật row từ response hoặc reload an toàn
- [ ] Edit chỉ khả dụng ở `DRAFT`
- [ ] Invalid transition/409 hiển thị message dễ hiểu, không dùng browser `alert`
- [ ] Role visibility khớp backend contract
- [ ] Unit test cho status mapping/action visibility
- [ ] Build và browser QA trên dark/light mode

---

## UI Reference / Mockup

Tái sử dụng UI đã làm ở MOV-LC-01; không redesign table ngoài phạm vi lifecycle integration.

---

## API Specifications (if applicable)

Dùng các endpoint canonical từ MOV-LC-04. Không còn gọi `/reject`, `/rework` và `DELETE /api/movies/{id}` cho lifecycle.

---

## Technical Notes / Constraints

- Chỉ remove compatibility code sau khi migration MOV-LC-05 đã chạy trên môi trường target.
- Không thêm Availability actions vào Movie table; các action đó thuộc MOV-LC-09.

---

## Related

- Branch: `feat/movie-content-lifecycle-integration`
- Depends on: MOV-LC-04, MOV-LC-05
- Docs: `client/src/utils/movieContentStatus.ts`

---

# MOV-LC-09 — [Frontend] Add cluster-scoped Movie Availability management UI

**Labels:** `Layer::Frontend`, `Type::Feature`, `Priority::Medium`, `In Progress`

## Summary / Objective

Thêm khu vực quản lý kế hoạch phát hành theo cluster, tách khỏi Movie content status table. Admin có thể tạo release window và thực hiện open/suspend/resume/close trên đúng availability record.

---

## Estimate

- [ ] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Movie detail admin có section/tab `Availability`
- [ ] Hiển thị cluster, release window, sales start và availability status
- [ ] Tạo plan bắt buộc chọn cluster và date range hợp lệ
- [ ] Chỉ Movie `APPROVED` mới hiển thị Create Availability
- [ ] Action buttons hiển thị đúng theo status/role
- [ ] Suspend bắt buộc nhập reason
- [ ] Conflict/overlap/409 được hiển thị rõ
- [ ] Refresh sau command không làm mất filter/selected Movie
- [ ] Không thay đổi Movie content badge khi open/suspend/close availability
- [ ] QA một Movie có availability khác nhau tại ít nhất hai cluster
- [ ] Build và browser QA dark/light mode

---

## UI Reference / Mockup

Đề xuất đặt Availability trong Movie detail modal/page hoặc route `/admin/movies/{id}/availability`. Không đặt các action này lại vào cột lifecycle của Movie table.

---

## API Specifications (if applicable)

Dùng các endpoint từ MOV-LC-06.

---

## Technical Notes / Constraints

- Tái sử dụng cluster lookup API hiện có.
- Hiển thị `version` conflict bằng message yêu cầu refresh, không tự động ghi đè.
- Showtime creation vẫn ở Showtime module; UI availability chỉ link sang danh sách showtimes liên quan.

---

## Related

- Branch: `feat/movie-availability-management-ui`
- Depends on: MOV-LC-06
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`

---

# MOV-LC-10 — [Frontend] Consume derived public Movie display status by cluster

**Labels:** `Layer::Frontend`, `Type::Feature`, `Priority::High`, `In Progress`

## Summary / Objective

Update homepage và Movies page để lấy `displayStatus` được backend suy ra theo cluster đang chọn. Frontend không tự kết luận Now Showing/Coming Soon từ Movie content status hoặc chỉ từ release date.

---

## Estimate

- [ ] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Public movie request gửi `clusterId` đang chọn
- [ ] Section Now Showing chỉ nhận `displayStatus = NOW_SHOWING`
- [ ] Section Coming Soon chỉ nhận `displayStatus = COMING_SOON`
- [ ] Booking CTA chỉ bật khi `bookingAvailable = true`
- [ ] Đổi cluster làm reload đúng danh sách mà không cần refresh trang
- [ ] Không dùng `movie.movieStatus` content workflow để chia customer sections
- [ ] Empty state rõ ràng khi cluster không có phim hoặc lịch chiếu
- [ ] Không fallback sang mock data trong production khi API lỗi
- [ ] QA cùng một Movie tại hai cluster có display status khác nhau
- [ ] Build và responsive browser QA

---

## UI Reference / Mockup

Các component liên quan: homepage `NowShowing`, `ComingSoon`, `MoviesPage` và location/cluster selector hiện tại.

---

## API Specifications (if applicable)

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies/public?clusterId={clusterId}` |
| Auth Required | No |

Frontend sử dụng `displayStatus`, `nextShowtimeAt`, `bookingAvailable` từ response MOV-LC-07.

---

## Technical Notes / Constraints

- `cp_cluster`/cluster selection hiện tại phải được validate trước khi gọi API.
- Nếu chưa chọn cluster, UI phải yêu cầu chọn địa điểm hoặc dùng behavior fallback đã được contract hóa; không âm thầm lấy trạng thái global.
- Không thay đổi seat booking/showtime selection ngoài phạm vi display status.

---

## Related

- Branch: `feat/customer-movie-status-by-cluster`
- Depends on: MOV-LC-07
- Docs: `docs/api-specs/movie-service/API_CONTRACT.md`

