# [Frontend] Tổ chức lại Movie Editor thành luồng chỉnh sửa có điều hướng theo từng phần

## Overview / Objective

Tổ chức lại Movie Editor từ bố cục biểu mẫu hai cột kéo dài thành một **guided content-authoring workflow** gồm năm phần chuẩn hóa:

1. `Overview`
2. `Classification & Release`
3. `Media`
4. `Credits`
5. `Review`

Giao diện mới cung cấp thanh điều hướng cố định trên desktop, compact stepper trên tablet/mobile, đồng bộ section hiện tại với URL hash và tự động cập nhật section active khi người dùng cuộn trang.

Việc chuyển đổi giữa các section không làm remount editor, không làm mất form state, dữ liệu TMDB preview, media selection, production companies hoặc cast đã nhập.

Related Issue: `MOV-EDITOR-02`

---

## Changes Introduced

### Components / UI

- Thêm component `MovieEditorWorkflow` làm editor shell dùng chung cho create mode và edit mode.
- Chuẩn hóa năm section:
  - `Overview`
  - `Classification & Release`
  - `Media`
  - `Credits`
  - `Review`
- Thêm sticky section navigation cho desktop.
- Thêm compact horizontal stepper cho tablet và mobile.
- Thêm trạng thái active và completion indicator cơ bản cho từng section.
- Tổ chức lại nội dung Movie Editor thành một full-width editor canvas.
- Loại bỏ fixed right column dành riêng cho poster, TMDB và gallery.
- Đưa poster, TMDB media picker và photo gallery vào nhóm `Media`.
- Đưa cast và crew vào nhóm `Credits`.
- Đưa TMDB provenance, mappings và warnings vào nhóm `Review`.
- Giữ mỗi field và component tại một canonical location, không tạo bản sao ở sidebar.

### Navigation / URL State

- Khi người dùng chọn một section:
  - Editor tự động scroll đến section tương ứng.
  - Focus được chuyển đến section đó.
  - URL hash được cập nhật.
- Hỗ trợ các URL hash:

  ```text
  #overview
  #classification-release
  #media
  #credits
  #review
  ```

- Khi mở editor bằng URL có hash, giao diện tự động điều hướng đến section tương ứng.
- Sử dụng `IntersectionObserver` để cập nhật active section khi người dùng cuộn trang.
- Sử dụng `history.replaceState()` để cập nhật URL mà không tạo thêm browser history entry.
- Điều hướng section không gọi React Router navigation và không remount `MovieEditorPage`.

### State Management

- `MovieEditorPage` tiếp tục là single owner của toàn bộ form state.
- `MovieEditorWorkflow` chỉ quản lý section navigation, active section, URL hash, scroll tracking và focus management.
- Các dữ liệu sau được giữ nguyên khi chuyển section:
  - Movie form fields.
  - Localized titles, taglines và synopses.
  - TMDB preview data.
  - Poster và media selections.
  - Production companies.
  - Cast và crew.
  - Cast billing order.
  - Genre mappings.
  - TMDB warnings và import review state.

### Accessibility

- Thêm `aria-label` cho section navigation.
- Thêm `aria-current="step"` cho section đang active.
- Thêm `aria-controls` liên kết navigation item với section tương ứng.
- Navigation item sử dụng native button và hỗ trợ keyboard mặc định.
- Section có stable ID và có thể nhận focus.
- Thêm focus-visible state cho navigation item và section.

### Tests

- Thêm component tests cho `MovieEditorWorkflow`.
- Kiểm tra đầy đủ năm stable section targets.
- Kiểm tra click navigation cập nhật URL hash.
- Kiểm tra editor scroll và focus đúng section.
- Kiểm tra active section thay đổi khi `IntersectionObserver` phát hiện section mới.
- Kiểm tra controlled form state không bị reset khi điều hướng.
- Kiểm tra desktop navigation và mobile navigation cùng phản ánh active section.

---

## Key Architectural Decisions

### Giữ một form state owner duy nhất

`MovieEditorPage` vẫn là nơi sở hữu toàn bộ controlled form state. Các section không tạo form state riêng nhằm tránh mất dữ liệu khi component remount, dữ liệu giữa các section không đồng bộ hoặc TMDB preview và media selection bị reset.

### Tách workflow navigation thành component riêng

Logic điều hướng được đưa vào `MovieEditorWorkflow` thay vì tiếp tục mở rộng `MovieEditorPage`. Component này chịu trách nhiệm render desktop section rail, mobile/tablet stepper, theo dõi active section, đồng bộ URL hash, scroll và focus section.

### Sử dụng stable section IDs

Mỗi section có một ID ổn định:

```text
movie-editor-section-overview
movie-editor-section-classification-release
movie-editor-section-media
movie-editor-section-credits
movie-editor-section-review
```

Các ID này có thể được tái sử dụng trong `MOV-EDITOR-14` để điều hướng từ warning hoặc validation error đến section/field tương ứng.

### Sử dụng IntersectionObserver

`IntersectionObserver` được sử dụng thay cho global scroll event listener để hạn chế callback chạy liên tục, giảm xử lý không cần thiết trên main thread và giúp logic active section dễ kiểm thử độc lập.

### Không sử dụng router navigation khi đổi section

Section navigation cập nhật URL hash bằng `window.history.replaceState(...)`, tránh remount route, reset controlled form state và tạo quá nhiều browser history entries.

