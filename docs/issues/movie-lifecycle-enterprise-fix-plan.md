# Movie Lifecycle - Kế hoạch Fix và Update theo từng bước

> **Status: Superseded.** Tài liệu này là bản kế hoạch ban đầu. Bản chuẩn hóa thuật ngữ,
> governance và delivery specification được duy trì tại
> [Movie Content Lifecycle Hardening Plan](movie-content-lifecycle-hardening-plan.md).

> **Snapshot source:** 2026-07-14
> **Module:** `server/movie-service` và phần frontend Movie Management liên quan
> **Mục tiêu:** biến luồng tạo/sửa/duyệt/phát hành Movie hiện tại từ mức demo thành một luồng ổn định, có business rule rõ ràng và đủ bằng chứng test.
> **Cách dùng:** mỗi mục `MOV-FIX-*` có thể tách thành một GitLab issue và một MR riêng.

---

## 1. Kết luận baseline

### Đã có

- Movie mới được tạo với trạng thái `DRAFT`.
- Có workflow:

```text
DRAFT -> PENDING_REVIEW -> COMING_SOON -> NOW_SHOWING -> ENDED
                      \-> REJECTED -> DRAFT
```

- Create chạy trong transaction.
- Có genre, screening format, age rating, production company, translation và cast.
- Public list chỉ trả `COMING_SOON` và `NOW_SHOWING`.
- Có scheduler tự chuyển phim quá `endDate` từ `NOW_SHOWING` sang `ENDED`.
- Build hiện tại thành công.

### Chưa đủ để gọi là ổn định

- Chỉ có một test `contextLoads()`, chưa kiểm tra workflow API thật.
- `updateMovie()` đang ghi các field không gửi thành `null`.
- Submit/approve chỉ kiểm tra status, chưa kiểm tra Movie đã đủ dữ liệu hay chưa.
- Public vẫn có thể gọi chi tiết Movie `DRAFT` nếu biết ID.
- ADMIN/EMPLOYEE có thể sửa Movie ở mọi trạng thái.
- Chưa có release-date scheduler `COMING_SOON -> NOW_SHOWING`.
- ShowTime có `format_id`, nhưng request tạo lịch chưa nhận `formatId`.
- Audit create đang ghi cứng `SYSTEM` và `Admin`.
- Duplicate đang dựa duy nhất vào title.

### Nguyên tắc kiến trúc dùng trong tài liệu

Trong phạm vi đồ án hiện tại, giữ state machine Movie đang có. Không refactor toàn bộ thành hệ thống enterprise trong Sprint 3.

Tuy nhiên phải giữ ranh giới:

```text
Movie content status     = trạng thái nội dung và duyệt
Showtime status          = trạng thái một suất chiếu
Cinema/territory release = backlog kiến trúc, không nhét thêm vào Movie.status lúc này
```

---

## 2. Roadmap tổng thể

| Thứ tự | Issue ID | Công việc | Priority | Size | Phụ thuộc |
|---:|---|---|---|---|---|
| 1 | `MOV-FIX-01` | Fix partial update ghi đè field thành null | P0 | S | Không |
| 2 | `MOV-FIX-02` | Thêm validation ngày và readiness trước submit/approve/release | P0 | M | 01 |
| 3 | `MOV-FIX-03` | Chặn public đọc Movie chưa publish | P0 | S/M | Không |
| 4 | `MOV-FIX-04` | Giới hạn chỉnh sửa theo lifecycle | P0 | S | 01, 02 |
| 5 | `MOV-FIX-05` | Hoàn thành release-date scheduler | P0 | M | 02 |
| 6 | `MOV-FIX-06` | Nối Movie Format với ShowTime và Cinema Room | P0/P1 | L | 02 |
| 7 | `MOV-FIX-07` | Chuẩn hóa audit actor và transition log | P0 | M | 02, 04, 05 |
| 8 | `MOV-FIX-08` | Viết unit/integration/API tests cho toàn flow | P0 | M/L | 01-07 |
| 9 | `MOV-FIX-09` | Sửa duplicate identity rule | P1 | M | 01, 08 |
| 10 | `MOV-PLAN-01` | Tách release window/rating theo territory | Backlog | L/XL | Sau Sprint 3 |

