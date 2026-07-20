## Overview / Objective

`[Frontend] Consolidate movie assets into a dedicated Media section` (`MOV-EDITOR-05`, issue pack `docs/issues/movie-editor-redesign-issue-pack.md`). Trước MR này, Media section (đã tồn tại như 1 mục điều hướng trong `MovieEditorWorkflow`) trên thực tế chỉ chứa **Primary Poster**; `Official Trailer` là 1 input trơ nằm trong section **Overview**, còn `TmdbMediaPicker` và **Gallery** là 2 khối DOM riêng biệt chỉ "trông giống" cùng 1 chỗ nhờ chung class CSS `order-3` — không có nhóm nào hiển thị source/provenance hay trạng thái imported/pending, và ảnh vỡ chỉ hiện icon broken-image mặc định của trình duyệt.

MR này gom cả 4 nhóm (`Primary Poster`, `Backdrop`, `Official Trailer`, `Gallery`) vào đúng 1 `<section data-editor-section="media">` duy nhất, mỗi nhóm hiển thị asset đang chọn + source/provenance + trạng thái, và thêm fallback rõ ràng cho ảnh vỡ/thiếu.

Related Issue: `MOV-EDITOR-05` trong `docs/issues/movie-editor-redesign-issue-pack.md`.

---

## Changes Introduced

**Controllers / Routes / Services:**
- Không đổi — MR này thuần frontend.

**DTOs / Mappers / Components:**
- `client/src/api/movieApi.ts` — thêm `trailerSource?: string` vào type `MovieResponse` (frontend). Field này đã tồn tại ở backend (`MovieResponse.java`, từ `[Backend] Fetch and select an official TMDB trailer`) nhưng type frontend bị bỏ sót — phát hiện khi cần hiển thị provenance cho nhóm Trailer.
- **`client/src/pages/admin/movieEditor/MediaThumbnail.tsx`** (mới) — component ảnh dùng chung cho Poster/Backdrop/Gallery: không có `src` → placeholder rõ ràng ("No poster selected yet"...); `src` load lỗi (`onError`) → fallback "Preview unavailable" thay vì icon vỡ mặc định của trình duyệt; đổi `src` (chọn asset khác) → tự thử lại, không bị kẹt ở trạng thái lỗi cũ.
- **`client/src/pages/admin/movieEditor/MediaThumbnail.test.tsx`** (mới) — 4 test: hiển thị asset đã chọn, empty state, broken-preview fallback, và asset mới sau khi override vẫn load lại bình thường.
- `client/src/pages/admin/MovieEditorPage.tsx`:
  - Thêm `MediaAssetBadges` (component nội bộ nhỏ) — hàng badge "Source: X" + trạng thái (`Imported`/`Pending import`/`Manual`/`Not selected`), dùng chung cho cả 3 nhóm Poster/Backdrop/Trailer.
  - Thêm `isLikelyVideoUrl()` — kiểm tra sơ bộ URL trailer có giống link YouTube phát được không, hiện cảnh báo nhẹ nếu không.
  - Thêm state `trailerSource` (`"TMDB" | "MANUAL" | null`) — set từ `mv.trailerSource` lúc load movie có sẵn, set `"TMDB"` lúc `applyTmdb()` áp trailer gợi ý, set `"MANUAL"` ngay khi người dùng gõ tay vào input (khớp đúng rule backend: sửa tay luôn override provenance về `MANUAL`).
  - Thêm `posterProvenance`/`selectedBackdrop` (derived qua `useMemo`) — tính source + trạng thái (`imported`/`pending`/`manual`/`empty`) dựa trên `movieImages` (đã import) và `pendingMediaSelections` (đã chọn từ TMDB nhưng chưa lưu).
  - **Gỡ field "Trailer URL" khỏi section Overview**, chuyển hẳn vào Media section (nhóm Official Trailer).
  - **Media section giờ chứa đúng 1 `<section>` bao trọn**: Primary Poster → Backdrop (mới) → Official Trailer (chuyển từ Overview + badge suggested-trailer chuyển từ panel TMDB Import Review sang đây) → `TmdbMediaPicker` (giữ nguyên logic, chỉ đổi vị trí) → Gallery. Panel "TMDB Import Review" (genre mapping/warnings) vẫn ở Review section như cũ, chỉ bỏ phần "Suggested trailer" đã trùng lặp (nay chỉ còn ở Media).

**Database / JPA / Migration:**
- Không có.

**Exception Handling / Error Codes:**
- Không có thay đổi.

---

## API contract

Không có thay đổi API. `MovieResponse` (frontend type) chỉ bổ sung 1 field optional (`trailerSource`) đã tồn tại sẵn ở response thật của backend từ trước — không phải breaking change, chỉ là sửa type bị thiếu.

---

## Key Architectural Decisions

