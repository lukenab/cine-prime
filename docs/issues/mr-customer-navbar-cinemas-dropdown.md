## Overview / Objective

Trang chủ customer hiện có dropdown "Movies" (Now Showing / Coming Soon) nhưng "Cinemas" chỉ là 1 link tĩnh tới `/cinemas`. Yêu cầu: cho "Cinemas" xổ dropdown liệt kê các chi nhánh rạp thật (dynamic), theo cùng pattern UI đã có sẵn cho "Movies".

---

## Changes Introduced

**Frontend:**
- `Navbar.tsx`:
  - Thêm state `cinemaClusters`, fetch qua `movieApi.getClusters()` (endpoint public `GET /api/cinema-clusters`, đã được `CinemasPage` dùng sẵn — không cần endpoint mới), lọc `status === "ACTIVE"`.
  - `resolvedNavItems` — map lại `navItems` tĩnh, gán `children` động cho riêng mục "Cinemas" từ danh sách cluster đã fetch; các mục khác (Home/Movies/Events/Offers) giữ nguyên như cũ.
  - Điều kiện render dropdown đổi từ `item.children ?` thành `item.children && item.children.length > 0 ?` — tránh render 1 panel rỗng trong lúc dữ liệu cluster chưa fetch xong.
  - Panel dropdown desktop: thêm `maxHeight: 320px` + `overflow-y: auto` cho phần danh sách (hiện có ~20+ cluster, không cap sẽ tràn khỏi viewport), thêm `whitespace-nowrap` (tên cluster dài trước đó bị wrap 2 dòng), và link "View all cinemas →" cố định ở cuối panel (chỉ hiện cho mục "Cinemas").
  - Menu mobile: áp dụng tương tự — `maxHeight: 200px` + scroll riêng cho danh sách con của "Cinemas", cùng link "View all cinemas →".
  - Mỗi cluster link trỏ tới `/cinemas?q=<tên cluster đã encode>`.
- `CinemasPage.tsx` — đọc query param `q` (qua `useSearchParams`) để khởi tạo giá trị ban đầu cho ô search, nên khi bấm 1 chi nhánh từ dropdown sẽ vào thẳng `/cinemas` với kết quả đã lọc theo đúng chi nhánh đó (tái dùng nguyên logic filter/search có sẵn, không thêm state/route mới).

---

## Key Architectural Decisions

- **Không tạo route/trang detail riêng cho từng cluster.** `/cinemas` (customer) hiện chỉ là danh sách + search — chưa có `/cinemas/:id`. Thay vì thêm route mới, dropdown link qua query param `?q=` để tái dùng search box có sẵn của `CinemasPage`, giữ thay đổi tối thiểu.
- **Tái dùng đúng API/pattern đã có** — không gọi lại logic mới, chỉ gọi `movieApi.getClusters()` giống hệt `CinemasPage`, và tái dùng CSS/markup dropdown đã có sẵn cho "Movies" thay vì viết component dropdown mới.
- **Cap chiều cao + scroll cho danh sách cluster** — vì danh sách "Movies" chỉ có 2 item cố định nên panel gốc không có giới hạn chiều cao; danh sách cluster động có thể lên tới 20+ item (đã verify thực tế qua Playwright), nên bắt buộc phải thêm `max-height`/scroll để không tràn khỏi màn hình.

---

## How to Test

1. `npx tsc --noEmit` (client) — không lỗi ở 2 file đã sửa.
2. Chạy `npm run dev`, mở `/home`, hover "Cinemas" trên navbar desktop → thấy danh sách chi nhánh cuộn được, có "View all cinemas →" ở cuối.
3. Bấm 1 chi nhánh bất kỳ (vd "CinePrime Cầu Giấy") → điều hướng tới `/cinemas?q=CinePrime%20C%E1%BA%A7u%20Gi%E1%BA%A5y`, ô search tự điền sẵn tên chi nhánh, danh sách đã lọc đúng.
4. Thu nhỏ màn hình xuống mobile, mở menu hamburger → mục "Cinemas" cũng xổ danh sách con cuộn được + "View all cinemas →".
5. Đã verify bằng Playwright (`playwright-core`, chromium) trong lúc phát triển — dropdown render đúng 20 cluster active từ DB dev thật, click điều hướng và prefill search đúng như mong đợi.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Frontend**
- [x] Tái dùng API/pattern có sẵn, không thêm endpoint/route mới
- [x] Đã test bằng trình duyệt thật (Playwright), không chỉ dựa vào type-check

---

## Reviewer Notes

- Dropdown chỉ hiện cluster có `status === "ACTIVE"` — cluster `PENDING_APPROVAL`/`INACTIVE` sẽ không xuất hiện, khớp với hành vi `CinemasPage` đang có.
- Nếu số lượng cluster tăng nhiều hơn nữa trong tương lai, có thể cân nhắc thêm ô search ngay trong dropdown thay vì chỉ cuộn — hiện tại 20 item vẫn còn dùng được với scroll đơn giản nên chưa làm.