Không mở đồng thời quá 2 issue có thay đổi trực tiếp `MovieService.java` để giảm conflict khi merge.

---

## 3. Quy ước chung cho mọi issue

### API error response

Giữ envelope hiện tại:

```json
{
  "code": 2031,
  "message": "Movie is not ready for review: ageRating, releaseDate, poster, vi translation",
  "result": null
}
```

### Error code đề xuất

Kiểm tra lại code mới nhất trước khi dùng để tránh trùng số.

| Error | Code đề xuất | HTTP |
|---|---:|---:|
| `MOVIE_NOT_READY_FOR_REVIEW` | 2031 | 400 |
| `MOVIE_NOT_PUBLIC` | 2032 | 404 |
| `MOVIE_NOT_EDITABLE` | 2033 | 409 |
| `INVALID_MOVIE_DATE_RANGE` | 2034 | 400 |
| `MOVIE_FORMAT_NOT_SUPPORTED` | 2035 | 400 |
| `ROOM_FORMAT_NOT_SUPPORTED` | 2036 | 400 |
| `MOVIE_NOT_READY_FOR_RELEASE` | 2037 | 400 |

### Definition of Done chung

- [ ] Có unit test cho business rule mới.
- [ ] Có integration/controller test cho happy path và forbidden path.
- [ ] API contract đã update.
- [ ] Postman manual data đã update nếu payload thay đổi.
- [ ] Frontend không gọi endpoint cũ/bị breaking.
- [ ] `mvnw -pl movie-service -am test` thành công.
- [ ] Có ảnh hoặc log Postman đính kèm MR.
- [ ] Không sửa ngoài scope issue nếu không cần thiết.

---

## 4. MOV-FIX-01 - Fix partial update ghi đè field thành null

### Tên issue đề xuất

```text
[Backend] Fix Movie partial update null overwrite and duplicate validation
```

### Hiện trạng

`UpdateMovieRequest` có tất cả field optional, nên API đang được sử dụng như partial update. Nhưng MapStruct generated code hiện gọi:

```java
movie.setOriginalTitle(request.getOriginalTitle());
movie.setOriginalLanguage(request.getOriginalLanguage());
movie.setDurationMinutes(request.getDurationMinutes());
movie.setReleaseDate(request.getReleaseDate());
```

Nếu client chỉ gửi:

```json
{
  "posterUrl": "https://example.com/new-poster.jpg"
}
```

thì title, language, duration và các scalar field khác có thể bị gán `null`.

### Quyết định MVP

- Giữ `PUT /api/movies/{id}` để không phá frontend trong Sprint 3.
- Tạm coi endpoint này là partial update.
- Field `null` nghĩa là **không thay đổi**.
- Empty list nghĩa là **xóa toàn bộ quan hệ** đối với `translations`, `cast`, `genreIds`, `formatIds`.
- Sau Sprint 3 có thể đổi route thành `PATCH` để đúng semantics HTTP hơn.

### File cần sửa

- `server/movie-service/src/main/java/movieservice/mapper/MovieMapper.java`
- `server/movie-service/src/main/java/movieservice/service/MovieService.java`
- `server/movie-service/src/main/java/movieservice/dto/request/UpdateMovieRequest.java`
- `server/movie-service/src/test/.../MovieServiceTest.java`
- `docs/api-specs/movie-service/API_CONTRACT.md`

### Hướng implement

1. Thêm MapStruct null-ignore:

```java
@BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
void updateMovieFromRequest(UpdateMovieRequest request, @MappingTarget Movie movie);
```

2. Nếu request có `originalTitle` mới, kiểm tra duplicate nhưng loại trừ chính Movie đang update.
3. Normalize title trước khi so sánh tối thiểu bằng `trim()`.
4. Giữ rule quan hệ:

```text
genreIds = null  -> giữ nguyên
genreIds = []    -> reject vì Movie phải có ít nhất một genre
formatIds = null -> giữ nguyên
formatIds = []   -> reject vì Movie phải có ít nhất một format
translations=[]  -> cho phép xóa toàn bộ khi Movie còn DRAFT
cast=[]          -> cho phép xóa toàn bộ khi Movie còn DRAFT
```

