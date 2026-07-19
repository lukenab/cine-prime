# Movie Editor Redesign — GitLab Issue Pack

## 1. Mục tiêu

Chuẩn hóa trang tạo/chỉnh sửa phim thành một **guided content workflow** thay vì một biểu mẫu dài kèm TMDB browser ở sidebar. Người vận hành cần có thể chọn nguồn tạo phim, lưu draft sớm, hoàn thiện metadata theo từng section, xử lý mapping/warning tại bước Review và chỉ submit khi movie đạt readiness gate.

Phạm vi này chỉ thay đổi **content-authoring workflow**. `endDate` và các quyết định ngừng chiếu thuộc exhibition/scheduling lifecycle, không còn được chỉnh trong Movie Editor.

---

## 2. Kiểm soát issue trùng

| Nhu cầu | Hướng xử lý |
|---|---|
| TMDB preview không ghi DB | Reuse dependency `#188` |
| Preview/import dùng chung mapping pipeline | Reuse dependency `#189` |
| Genre TMDB không bị drop âm thầm | Reuse/extend `#190` |
| Chọn official trailer | Reuse dependency `#191` |
| Chọn poster, backdrop và stills | Reuse dependency `#192` |
| Provenance và safe re-sync | Reuse dependency `#193` |
| TMDB warnings, mappings và media preview | **Update `#197`**, không tạo lại feature tương đương |
| Tách approval khỏi exhibition lifecycle | Reuse dependency `#173` |

Các mã `MOV-EDITOR-*` bên dưới là mã tạm để thể hiện dependency trước khi GitLab cấp issue number.

---

## 3. Thứ tự triển khai

### P0 — Demo-ready authoring flow

| Order | ID | Issue | Estimate | Dependency |
|---:|---|---|---|---|
| 1 | `MOV-EDITOR-01` | Add movie creation method selection and full-width TMDB catalog | M | `#188`, `#189` |
| 2 | `MOV-EDITOR-04` | Remove exhibition end date from Movie Editor | S | `#173` |
| 3 | `MOV-EDITOR-02` | Reorganize Movie Editor into navigable workflow sections | L | `MOV-EDITOR-01` |
| 4 | `MOV-EDITOR-03` | Add sticky draft and review action bar | M | `MOV-EDITOR-02` |
| 5 | `MOV-EDITOR-05` | Consolidate movie assets into a Media section | M | `#191`, `#192` |
| 6 | `MOV-EDITOR-06` | Add readiness summary and inline validation | M | `MOV-EDITOR-02`, `MOV-EDITOR-03` |
| 7 | `MOV-EDITOR-07` | Integrate TMDB mappings and warnings into Review | M | Update `#197`, `MOV-EDITOR-02` |

### P1 — Reduce operator effort

| Order | ID | Issue | Estimate | Dependency |
|---:|---|---|---|---|
| 8 | `MOV-EDITOR-08` | Expose non-destructive TMDB mapping suggestions | L | `#189`, `#190`, `#193` |
| 9 | `MOV-EDITOR-09` | Apply smart TMDB defaults with operator override | M | `MOV-EDITOR-05`, `MOV-EDITOR-08` |
| 10 | `MOV-EDITOR-10` | Use progressive disclosure for movie cast editing | S | `MOV-EDITOR-02` |
| 11 | `MOV-EDITOR-11` | Support versioned partial updates for draft autosave | M | Existing update contract |
| 12 | `MOV-EDITOR-12` | Add debounced Movie Editor autosave | M | `MOV-EDITOR-03`, `MOV-EDITOR-11` |
| 13 | `MOV-EDITOR-13` | Add customer-facing movie preview | M | `MOV-EDITOR-02`, `MOV-EDITOR-05` |
| 14 | `MOV-EDITOR-14` | Navigate from review warnings to editor fields | S | `MOV-EDITOR-06`, `MOV-EDITOR-07` |

---

# P0 Issues

## MOV-EDITOR-01 — [Frontend] Add movie creation method selection and full-width TMDB catalog

### Summary / Objective

Khi người dùng chọn Add Movie, hệ thống phải hiển thị bước chọn nguồn tạo phim gồm `Import from catalog` và `Create manually`. TMDB discovery/browser được chuyển thành một workspace toàn chiều rộng thay vì nằm ở cột phải của Movie Editor, giúp người dùng duyệt upcoming catalog hoặc tìm kiếm trước khi khởi tạo draft.