### Giới hạn phạm vi MR

MR này tập trung vào information architecture và section navigation. Các chức năng sau thuộc issue follow-up riêng:

- Sticky `Save Draft` và `Submit for Review` action bar.
- Draft autosave.
- Backend readiness validation.
- Customer-facing preview.
- Warning-to-field navigation.
- Smart TMDB recommendation.
- Progressive disclosure cho cast editing.

---

## How to Test

### Automated verification

Từ thư mục `client`, chạy toàn bộ test suite:

```bash
npm test
```

Kết quả mong đợi:

```text
Test Files  25 passed
Tests       187 passed
```

Chạy production build:

```bash
npm run build
```

Build phải hoàn thành mà không có TypeScript error hoặc bundling error.

### Manual create mode

1. Đăng nhập bằng tài khoản `ADMIN` hoặc `EMPLOYEE` được cấp quyền.
2. Mở `/admin/movies/new/manual`.
3. Xác nhận editor hiển thị đủ năm section canonical.
4. Nhập `Original Title`.
5. Chọn section `Media`.
6. Xác nhận giao diện scroll và focus đúng Media section.
7. Xác nhận URL được cập nhật thành `#media`.
8. Chọn lại `Overview` và xác nhận `Original Title` vẫn còn nguyên.

### Active section và deep link

1. Cuộn lần lượt qua từng section.
2. Kiểm tra navigation item tương ứng được active.
3. Kiểm tra URL hash được cập nhật theo section hiện tại.
4. Mở trực tiếp `/admin/movies/new/manual#credits`.
5. Xác nhận editor tự động điều hướng đến Credits.
6. Kiểm tra tương tự với `#media` và `#review`.

### TMDB import state

1. Mở TMDB catalog và chọn một bộ phim.
2. Chuyển sang Movie Editor.
3. Điều hướng giữa Overview, Media, Credits và Review.
4. Xác nhận TMDB preview, poster, media selection, genre mappings, warnings, production companies và cast không bị reset.

### Edit mode

1. Mở `/admin/movies/{movieId}/edit`.
2. Xác nhận edit mode sử dụng cùng workflow shell với create mode.
3. Xác nhận dữ liệu movie được load đúng.
4. Xác nhận điều hướng section không reset dữ liệu.

### Responsive và accessibility

1. Kiểm tra desktop từ `1024px` trở lên: sticky section rail hiển thị bên trái.
2. Kiểm tra tablet và mobile: compact stepper hiển thị và có thể cuộn ngang.
3. Xác nhận không có dropdown bị clip, action bị khuất hoặc horizontal overflow ngoài stepper.
4. Dùng phím `Tab`, `Enter` và `Space` để kiểm tra keyboard navigation.
5. Xác nhận section active có `aria-current="step"` và navigation item có `aria-controls`.
6. Kiểm tra giao diện trên cả dark mode và light mode.

---

## Checklist

### General

- [x] Code compile thành công
- [x] Production build thành công
- [x] Không còn debug code hoặc `console.log`
- [x] Tuân thủ coding convention hiện tại của project
- [x] Không thay đổi API contract
- [x] Không thay đổi database
- [x] Không commit các thay đổi tài liệu ngoài phạm vi issue
- [x] Branch được tạo từ phiên bản mới nhất của `develop`

### Frontend

- [x] Có đủ năm canonical sections
- [x] Desktop có sticky section navigation
- [x] Tablet/mobile có compact stepper
- [x] Click navigation scroll đúng section
- [x] URL hash phản ánh section hiện tại
- [x] Active section cập nhật khi scroll
- [x] Điều hướng không reset controlled form state
- [x] Imported TMDB preview và media selections được giữ nguyên
- [x] Create mode và edit mode dùng chung workflow shell
- [x] Navigation hỗ trợ keyboard và accessible name
- [x] Section có stable ID
- [x] Component tests đã được bổ sung
- [x] Toàn bộ 187 frontend tests đã pass
- [x] `npm run build` đã pass
- [ ] Đã hoàn thành authenticated browser QA trên dark mode
- [ ] Đã hoàn thành authenticated browser QA trên light mode

---

## Reviewer Notes

- Kiểm tra kỹ việc giữ nguyên form state khi chuyển qua lại giữa các section.
- Kiểm tra URL hash khi click navigation và khi scroll thủ công.
- Kiểm tra deep link bằng URL có `#media`, `#credits` hoặc `#review`.
- Kiểm tra cả create mode và edit mode.
- Kiểm tra responsive ở desktop, tablet và mobile.
- `MovieEditorPage` vẫn là single owner của form state; không chuyển state xuống từng section trong MR này.
- Review section trong MR này chỉ tổ chức lại TMDB provenance và warning hiện hữu.
- Backend readiness gate và readiness summary đầy đủ thuộc issue riêng.
- Sticky `Save Draft` và `Submit for Review` action bar thuộc `MOV-EDITOR-03`.
- Warning-to-field navigation sẽ sử dụng stable section IDs trong `MOV-EDITOR-14`.
- Nếu issue đã có GitLab issue number, thay `Related Issue: MOV-EDITOR-02` bằng `Related Issue: Closes #<ISSUE_NUMBER>`.

---

## Branch / Commit

```text
Branch: feat/movie-editor-guided-sections
Commit: 33d1cf7
Target branch: develop
```