5. Nếu nghiệp vụ cần clear `endDate`, không dùng null-ignore chung để biểu diễn thao tác đó. Tạo endpoint/action rõ ràng hoặc bổ sung flag `clearEndDate` sau này.

### Acceptance criteria

- [ ] Update chỉ `posterUrl` không làm mất title/language/duration.
- [ ] Update title trùng Movie khác trả 409.
- [ ] Update giữ nguyên relations khi field relation không xuất hiện.
- [ ] `genreIds=[]` và `formatIds=[]` trả 400.
- [ ] Transaction rollback nếu một reference ID không tồn tại.

### Test API

```http
PUT /api/movies/{draftMovieId}
Authorization: Bearer <employee-token>
Content-Type: application/json
```

```json
{
  "posterUrl": "https://example.com/poster-v2.jpg"
}
```

Sau update, GET lại và assert:

```text
originalTitle     không đổi
originalLanguage  không đổi
durationMinutes   không đổi
posterUrl         đã đổi
```

---

## 5. MOV-FIX-02 - Movie readiness validation

### Tên issue đề xuất

```text
[Backend] Validate Movie readiness before review, approval and release
```

### Vấn đề

Hiện tại:

```java
submitForReview() -> chỉ require DRAFT
approveMovie()    -> chỉ require PENDING_REVIEW
releaseMovie()    -> chỉ require COMING_SOON
```

Một payload tối thiểu thiếu rating, poster, release date và translation vẫn có thể được approve.

### Thiết kế đề xuất

Tạo component riêng:

```text
MovieReadinessValidator
  - validateForReview(Movie)
  - validateForApproval(Movie)
  - validateForRelease(Movie)
```

Không nhét toàn bộ readiness vào DTO create vì `DRAFT` được phép chưa hoàn thiện.

### Rule MVP

#### Ready for review

- Có original title.
- Language code hợp lệ 2 ký tự chữ cái.
- Duration > 0.
- Có ít nhất một genre.
- Có ít nhất một screening format.
- Có release date.
- Có age rating.
- Có poster URL.
- Có synopsis.
- Có translation tiếng Việt với title không rỗng.
- Nếu có end date thì `endDate >= releaseDate`.

#### Ready for approval/public

- Thỏa toàn bộ review readiness.
- Age rating không phải `C`.
- Media URL có URI hợp lệ.
- Không có duplicate translation language.
- Cast role thuộc:

```text
ACTOR, DIRECTOR, WRITER, PRODUCER, COMPOSER
```

#### Ready for release/NOW_SHOWING

- Thỏa approval readiness.
- `releaseDate <= today`.
- Với scope hiện tại: yêu cầu `endDate != null` để end-date scheduler có ý nghĩa.
- `endDate >= today`.
- Có ít nhất một future showtime không bị cancelled.

Nếu Product Owner muốn cho phép lịch chiếu mở không có ngày kết thúc, bỏ rule bắt buộc `endDate`, nhưng phải ghi rõ scheduler chỉ auto-end khi field này có giá trị.

### Validation nên chạy ở đâu

| Thời điểm | Validation |
|---|---|
| Create/update | Format field cơ bản và date relation nếu cả hai ngày đã có |
| Submit | `validateForReview()` |
| Approve | `validateForApproval()` |
| Manual release | `validateForRelease()` |
| Auto release scheduler | `validateForRelease()`; skip và log nếu chưa đạt |

### File cần sửa/thêm

- `dto/request/CreateMovieRequest.java`
- `dto/request/UpdateMovieRequest.java`
- `service/MovieReadinessValidator.java` - mới
- `service/MovieService.java`
- `exception/MovieErrorCode.java`
- Unit test cho validator

### Lưu ý implementation

- Không trả lỗi lần lượt từng field nếu có thể. Nên gom danh sách field thiếu để admin sửa một lần.
- Dùng `Set` để kiểm tra duplicate genre/format/translation trước khi query DB.
- Cast role nên đổi từ `String` sang enum ở DTO/service; không chờ DB constraint trả lỗi 409 chung.
- Dùng URL/URI validator rõ ràng; không gọi remote URL để validate.