---

### Estimate

- [x] M (2–4h)

---

### Acceptance Criteria (Definition of Done)

- [ ] `/admin/movies/new` hiển thị hai lựa chọn rõ ràng: `Import from catalog` và `Create manually`.
- [ ] `Import from catalog` mở catalog view toàn chiều rộng, hỗ trợ upcoming list, keyword search, pagination và loading/error/empty state.
- [ ] Chọn một movie mở read-only preview trước khi người dùng bấm `Use this movie`.
- [ ] Browse/preview TMDB không tạo hoặc cập nhật local movie record.
- [ ] `Use this movie` tạo editor state từ TMDB preview rồi chuyển sang guided editor.
- [ ] `Create manually` mở guided editor với form rỗng.
- [ ] Edit movie hiện hữu đi thẳng vào editor, không hiển thị source selector.
- [ ] Back từ catalog về source selector không tạo draft rác.
- [ ] TMDB browser cũ được gỡ khỏi right column của `MovieEditorPage`.
- [ ] Frontend tests cover manual mode, catalog mode, preview và back-without-write.
- [ ] `npm run build` pass; browser QA light/dark mode.

---

### UI Reference / Mockup

- Source selection dùng hai option card trên dedicated page, không dùng modal lồng trong editor.
- Catalog view gồm filter/search ở đầu trang, results grid/list ở giữa và preview panel/drawer theo viewport.

---

### Technical Notes / Constraints

- Dùng query/route state có contract rõ ràng, ví dụ `?source=manual` và `?source=tmdb`.
- Reuse `tmdbUpcoming`, `tmdbSearch` và read-only `tmdbDetails`; không thêm mapping pipeline ở frontend.
- Không gọi import/create API trước explicit user action.

---

### Related

- Branch: `feat/movie-creation-source-selector`
- Depends on: `#188`, `#189`
- Docs: `docs/issues/movie-editor-redesign-issue-pack.md`

---

## MOV-EDITOR-02 — [Frontend] Reorganize Movie Editor into navigable workflow sections

### Summary / Objective

Chuyển Movie Editor từ bố cục hai cột dài thành guided workflow có section navigation. Các nhóm thông tin phải phản ánh nghiệp vụ content authoring và cho phép người dùng biết mình đang ở bước nào mà không mất dữ liệu khi điều hướng.

---

### Estimate