- **Backdrop không có scalar field riêng trên `Movie`** (`posterUrl`/`thumbnailUrl`/`trailerUrl` có, nhưng backdrop chỉ tồn tại dưới dạng nhiều dòng `movie_image` với `imageType=BACKDROP`) — "selected backdrop" được định nghĩa là dòng `movie_image` có `isDefault=true` (fallback: dòng `BACKDROP` đầu tiên), hoặc candidate đang `pending` trong `TmdbMediaPicker` chưa lưu. Không thêm field/migration mới cho việc này — đúng theo Technical Notes của issue ("Reuse TmdbMediaPicker logic... Recommendation mặc định thuộc MOV-EDITOR-09").
- **Không viết lại `TmdbMediaPicker`** — chỉ đổi vị trí render (vào trong Media section thay vì bên cạnh), giữ nguyên toàn bộ state/logic chọn poster+backdrop+stills và cơ chế "chỉ import khi Save" đã có. Việc tách poster/backdrop candidate ra 2 khối UI riêng biệt bên trong `TmdbMediaPicker` được cân nhắc nhưng bỏ qua vì rủi ro refactor state nội bộ cao hơn giá trị mang lại trong phạm vi issue P0 này.
- **`MediaThumbnail` là component dùng chung**, không phải 3 bản sao riêng cho Poster/Backdrop/Gallery — đây là điểm được unit test trực tiếp (không cần mount toàn bộ `MovieEditorPage`, vốn chưa có test nào từ trước và rất tốn kém để test tổng thể).
- **Trailer "broken preview"**: vì trailer là link (không phải `<img>`), không dùng `MediaThumbnail` — thay vào đó kiểm tra định dạng URL đơn giản bằng regex, không cố gắng embed/preview video thật (ngoài phạm vi issue).
- **`trailerSource` được set optimistically ở client** ngay khi người dùng gõ tay, thay vì chờ round-trip lên backend — khớp với hành vi thật của `MovieService.updateMovie()` (`if (request.getTrailerUrl() != null) trailerSource = MANUAL`), nên badge không bao giờ hiển thị sai trong lúc chưa lưu.

---

## How to Test

1. `npx tsc --noEmit` sạch.
2. `npx vitest run --pool=forks` — 206/206 pass (bao gồm 4 test mới của `MediaThumbnail`).
3. `npm run build` — build production thành công.
4. Thủ công (cần đăng nhập, xem Reviewer Notes — **chưa test được trong phiên làm việc này** vì môi trường không có Playwright/chromium-cli để tự lái trình duyệt):
   - Mở `/admin/movies/new/manual` → xác nhận Media section có đủ 4 nhóm theo đúng thứ tự, Trailer không còn xuất hiện ở Overview.
   - Dán 1 poster URL hỏng (404) → xác nhận thấy "Preview unavailable" thay vì icon ảnh vỡ của trình duyệt.
   - Vào 1 movie đã có sẵn (edit) → xác nhận Backdrop group hiện đúng ảnh backdrop mặc định (nếu có) kèm badge source đúng (`TMDB`/`MANUAL`/`CLOUDINARY`).
   - Import từ TMDB catalog → ở bước prefill, chọn 1 backdrop candidate trong `TmdbMediaPicker` (chưa Save) → xác nhận Backdrop group phía trên hiện badge "Pending import" ngay lập tức, đúng ảnh candidate đã chọn.
   - Gõ tay vào Trailer URL sau khi đã prefill từ TMDB → xác nhận badge source đổi từ `TMDB` sang `Manual` ngay lập tức.
   - QA responsive (mobile/tablet) và dark/light mode.

---

## Checklist

**General**
- [x] Tuân thủ coding convention của dự án
- [x] Không còn code debug / console.log
- [x] Code compile được (`tsc --noEmit`, `npm run build`)

**Backend**
- Không áp dụng.

**Frontend**
- [x] `tsc --noEmit` sạch
- [x] `npx vitest run --pool=forks` — 206/206 pass
- [x] `npm run build` thành công
- [ ] **Chưa QA thủ công trên trình duyệt thật trong phiên này** — môi trường làm việc (Windows, không có Playwright/chromium-cli cài sẵn) không cho phép tự lái trình duyệt. Đã khởi động sẵn `movie-service`, `api-gateway` (docker) và `npm run dev` (client, `localhost:3000`) để người review tự kiểm tra ngay bằng tài khoản `admin`/`admin` (seed mặc định, xem `README.md`).
- [ ] Chưa test keyboard-only selection và dark/light mode thủ công.

---

## Reviewer Notes

- **Chưa có QA trình duyệt thật cho MR này** — đây là MR liên quan giao diện/layout, rủi ro cao nhất là ở phần bố cục trực quan (spacing, responsive breakpoint) mà test tự động không phủ được. Đề nghị người review tự mở `/admin/movies/new/manual` và `/admin/movies/{id}/edit` (với 1 movie có sẵn ảnh/trailer) trước khi approve.
- **`imageCaption` state đã tồn tại từ trước nhưng không có input nào bind vào nó** trong Gallery's "Add image" form (chỉ có Image URL + Image Type) — đây là gap có sẵn từ trước MR này, không phải lỗi mới, không sửa trong phạm vi issue này.
- **`TmdbMediaPicker` không đổi nội dung**, chỉ đổi nơi render — nếu review thấy hành vi chọn candidate lạ, đó là hành vi cũ, không phải do MR này.
- MR này **không** đụng tới `MOV-EDITOR-07` (Review section TMDB warnings) ngoài việc gỡ đúng phần "Suggested trailer" đã trùng lặp với Trailer group mới — phần genre-mapping/warnings trong panel "TMDB Import Review" giữ nguyên 100%.