### Acceptance criteria

- [ ] Minimal draft vẫn tạo được.
- [ ] Minimal draft không submit được.
- [ ] Missing fields xuất hiện rõ trong message.
- [ ] `endDate < releaseDate` bị chặn ở create/update/submit.
- [ ] Rating `C` không approve hoặc release được.
- [ ] Movie chưa có future showtime không chuyển NOW_SHOWING.
- [ ] Valid Movie đi qua toàn workflow.

### Postman cases

- `MOV-CREATE-01`: tạo minimal draft -> 200 DRAFT.
- `MC-GAP-01`: submit minimal draft -> sau fix phải 400 code 2031.
- `MC-GAP-03`: end date trước release date -> sau fix phải 400 code 2034.
- Full Movie -> submit -> approve -> tạo showtime -> release thành công.

---

## 6. MOV-FIX-03 - Chặn public visibility leak

### Tên issue đề xuất

```text
[Backend] Enforce public Movie visibility for detail endpoints
```

### Hiện trạng

- `GET /api/movies/**` đang được permit public.
- `GET /api/movies/public` lọc đúng status.
- `GET /api/movies/{id}` lấy trực tiếp theo ID, không lọc status.

Người ngoài biết ID có thể đọc `DRAFT`, `PENDING_REVIEW`, `REJECTED`, `SUSPENDED` hoặc `ENDED`.

### API design đề xuất

Giữ public endpoint an toàn:

```text
GET /api/movies/{id}
-> chỉ COMING_SOON hoặc NOW_SHOWING
-> status khác trả 404 để không leak sự tồn tại
```

Thêm endpoint nội bộ:

```text
GET /api/movies/internal/{id}
Roles: ADMIN, EMPLOYEE
-> trả mọi status
```

Không dựa vào việc client có gửi token hay không trong cùng một method; tách endpoint giúp rule dễ test và ít nhầm.

### File cần sửa

- `controller/MovieController.java`
- `service/MovieService.java`
- `repository/MovieRepository.java`
- `config/SecurityConfig.java`
- `client/src/api/movieApi.ts`
- Admin Movie pages đang gọi GET detail
- API contract và Postman collection

### Repository method đề xuất

```java
Optional<Movie> findByMovieIdAndStatusIn(Long id, Collection<MovieStatus> statuses);
```

### Acceptance criteria

- [ ] Public GET DRAFT trả 404.
- [ ] Public GET REJECTED/SUSPENDED/ENDED trả 404.
- [ ] Public GET COMING_SOON/NOW_SHOWING trả 200.
- [ ] ADMIN/EMPLOYEE lấy được mọi status qua internal endpoint.
- [ ] Admin frontend vẫn mở được edit/review page.
- [ ] Public list và detail dùng cùng visibility policy.

### Test API

```text
Create DRAFT -> GET /api/movies/{id} no token -> 404
GET /api/movies/internal/{id} employee token -> 200
Approve -> GET /api/movies/{id} no token -> 200
Suspend -> GET /api/movies/{id} no token -> 404
```

---

## 7. MOV-FIX-04 - Giới hạn chỉnh sửa theo lifecycle

### Tên issue đề xuất

```text
[Backend] Restrict Movie editing by lifecycle status
```

### Rule MVP

| Status | Có được update content? | Ghi chú |
|---|---|---|
| `DRAFT` | Có | EMPLOYEE/ADMIN |
| `REJECTED` | Không trực tiếp | Gọi `/rework` trước để về DRAFT |
| `PENDING_REVIEW` | Không | Tránh thay đổi dữ liệu trong lúc admin review |
| `COMING_SOON` | Không | Thay đổi phải qua re-approval, backlog |
| `NOW_SHOWING` | Không | Chỉ dùng suspend/end action |
| `SUSPENDED` | Không | Chỉ reinstate/end hoặc workflow riêng |
| `ENDED` | Không | Archive/read-only |

### Hướng implement