- [x] L (4–8h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Editor có các section canonical: `Overview`, `Classification & Release`, `Media`, `Credits` và `Review`.
- [ ] Desktop có sticky section navigation; mobile/tablet có compact stepper hoặc section menu tương đương.
- [ ] Click section navigation scroll/focus đúng section và URL/hash có thể phản ánh section hiện tại.
- [ ] Active section được cập nhật khi người dùng scroll.
- [ ] Điều hướng section không reset controlled form state, imported preview hoặc media selections.
- [ ] Mỗi field chỉ có một canonical location; không còn poster/TMDB/gallery duplicate ở sidebar.
- [ ] Section navigation hỗ trợ keyboard, focus state và accessible name.
- [ ] Edit mode và create mode dùng chung editor shell.
- [ ] Responsive QA không có dropdown bị clip hoặc action bị khuất.
- [ ] Component tests cover navigation và state preservation.

---

### UI Reference / Mockup

- Desktop: left section rail nhỏ + main editor canvas.
- Không duy trì right column cố định cho TMDB browser.

---

### Technical Notes / Constraints

- Tách section thành component nhỏ; không tiếp tục mở rộng một file `MovieEditorPage.tsx` monolithic.
- Form state vẫn có một owner duy nhất; section component nhận typed props hoặc form context.
- Dùng stable section/field IDs để phục vụ `MOV-EDITOR-14`.

---

### Related

- Branch: `feat/movie-editor-guided-sections`
- Depends on: `MOV-EDITOR-01`
- Docs: `docs/issues/movie-editor-redesign-issue-pack.md`

---

## MOV-EDITOR-03 — [Frontend] Add sticky draft and review action bar to Movie Editor

### Summary / Objective

Chuẩn hóa action semantics của Movie Editor thành `Save Draft` và `Submit for Review`. Action bar phải luôn nhìn thấy, phản ánh dirty/saving/saved state và không khiến người dùng nhầm thao tác lưu nội dung với lifecycle transition.

---

### Estimate

- [x] M (2–4h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Sticky action bar hiển thị `Save Draft` và `Submit for Review` ở vị trí nhất quán.
- [ ] Nhãn `Add Movie` được thay bằng `Save Draft` cho create mode.
- [ ] `Save Draft` tạo/cập nhật movie ở trạng thái `DRAFT`, không tự submit hoặc approve.
- [ ] Sau lần save đầu, URL chuyển sang edit route có `movieId` để lần save sau là update.
- [ ] `Submit for Review` lưu thay đổi mới nhất trước, sau đó gọi lifecycle submit endpoint.
- [ ] Không cho double-submit; button có loading/disabled state đúng.
- [ ] Action bar hiển thị ít nhất `Unsaved changes`, `Saving…`, `Saved` hoặc `Save failed`.
- [ ] Permission và status không hợp lệ không hiển thị/enable action tương ứng.
- [ ] Back/Cancel cảnh báo nếu còn unsaved changes.
- [ ] Tests cover create draft, update draft, save-then-submit và API failure.

---

### Technical Notes / Constraints

- Save validation chỉ kiểm tra payload integrity tối thiểu; readiness gate chỉ chặn Submit for Review.
- Không để `Save Draft` gọi `submitForReview()`.
- Reuse pattern từ `cinemaRoomEditor/EditorActionBar.tsx` nếu phù hợp, nhưng giữ wording của movie workflow.

---

### Related

- Branch: `feat/movie-editor-sticky-actions`
- Depends on: `MOV-EDITOR-02`, existing movie lifecycle APIs
- Docs: `docs/issues/movie-editor-redesign-issue-pack.md`

---

## MOV-EDITOR-04 — [Frontend] Remove exhibition end date from Movie Editor

### Summary / Objective

`endDate` là quyết định thuộc exhibition/scheduling lifecycle, không phải core content metadata. Gỡ trường này khỏi Movie Editor để tránh content operator vô tình kết thúc lịch khai thác phim khi chỉ đang chỉnh sửa nội dung.

---

### Estimate

- [x] S (< 2h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Không còn field `End Date` trong create/edit Movie Editor.
- [ ] Movie Editor không gửi `endDate` trong create/update payload.
- [ ] Edit một field khác không ghi đè hoặc clear `endDate` hiện hữu ở backend.
- [ ] `releaseDate` vẫn được giữ như theatrical/content metadata và có label rõ nghĩa.
- [ ] Scheduler/availability UI hiện hữu không bị thay đổi trong issue này.
- [ ] Tests xác nhận payload không chứa `endDate`.
- [ ] API/Postman documentation ghi rõ nơi chịu trách nhiệm quản lý exhibition window.

---

### Technical Notes / Constraints

- Không xóa cột database trong issue frontend này.
- Không gửi `endDate: null`; phải omit field khỏi partial update payload.
- Việc di chuyển exhibition window sang availability/showtime workflow phải tuân theo #173.

---

### Related

- Branch: `fix/remove-movie-editor-end-date`
- Depends on: `#173`
- Docs: `docs/MOVIE_SERVICE_BUSINESS_RULES.md`

---

## MOV-EDITOR-05 — [Frontend] Consolidate movie assets into a dedicated Media section

### Summary / Objective

Gom poster, backdrop, official trailer và gallery vào một Media section duy nhất. Người dùng phải nhìn thấy asset đang được chọn, nguồn asset và các candidate khác mà không phải di chuyển giữa poster card, TMDB panel và gallery rời rạc.

---

### Estimate

- [x] M (2–4h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Media section có bốn nhóm: `Primary Poster`, `Backdrop`, `Official Trailer`, `Gallery`.
- [ ] Mỗi nhóm hiển thị selected asset, source/provenance và trạng thái imported/pending.
- [ ] Người dùng có thể thay selected poster, backdrop và trailer trước khi save/submit.
- [ ] Gallery hỗ trợ chọn nhiều still/backdrop theo contract hiện hữu.
- [ ] Không còn poster preview hoặc gallery duplicate ở right column.
- [ ] Missing/broken image và video URL có fallback rõ ràng.
- [ ] Media candidate chưa được apply không bị persist âm thầm.
- [ ] Responsive layout và keyboard selection hoạt động.
- [ ] Tests cover selected asset, override, empty media và broken preview.

---

### Technical Notes / Constraints

- Reuse `TmdbMediaPicker` logic nhưng tách UI theo section mới.
- Không upload/import tất cả media candidate; chỉ persist selection đã xác nhận.
- Recommendation mặc định thuộc `MOV-EDITOR-09`; issue P0 này tập trung vào information architecture và manual selection.

---

### Related

- Branch: `feat/movie-editor-media-section`
- Depends on: `#191`, `#192`, `#152`
- Docs: `docs/issues/movie-editor-redesign-issue-pack.md`

---

## MOV-EDITOR-06 — [Frontend] Add movie readiness summary and inline validation

### Summary / Objective

Thêm readiness summary để người dùng hiểu movie còn thiếu gì trước khi Submit for Review, đồng thời đưa validation về đúng field thay vì chỉ hiển thị toast chung. Save Draft vẫn phải cho phép lưu nội dung chưa hoàn chỉnh.

---

### Estimate

- [x] M (2–4h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Review section hiển thị summary gồm `Blocking issues`, `Warnings` và `Completed checks`.
- [ ] Field bắt buộc có inline error gần field sau khi touched hoặc submit attempt.
- [ ] Section navigation có trạng thái section chứa blocking error nhưng không dùng counter gây nhiễu.
- [ ] `Save Draft` không bị readiness blockers chặn nếu payload vẫn hợp lệ về cấu trúc.
- [ ] `Submit for Review` bị chặn khi còn blocking issue.
- [ ] Backend readiness errors được map về stable field/section khi có thể; unknown error vẫn có page-level fallback.
- [ ] Error biến mất khi field được sửa hợp lệ; không giữ stale validation.
- [ ] Không chỉ dùng màu để thể hiện lỗi; có icon/text và ARIA attributes.
- [ ] Tests cover incomplete draft save, blocked submit và successful submit.

---

### Technical Notes / Constraints

- Tách client-side structural validation khỏi backend business readiness validation.
- Không duplicate business rules phức tạp hoàn toàn ở frontend; backend vẫn là source of truth.
- Stable field IDs là dependency cho `MOV-EDITOR-14`.

---

### Related

- Branch: `feat/movie-editor-readiness-summary`
- Depends on: `MOV-EDITOR-02`, `MOV-EDITOR-03`, movie readiness endpoint/validator
- Docs: `docs/MOVIE_SERVICE_BUSINESS_RULES.md`

---

## MOV-EDITOR-07 — [Frontend] Integrate TMDB mappings and warnings into Movie Review section

### Summary / Objective

Cập nhật issue #197 để đưa TMDB mapping, provenance và warnings vào Review section của guided editor. Không tạo một TMDB review card riêng ở sidebar và không buộc người dùng resolve mọi warning chỉ để Save Draft.

---

### Estimate

- [x] M (2–4h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Update issue #197 thay vì tạo lại warning/mapping feature từ đầu.
- [ ] TMDB warnings chỉ xuất hiện trong canonical Review section.
- [ ] Warning được nhóm theo severity và domain: metadata, taxonomy, media, release và master-data mapping.
- [ ] Genre/company/person mapping hiển thị trạng thái `Mapped`, `Suggested`, `Unresolved` hoặc `Ignored with reason`.
- [ ] Field từ TMDB chưa verify hiển thị provenance rõ ràng.
- [ ] Unresolved mapping không chặn Save Draft nhưng có thể chặn Submit theo readiness policy.
- [ ] Không còn duplicate `TMDB Import Review` panel ở right column.
- [ ] Changing source/selection cập nhật warnings, không giữ warning của movie TMDB trước đó.
- [ ] Tests cover warning grouping, unresolved save-vs-submit semantics và stale-warning reset.

---

### Technical Notes / Constraints

- Reuse classifier/mapping state hiện có từ #197.
- Không tự tạo Genre, Company hoặc Person từ render/effect logic.
- Warning-to-field interaction được làm trong `MOV-EDITOR-14`.

---

### Related

- Branch: `refactor/movie-editor-tmdb-review-section`
- Update existing: `#197`
- Depends on: `MOV-EDITOR-02`, `#190`, `#191`, `#192`, `#193`
- Docs: `docs/issues/movie-editor-redesign-issue-pack.md`

---

# P1 Issues

## MOV-EDITOR-08 — [Backend] Expose non-destructive TMDB mapping suggestions

### Summary / Objective

Chuẩn hóa preview/import contract để trả về mapping suggestions cho Genre, Production Company và Person mà không tạo master data âm thầm. Auto-map chỉ được áp dụng khi có stable external ID hoặc exact normalized match đủ tin cậy; trường hợp còn lại phải chờ operator xác nhận.

---

### Estimate

- [x] L (4–8h)

---

### Acceptance Criteria (Definition of Done)

- [ ] TMDB preview trả mapping candidate cho genre, company và person.
- [ ] Mỗi candidate có `sourceId`, `sourceName`, `localId`, `localName`, `matchType` và confidence/reason.
- [ ] `EXTERNAL_ID` và exact normalized approved match có thể được đánh dấu `AUTO_MAPPED`.
- [ ] Fuzzy/ambiguous result chỉ là `SUGGESTED`; không tự persist.
- [ ] Không tìm thấy match trả `UNRESOLVED`; không silently create master record.
- [ ] Import request nhận explicit mapping decisions từ operator khi cần.
- [ ] Duplicate/stable identity constraints được enforce trong transaction.
- [ ] Contract test cover exact, external-ID, ambiguous và no-match cases.
- [ ] API contract và Postman samples được cập nhật.

---

### API Specifications (if applicable)

#### API 1 — Preview TMDB details with mapping suggestions

| Field | Details |
|---|---|
| Method | `GET` |
| Endpoint | `/api/movies/tmdb/{tmdbId}/details` |
| Description | Read-only TMDB preview kèm deterministic mapping suggestions |
| Auth Required | Yes — ADMIN/EMPLOYEE |

---

### Technical Notes / Constraints

- Reuse mapping pipeline của #189; không viết mapper thứ hai trong controller.
- Không mutate Genre/Company/Person trong preview endpoint.
- Việc tạo master data mới phải là explicit command có audit actor.

---

### Related

- Branch: `feat/tmdb-mapping-suggestions`
- Depends on: `#189`, `#190`, `#193`, `#151`
- Docs: `docs/issues/tmdb-ingestion-bug-fix-issue-pack.md`

---

## MOV-EDITOR-09 — [Frontend] Apply smart TMDB defaults with operator override

### Summary / Objective

Giảm thao tác thủ công sau khi chọn TMDB movie bằng cách áp dụng những recommendation có độ tin cậy cao, đồng thời giữ quyền override cho operator. Recommendation phải minh bạch, có provenance và không tạo master data ngầm.

---

### Estimate

- [x] M (2–4h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Genre `AUTO_MAPPED` được preselect tự động và vẫn có thể bỏ/chỉnh.
- [ ] Recommended primary poster và official trailer được chọn mặc định khi backend cung cấp.
- [ ] Người dùng có thể chọn poster/trailer candidate khác trước khi save.
- [ ] Company/person exact match được preselect; suggested match cần explicit confirmation.
- [ ] Unresolved company/person hiển thị action `Map existing` hoặc `Create new` có chủ đích.
- [ ] Không gọi create master-data API chỉ vì user apply TMDB preview.
- [ ] UI hiển thị lý do recommendation/source ở mức đủ để review, không tạo mô tả dài lặp lại.
- [ ] Override được giữ khi chuyển section và không bị re-render reset.
- [ ] Tests cover auto default, override và unresolved case.

---

### Technical Notes / Constraints

- Backend response là source of truth cho recommendation; frontend không tự fuzzy-match tên.
- Nếu operator đã override, re-render hoặc autosave không được chọn lại recommendation mặc định.

---

### Related

- Branch: `feat/movie-editor-smart-import-defaults`
- Depends on: `MOV-EDITOR-05`, `MOV-EDITOR-08`, `#191`, `#192`
- Docs: `docs/issues/movie-editor-redesign-issue-pack.md`

---

## MOV-EDITOR-10 — [Frontend] Use progressive disclosure for movie cast editing

### Summary / Objective

Chỉ hiển thị principal cast trong trạng thái mặc định và thu gọn secondary credits để giảm chiều dài form. Tất cả cast data vẫn được giữ đầy đủ; việc thu gọn chỉ là presentation concern.

---

### Estimate

- [x] S (< 2h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Mặc định chỉ hiển thị principal/top-billed cast theo thứ tự billing hiện có.
- [ ] Có `Show all cast`/`Show less` với tổng số item rõ ràng.
- [ ] Collapse không xóa hoặc thay đổi cast payload.
- [ ] Search/add person vẫn hoạt động khi danh sách đang collapse.
- [ ] Reorder principal cast cập nhật billing order ổn định.
- [ ] Newly added cast được làm nổi bật hoặc đưa vào vùng nhìn thấy.
- [ ] Keyboard và screen-reader có thể điều khiển expand/collapse.
- [ ] Tests cover data preservation và reorder.

---

### Technical Notes / Constraints

- Có thể dùng ngưỡng mặc định 8 principal cast; đặt constant có tên thay vì magic number.
- Không infer principal cast bằng role type nếu backend đã có billing order.

---

### Related

- Branch: `feat/movie-editor-cast-progressive-disclosure`
- Depends on: `MOV-EDITOR-02`
- Docs: `docs/issues/movie-editor-redesign-issue-pack.md`

---

## MOV-EDITOR-11 — [Backend] Support versioned partial updates for movie draft autosave

### Summary / Objective

Cung cấp autosave-safe update contract cho movie draft. Endpoint phải hỗ trợ partial payload, optimistic concurrency và không kích hoạt lifecycle transition hoặc ghi đè field/collection không được gửi.

---

### Estimate

- [x] M (2–4h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Có partial draft update endpoint hoặc contract PATCH tương đương.
- [ ] Chỉ cho phép autosave ở `DRAFT` hoặc `CHANGES_REQUESTED` theo policy.
- [ ] Missing field nghĩa là giữ nguyên; explicit clear dùng contract đã document.
- [ ] Missing collection và empty collection có semantics khác nhau.
- [ ] Request/response có `version`; stale version trả HTTP `409 Conflict` với stable error code.
- [ ] Autosave không submit, approve hoặc thay đổi exhibition lifecycle.
- [ ] Audit phân biệt `DRAFT_AUTOSAVED` với explicit workflow actions hoặc có strategy chống log noise.
- [ ] Repeated equivalent request là idempotent về business state.
- [ ] Unit/integration tests cover scalar, collection, conflict và invalid status.
- [ ] API contract/Postman samples được cập nhật.

---

### API Specifications (if applicable)

#### API 1 — Partially update movie draft

| Field | Details |
|---|---|
| Method | `PATCH` |
| Endpoint | `/api/movies/{id}/draft` |
| Description | Autosave-safe partial update cho content draft |
| Auth Required | Yes — ADMIN/EMPLOYEE |

---

### Technical Notes / Constraints

- Không reuse `PUT` full-replacement nếu contract hiện hữu không phân biệt missing/null/empty.
- Có thể dùng JPA `@Version` hoặc explicit version column; conflict không được silently last-write-wins.
- Media upload/import side effects không nằm trong debounce payload nếu chưa được operator apply.

---

### Related

- Branch: `feat/movie-draft-versioned-autosave`
- Depends on: movie partial-update contract, audit policy
- Docs: `docs/issues/movie-editor-redesign-issue-pack.md`

---

## MOV-EDITOR-12 — [Frontend] Add debounced Movie Editor autosave

### Summary / Objective

Tự lưu movie draft sau khi người dùng ngừng nhập trong một khoảng ngắn và hiển thị trạng thái lưu rõ ràng. Autosave phải chống race condition, không submit workflow và không làm mất thay đổi khi request trả về sai thứ tự.

---

### Estimate

- [x] M (2–4h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Autosave chỉ bắt đầu sau khi movie draft có `movieId`.
- [ ] Dùng debounce khoảng 800–1500 ms; constant có tên và có test fake timer.
- [ ] Chỉ autosave khi form dirty và payload khác phiên bản đã lưu gần nhất.
- [ ] Hiển thị `Saving…`, `Saved`, `Save failed — Retry` và conflict state.
- [ ] Response cũ không được ghi đè state/version của response mới hơn.
- [ ] Pending autosave được flush trước explicit `Submit for Review`.
- [ ] Navigation khi save đang lỗi hoặc còn pending có guard phù hợp.
- [ ] Autosave không tự import pending media hoặc tạo master data.
- [ ] Retry không duplicate lifecycle/audit side effects.
- [ ] Tests cover debounce, cancellation, out-of-order response, retry và submit flush.

---

### Technical Notes / Constraints

- Dùng AbortController/request sequence hoặc mutation queue để chống stale response.
- Explicit `Save Draft` vẫn được giữ làm user-controlled checkpoint.

---

### Related

- Branch: `feat/movie-editor-debounced-autosave`
- Depends on: `MOV-EDITOR-03`, `MOV-EDITOR-11`
- Docs: `docs/issues/movie-editor-redesign-issue-pack.md`

---

## MOV-EDITOR-13 — [Frontend] Add customer-facing movie preview

### Summary / Objective

Cho phép content operator xem trước movie detail theo cách khách hàng sẽ nhìn thấy trước khi submit. Preview phải dùng editor state hiện tại, kể cả thay đổi chưa lưu, và không tạo side effect.

---

### Estimate

- [x] M (2–4h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Có action `Preview as Customer` từ Movie Editor.
- [ ] Preview hiển thị title/localization, synopsis, tagline, rating, runtime, genres, poster, backdrop, trailer và principal cast.
- [ ] Preview đọc trực tiếp current form state, không bắt buộc save trước.
- [ ] Có desktop/mobile viewport toggle hoặc responsive preview đủ để QA.
- [ ] Missing optional data có fallback đúng với customer UI.
- [ ] Preview không hiển thị internal warnings, mapping IDs hoặc audit data.
- [ ] Preview không gọi create/update/submit API.
- [ ] Có accessible close/back về đúng editor section và giữ nguyên form state.
- [ ] Tests cover unsaved data và missing media fallback.

---

### Technical Notes / Constraints

- Reuse customer movie presentation components hoặc shared view model; không copy toàn bộ markup thành phiên bản thứ hai.
- Preview chỉ là representational preview, không cam kết showtime/availability chưa được publish.

---

### Related

- Branch: `feat/movie-editor-customer-preview`
- Depends on: `MOV-EDITOR-02`, `MOV-EDITOR-05`
- Docs: `docs/issues/movie-editor-redesign-issue-pack.md`

---

## MOV-EDITOR-14 — [Frontend] Navigate from review warnings to editor fields

### Summary / Objective

Biến readiness blockers và import warnings thành actionable navigation. Người dùng có thể chọn một issue trong Review và được đưa tới đúng section/field cần sửa thay vì tự tìm trong biểu mẫu dài.

---

### Estimate

- [x] S (< 2h)

---

### Acceptance Criteria (Definition of Done)

- [ ] Mỗi warning/blocker có optional `sectionId` và `fieldId` ổn định.
- [ ] Click warning scroll đúng section và focus/highlight field liên quan.
- [ ] Nếu target nằm trong vùng collapse như full cast/media candidates, vùng đó được mở trước khi focus.
- [ ] Warning không có field cụ thể vẫn điều hướng tới canonical section.
- [ ] Interaction dùng được bằng keyboard và có accessible label.
- [ ] Sau khi field hợp lệ, warning tương ứng biến mất hoặc đổi trạng thái.
- [ ] Không điều hướng tới DOM ID không tồn tại; có fallback an toàn.
- [ ] Tests cover direct field, collapsed target, section fallback và resolved warning.

---

### Technical Notes / Constraints

- Dùng một field registry/type-safe mapping thay vì rải string selector trong component.
- Không parse error message text để suy ra target; backend/client validator nên trả stable code/path.

---

### Related

- Branch: `feat/movie-review-warning-navigation`
- Depends on: `MOV-EDITOR-06`, `MOV-EDITOR-07`
- Docs: `docs/issues/movie-editor-redesign-issue-pack.md`

---

## 4. Definition of Done cho toàn bộ redesign

- [ ] Manual creation flow chạy được từ source selection đến Save Draft và Submit for Review.
- [ ] TMDB catalog flow không ghi DB trước explicit user action.
- [ ] Editor không còn `End Date`, `Add Movie` hoặc TMDB browser ở right column.
- [ ] Media và Review chỉ có một canonical section cho mỗi loại thông tin.
- [ ] Save Draft và Submit for Review có semantics tách biệt.
- [ ] Readiness blockers không ngăn lưu draft nhưng ngăn submit.
- [ ] Không có silent master-data creation từ TMDB preview/apply.
- [ ] Frontend tests, backend tests liên quan và production build pass.
- [ ] Browser QA light/dark và responsive breakpoints hoàn tất.
- [ ] API contract/Postman documentation được cập nhật cho autosave/mapping contract mới.