1. Trong `updateMovie()`, load Movie rồi require `DRAFT` trước khi mapper chạy.
2. Trả `MOVIE_NOT_EDITABLE` 409 thay vì dùng chung `INVALID_STATUS_TRANSITION`.
3. Frontend ẩn nút Edit khi status không phải DRAFT.
4. Review page cần reject; employee gọi rework; sau đó mới edit và submit lại.
5. Nếu có nhu cầu hotfix poster của phim live, tạo issue riêng cho `metadata correction workflow`; không bypass rule bằng role ADMIN trong MVP.

### Acceptance criteria

- [ ] DRAFT update được.
- [ ] REJECTED phải rework trước.
- [ ] PENDING_REVIEW không update được.
- [ ] COMING_SOON/NOW_SHOWING không update được.
- [ ] UI không hiển thị action trái rule.
- [ ] Concurrent update không làm mất dữ liệu; cân nhắc `@Version` ở P1.

---

## 8. MOV-FIX-05 - Hoàn thành release-date scheduler

### Tên issue đề xuất

```text
[Backend] Auto-release COMING_SOON Movies on release date
```

### Hiện trạng

Scheduler hiện chỉ có:

```text
NOW_SHOWING + endDate < today -> ENDED
```

Sprint scope yêu cầu thêm:

```text
COMING_SOON + releaseDate <= today -> NOW_SHOWING
```

### Thiết kế đề xuất

1. Thêm repository query:

```java
List<Movie> findByStatusAndReleaseDateLessThanEqual(MovieStatus status, LocalDate date);
```

2. Thêm job chạy 00:01 hoặc gộp vào scheduler hiện tại.
3. Cấu hình timezone rõ ràng:

```java
@Scheduled(cron = "0 1 0 * * *", zone = "Asia/Ho_Chi_Minh")
```

Không dùng `Asia/Saigon`; PostgreSQL hiện có thể từ chối timezone alias này.

4. Không update status trực tiếp nếu muốn giữ business rule. Gọi một service transition dùng chung readiness và audit.
5. Job phải idempotent: chạy lại không làm hỏng dữ liệu.
6. Một Movie lỗi readiness không được làm fail toàn batch; skip, log Movie ID và lý do.
7. Nếu release date bị sửa sau khi đã NOW_SHOWING, không tự rollback về COMING_SOON.

### Clock/testability

Không gọi `LocalDate.now()` rải rác. Inject `Clock` hoặc một `BusinessClock` để unit test ngày ổn định.

### Acceptance criteria

- [ ] COMING_SOON có release date hôm nay và ready -> NOW_SHOWING.
- [ ] Release date tương lai -> giữ COMING_SOON.
- [ ] Movie không ready -> giữ COMING_SOON và có warning log/audit.
- [ ] Chạy job hai lần không tạo transition/log trùng không cần thiết.
- [ ] End scheduler vẫn hoạt động.
- [ ] Test không phụ thuộc ngày thật của máy chạy CI.

---

## 9. MOV-FIX-06 - Enforce Movie Format khi tạo ShowTime

### Tên issue đề xuất

```text
[Backend] Select and validate screening format when creating ShowTime
```

### Hiện trạng

- Movie có danh sách `formats`.
- Entity ShowTime có `format_id`.
- `CreateShowTimeRequest` và `UpdateShowTimeRequest` chưa có `formatId`.
- `ShowTimeResponse` chưa trả format.
- `createStandalone()` không set format.

### Rule bắt buộc

```text
Selected format phải tồn tại
AND selected format phải thuộc Movie.formats
AND CinemaRoom phải hỗ trợ selected format
```

### Lựa chọn thiết kế

#### Option A - MVP Sprint 3

- Thêm `formatId` bắt buộc vào ShowTime create.
- Validate format thuộc Movie.
- Rule phòng tối thiểu:

```text
IMAX format -> chỉ IMAX room
2D          -> mọi room ACTIVE
```

- 3D/4DX/SCREENX chưa thể validate chính xác vì Room hiện chỉ có STANDARD/LARGE/IMAX.

#### Option B - Sát doanh nghiệp hơn

Thêm quan hệ:

```text
cinema_room_format
  cinema_room_id
  format_id
  UNIQUE(cinema_room_id, format_id)
```

Khi tạo phòng, admin chọn `supportedFormatIds`. ShowTime chỉ chọn format trong giao của:

```text
Movie.formats INTERSECT CinemaRoom.supportedFormats
```

Khuyến nghị: làm Option A trong Sprint 3, tạo issue P1 cho Option B nếu thời gian ngắn.

### File cần sửa

- `dto/request/CreateShowTimeRequest.java`
- `dto/request/UpdateShowTimeRequest.java`
- `dto/response/ShowTimeResponse.java`
- `service/ShowTimeService.java`
- `mapper/MovieMapper.java` hoặc mapper ShowTime riêng
- `exception/MovieErrorCode.java`
- Frontend admin showtime form/API
- API contract, Postman data
- Nếu Option B: entity/repository/migration CinemaRoom format

### Acceptance criteria

- [ ] Thiếu formatId trả 400.
- [ ] Format không tồn tại trả 404/400 với code domain rõ ràng.
- [ ] Format không thuộc Movie trả 400 code 2035.
- [ ] IMAX format trong STANDARD room trả 400 code 2036.
- [ ] Valid format được lưu vào `show_time.format_id`.
- [ ] GET schedule trả `formatId`, `formatCode`, `formatName`.
- [ ] Update showtime chạy lại toàn bộ compatibility validation.

---

## 10. MOV-FIX-07 - Chuẩn hóa audit

### Tên issue đề xuất

```text
[Backend] Record authenticated actor and Movie lifecycle audit events
```

### Hiện trạng

Create đang log:

```java
logAction("SYSTEM", "Admin", ...)
```

Các transition chưa log nhất quán. `MovieActionLog` chưa có action type enum trong entity hiện tại.

### Audit event tối thiểu

```text
MOVIE_CREATED
MOVIE_UPDATED
MOVIE_SUBMITTED
MOVIE_APPROVED
MOVIE_REJECTED
MOVIE_REWORKED
MOVIE_RELEASED
MOVIE_SUSPENDED
MOVIE_REINSTATED
MOVIE_ENDED
```

### Dữ liệu log nên có

| Field | Nội dung |
|---|---|
| accountId | JWT subject/account ID nếu có |
| actor | username/email từ authentication |
| actionType | enum ở trên |
| target | `movie:{movieId}` |
| fromStatus | Status trước action |
| toStatus | Status sau action |
| reason/note | Reject/suspend/system reason |
| timestamp | Server time |

Không ghi token hoặc dữ liệu nhạy cảm.

### Hướng implement

1. Tạo `CurrentActorProvider` đọc `SecurityContextHolder` tại một nơi duy nhất.
2. Service lấy actor từ provider hoặc controller truyền một actor object, không truyền nhiều String rời.
3. Thêm `MovieActionType` enum và migration nếu DB chưa có `action_type`.
4. Transition và audit nên nằm cùng transaction.
5. Scheduler dùng actor `SYSTEM:SCHEDULER`.
6. Log update chỉ cần field names đã thay đổi; không bắt buộc snapshot toàn bộ ở Sprint 3.

### Acceptance criteria

- [ ] Create bởi EMPLOYEE ghi đúng employee.
- [ ] Approve bởi ADMIN ghi đúng admin.
- [ ] Scheduler ghi `SYSTEM:SCHEDULER`.
- [ ] Reject/suspend lưu note/reason.
- [ ] Transaction fail thì audit event không bị lưu riêng.
- [ ] Có endpoint nội bộ hoặc repository test để kiểm tra audit history.

---

## 11. MOV-FIX-08 - Test automation cho toàn flow

### Tên issue đề xuất

```text
[Test] Add Movie lifecycle integration and authorization coverage
```

### Mục tiêu

Thay `contextLoads()` bằng bằng chứng thực sự cho business flow. Không xóa context test nếu team vẫn muốn giữ smoke test; bổ sung test có assertion.

### Test pyramid đề xuất

#### Unit tests

- `MovieReadinessValidatorTest`
- Date-range validation.
- Public visibility policy.
- Movie editable-status policy.
- Format compatibility policy.
- Scheduler với fixed `Clock`.

#### Service tests

- Create full Movie.
- Rollback khi person/format không tồn tại.
- Partial update không null overwrite.
- Submit/approve/reject/rework transitions.
- Duplicate title update excluding self.

#### Controller/security tests

- Public GET DRAFT -> 404.
- Public GET COMING_SOON -> 200.
- EMPLOYEE create/submit -> allowed.
- EMPLOYEE approve -> 403.
- ADMIN approve/release -> allowed nếu ready.
- Update non-DRAFT -> 409.

#### Integration tests

Theo `docs/agile/TEST_PLAN.md`, ưu tiên Testcontainers PostgreSQL cho persistence rules. Không dùng shared dev DB.

### Flow integration bắt buộc

```text
1. Seed reference data
2. Create valid DRAFT
3. Verify not public
4. Submit -> PENDING_REVIEW
5. Employee approve -> 403
6. Admin approve -> COMING_SOON
7. Verify public
8. Create valid showtime with format
9. Release -> NOW_SHOWING
10. Scheduler end -> ENDED
11. Verify no longer public
12. Verify audit event chain
```

### Runtime/config issue cần xử lý trong test

Lần chạy hiện tại có log PostgreSQL từ chối timezone `Asia/Saigon`. Chuẩn hóa test/application timezone thành:

```text
Asia/Ho_Chi_Minh
```

Test không nên đăng ký Eureka hoặc phụ thuộc Redis/Kafka nếu case không cần; dùng test profile để disable external integrations.

### Exit criteria

- [ ] Không còn chỉ một `contextLoads()`.
- [ ] Happy lifecycle có integration test.
- [ ] Mỗi P0 business rule có ít nhất một negative test.
- [ ] Test chạy lặp lại không phụ thuộc dữ liệu dev.
- [ ] CI chạy cùng command với local.
- [ ] Postman vẫn được dùng làm evidence manual, nhưng không thay thế test automation.

---

## 12. MOV-FIX-09 - Cải thiện duplicate identity

### Tên issue đề xuất

```text
[Backend][Database] Replace title-only Movie duplicate rule
```

### Hiện trạng

```text
existsByOriginalTitleIgnoreCase(title)
```

Rule này:

- Chặn hai phim khác nhau nhưng cùng tên.
- Không mô hình hóa theatrical cut/director's cut.
- Error message nói title tiếng Việt + format nhưng code không kiểm tra như vậy.

### Rule MVP

Ưu tiên external ID nếu có:

```text
tmdbId unique
imdbId unique
```

Manual create không có external ID:

```text
normalizedOriginalTitle + releaseYear + country
```

Normalization tối thiểu:

```text
trim
lowercase
collapse repeated spaces
Unicode normalization nếu cần
```

Không đưa format vào identity của Movie gốc; format là cách trình chiếu, không phải một phim khác.

### Acceptance criteria

- [ ] Cùng title/cùng year/cùng country bị chặn.
- [ ] Cùng title nhưng khác year được tạo.
- [ ] Trùng TMDB/IMDb ID bị chặn bằng domain error rõ ràng.
- [ ] Update một Movie không tự nhận chính nó là duplicate.
- [ ] Message và implementation thống nhất.
- [ ] Có migration/index phù hợp nếu enforce ở DB.

### Enterprise reference

EIDR dùng persistent identifier và quan hệ giữa Movie/Edit/Manifestation để phân biệt tác phẩm và phiên bản. Đồ án không cần tích hợp EIDR ngay, nhưng không nên dùng title đơn lẻ làm identity lâu dài.

---

## 13. MOV-PLAN-01 - Backlog kiến trúc sau Sprint 3

Không triển khai mục này trước khi P0 hoàn thành.

### 13.1 Tách content status và exhibition availability

Mô hình tương lai:

```text
MovieContent
  DRAFT -> PENDING_REVIEW -> APPROVED -> ARCHIVED

MovieReleaseWindow
  movie_id
  territory/cinema_cluster_id
  release_date
  end_date
  distributor_id
  status

ShowTime
  SCHEDULED -> ON_SALE -> ACTIVE -> COMPLETED/CANCELLED
```

Lý do: cùng một phim có thể NOW_SHOWING tại một cụm nhưng COMING_SOON hoặc ENDED ở cụm khác.

### 13.2 Rating theo territory

Mô hình tương lai:

```text
movie_rating
  movie_id
  territory_code
  rating_system
  rating_code
  warning/reason
```

Tại Việt Nam cần hỗ trợ P, K, T13, T16, T18, C và hiển thị trên website/app/quầy vé theo quy định áp dụng.

### 13.3 Multiple production/distribution companies

Tách:

```text
movie_company
  movie_id
  company_id
  role = PRODUCER | DISTRIBUTOR | STUDIO
  territory
```

### 13.4 Versioning/concurrency

- Thêm `@Version` để chống lost update.
- Approved content thay đổi phải tạo change request hoặc quay lại review.
- Lưu revision nếu có yêu cầu audit mạnh.

---

## 14. Thứ tự MR khuyến nghị

```text
MR-1  fix/movie-partial-update
MR-2  feat/movie-readiness-validation
MR-3  fix/movie-public-visibility
MR-4  fix/movie-edit-status-policy
MR-5  feat/movie-release-date-scheduler
MR-6  feat/showtime-format-compatibility
MR-7  feat/movie-lifecycle-audit
MR-8  test/movie-lifecycle-integration
MR-9  refactor/movie-duplicate-identity
```

Mỗi MR phải merge và test xong trước khi MR phụ thuộc rebase vào develop.

---

## 15. Checklist theo dõi triển khai

| Issue | Assignee | Branch | MR | Code done | Tests pass | API docs | Postman | Merged |
|---|---|---|---|---|---|---|---|---|
| MOV-FIX-01 |  |  |  | [ ] | [ ] | [ ] | [ ] | [ ] |
| MOV-FIX-02 |  |  |  | [ ] | [ ] | [ ] | [ ] | [ ] |
| MOV-FIX-03 |  |  |  | [ ] | [ ] | [ ] | [ ] | [ ] |
| MOV-FIX-04 |  |  |  | [ ] | [ ] | [ ] | [ ] | [ ] |
| MOV-FIX-05 |  |  |  | [ ] | [ ] | [ ] | [ ] | [ ] |
| MOV-FIX-06 |  |  |  | [ ] | [ ] | [ ] | [ ] | [ ] |
| MOV-FIX-07 |  |  |  | [ ] | [ ] | [ ] | [ ] | [ ] |
| MOV-FIX-08 |  |  |  | [ ] | [ ] | [ ] | [ ] | [ ] |
| MOV-FIX-09 |  |  |  | [ ] | [ ] | [ ] | [ ] | [ ] |

---

## 16. Source tham khảo nghiệp vụ

- EIDR - persistent audiovisual identity và version relationships: <https://www.eidr.org/faq>
- MovieLabs Common Metadata: <https://movielabs.com/md/md/>
- MovieLabs Common Metadata Ratings: <https://movielabs.com/md/ratings/>
- Vista Film Programming - plan, schedule và review giữa head office/cinema: <https://help.vista.co/hc/en-nz/articles/22355345190297-About-film-programming>
- Vista Film Form - movie format và screen attributes: <https://help.vista.co/hc/en-nz/articles/20782547475097-Film-form>
- Vista Program Scheduler - chọn một Movie Format cho session: <https://help.vista.co/hc/en-nz/articles/22872381283865-Film-Programming-Program-Scheduler>
- Thông tư 05/2023/TT-BVHTTDL về phân loại và hiển thị mức phân loại phim: <https://vbpl.vn/botuphap/Pages/vbpq-print.aspx?ItemID=160086>

---

## 17. Phạm vi không làm trong tài liệu này

- Không implement EIDR integration.
- Không xây film hire contract hoặc revenue share với distributor.
- Không xây AI scheduling/forecasting.
- Không xử lý refund/payment workflow.
- Không refactor toàn bộ Movie status theo từng cinema trong Sprint 3.
- Không chỉnh production data trực tiếp để che lỗi validation.

Mục tiêu trước mắt là bảo đảm dữ liệu Movie đúng, không bị public sớm, không sửa trái lifecycle, format showtime có thể kiểm soát và mọi transition có test/audit.
