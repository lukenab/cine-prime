# MR Description — [Frontend] Integrate Address Autocomplete for Cinema Cluster

> Copy nội dung bên dưới vào GitLab MR description.
> Branch: `feat/cinema-cluster-address-autocomplete` → target: `develop`

---

## Overview / Objective

Thay thế plain text input của field `address` trong `ClusterModal` bằng autocomplete có
gợi ý địa chỉ thực tế khi gõ. Khi admin chọn một gợi ý, `latitude`/`longitude` tự điền
và hiển thị bản đồ preview để xác nhận vị trí trước khi lưu. Province dropdown cũng tự
cập nhật theo địa chỉ được chọn.

**Note:** Issue gốc đề xuất Google Maps Places API, nhưng do Google yêu cầu thanh toán
trước (~800,000đ) và API mới `AutocompleteSuggestion` bị 403 với key thông thường, MR
này dùng **Nominatim (OpenStreetMap)** thay thế — miễn phí, không cần API key, không
cần billing.

Related Issue: Closes #[cinema-cluster-address-autocomplete-issue]

---

## Changes Introduced

**Frontend — `client/src/pages/admin/ManageCinemaClusterPage.tsx`:**

- **`NominatimResult` type** — shape của response từ Nominatim Search API (`display_name`,
  `lat`, `lon`, `address.*`)
- **`NOMINATIM_PROVINCE_MAP`** — map tên tỉnh/thành Nominatim trả về → giá trị trong
  `PROVINCES` dropdown (30+ entry, xử lý cả dạng "Thành phố Hồ Chí Minh" và "Hồ Chí Minh")
- **`detectProvince()`** — duyệt qua `address.city/state/county/town/village`, map về
  PROVINCES; fallback partial-match nếu không có trong map cứng
- **`PlacesAddressInput` component** — custom input với Nominatim autocomplete:
  - Debounce 500ms (tuân thủ giới hạn 1 req/s của Nominatim)
  - Gợi ý từ 3 ký tự trở lên, tối đa 5 kết quả, giới hạn trong Việt Nam (`countrycodes=vn`)
  - Dropdown đóng khi click ra ngoài (mousedown listener)
  - Khi chọn: gọi `onChange(display_name, lat, lng)` + `onProvinceDetected(province)`
  - Khi gõ tay: gọi `onChange(text)` không có coords → parent clear tọa độ cũ
- **OSM map preview** — sau khi chọn địa chỉ, hiển thị `<iframe>` embed OpenStreetMap
  (200px, có marker tại tọa độ). Link "Open in map ↗" mở OSM full trong tab mới
- **Province auto-detection** — `onProvinceDetected` callback cập nhật province dropdown
  tự động khi chọn địa chỉ
- **Coordinates badge** — hiển thị lat/lng dạng `10.776966, 106.700965 — coordinates auto-filled`
  khi có tọa độ; hiển thị hint "Select from suggestions to auto-fill coordinates." khi chưa có
- **Inline error banner** — thay thế `alert()` bằng `saveError` state + banner đỏ với
  `AlertCircle` icon hiện trong modal ngay trên nút Cancel/Save
- **Phone normalization** — `handleSubmit` strip `/[\s\-().]/g` khỏi phone trước khi gửi
  backend (người dùng nhập `028 3822 1234` → gửi `02838221234`)

**Frontend — `client/src/api/movieApi.ts`:**

- `ClusterResponse` — thêm `latitude?: number` và `longitude?: number`
- `CreateClusterPayload` — thêm `latitude?: number` và `longitude?: number`

**Backend — `movieservice/dto/request/CinemaClusterRequest.java`:**

- Cập nhật phone regex từ `^(0[235789][0-9]{8})$` → `^(0[35789][0-9]{8}|02[0-9]{9})$`
  để chấp nhận cả landline 11 chữ số (`028 xxxx xxxx`, `024 xxxx xxxx`, v.v.)

**Frontend — `client/.env.local`:**

- Thêm comment `VITE_GOOGLE_MAPS_API_KEY=` (placeholder, hiện không dùng)

---

## Why Nominatim Instead of Google Maps

| | Google Maps Places API | Nominatim (OpenStreetMap) |
|---|---|---|
| Chi phí | Yêu cầu billing + prepay ~800K | Hoàn toàn miễn phí |
| API key | Bắt buộc | Không cần |
| Rate limit | Cao (credit-based) | 1 req/s (đủ cho admin use case) |
| Độ chính xác VN | Cao | Tốt (đủ cho địa chỉ rạp phim) |
| Tích hợp | `@react-google-maps/api` | Native `fetch` — không cần thư viện |

Nominatim phù hợp cho môi trường dev/staging của dự án OJT. Có thể switch sang Google
Maps sau nếu cần accuracy cao hơn ở production.

---

## Key Decisions

- **Debounce 500ms** — Nominatim policy yêu cầu không quá 1 request/giây. 500ms đủ
  responsive cho UX mà không vi phạm ToS.

- **`onMouseDown` thay vì `onClick` cho dropdown item** — tránh input blur đóng dropdown
  trước khi click được xử lý.

- **Clear coords khi gõ tay** — nếu admin sửa địa chỉ sau khi chọn autocomplete, tọa độ
  cũ bị xóa (`latitude: undefined`, `longitude: undefined`). Tọa độ chỉ được set khi chọn
  từ Nominatim — đảm bảo tọa độ luôn khớp địa chỉ.

- **OSM iframe embed** — không cần API key, hiển thị được trong mọi browser. Chỉ render
  khi `hasCoords = true` — không làm chậm modal khi không có tọa độ.

- **Phone regex mở rộng** — seed data V3 dùng format Vietnam landline chuẩn (`028 xxxx xxxx`
  = 11 chữ số). Regex cũ `^(0[235789][0-9]{8})$` chỉ cho phép 10 chữ số nên reject tất cả
  landline. Tách thành 2 nhánh: mobile 10 chữ số | landline `02x` 11 chữ số.

- **Inline error thay `alert()`** — `alert()` là blocking, không thể style theo theme. `saveError`
  state + banner trong modal cho phép user đọc lỗi và sửa ngay mà không đóng modal.

---

## Phone Validation Rules (Updated)

| Loại | Prefix | Số chữ số | Ví dụ |
|---|---|---|---|
| Mobile | 03x, 05x, 07x, 08x, 09x | 10 | `0901234567` |
| Landline | 02x (HCMC, HN, Đà Nẵng…) | 11 | `02838221234` |

Regex: `^(0[35789][0-9]{8}|02[0-9]{9})$`

---

## How to Test

**Setup:** Đảm bảo V4 migration đã chạy và backend đã rebuild với phone regex mới:
```bash
docker-compose up -d --build movie-service
```

**Test autocomplete — gợi ý địa chỉ:**
1. Mở trang Manage Cinema Clusters → nhấn "Add Cluster"
2. Trong field Address, gõ `Nguyễn Huệ` (≥ 3 ký tự)
3. → Sau ~500ms xuất hiện dropdown gợi ý từ Nominatim
4. Gợi ý có icon pin màu xanh, click chọn một gợi ý
5. → Address tự điền `display_name` đầy đủ
6. → Badge xanh hiện `lat, lng — coordinates auto-filled`
7. → Map preview (OpenStreetMap iframe 200px) hiện với marker đúng vị trí
8. → Province dropdown tự update về tỉnh tương ứng

**Test map preview:**
- Nhấn "Open in map ↗" → mở tab mới OpenStreetMap tại đúng tọa độ

**Test gõ tay (không chọn autocomplete):**
- Gõ địa chỉ tự do, không chọn gợi ý → không có coords badge, không có map preview
- Save → backend chấp nhận (tọa độ optional)

**Test province auto-detect:**
- Gõ `Hoàn Kiếm` → chọn gợi ý ở Hà Nội → Province dropdown tự chuyển sang "Hà Nội"
- Gõ `Quận 1` → chọn gợi ý ở HCMC → Province dropdown tự chuyển sang "TP. Hồ Chí Minh"

**Test phone normalization:**
- Nhập phone `028 3822 1234` (có spaces) → Save
- → Backend nhận `02838221234` (11 chữ số) → pass validation → 200 OK

**Test inline error:**
- Nhập phone `012345` (sai format) → Save
- → Modal không đóng, hiện banner đỏ: "Invalid Vietnam phone number..."

**Test Edit cluster có tọa độ:**
```
GET /api/cinema-clusters/1 → response có latitude/longitude
Edit cluster 1 → modal hiển thị map preview tại tọa độ hiện có
```

---

## Checklist

**General**
- [x] Không còn debug code / console.log thừa
- [x] Follows project coding conventions (functional components, CSS variables cho theming)
- [x] Hoạt động trên cả dark mode và light mode (dùng `var(--bg-main)`, `var(--border-color)`, `var(--text-main)`)

**Autocomplete**
- [x] Debounce 500ms — tuân thủ Nominatim ToS (1 req/s)
- [x] Gợi ý từ ≥ 3 ký tự, tối đa 5 kết quả
- [x] Giới hạn trong Việt Nam (`countrycodes=vn`)
- [x] Dropdown đóng khi click ra ngoài
- [x] Không crash nếu Nominatim unreachable (try/catch → empty suggestions)

**Coordinates & Map**
- [x] Tọa độ chỉ set khi chọn từ autocomplete, clear khi gõ tay
- [x] OSM iframe preview hiển thị đúng vị trí với marker
- [x] Badge hiển thị lat/lng 6 decimal places
- [x] `ClusterResponse` + `CreateClusterPayload` trong `movieApi.ts` có `latitude`/`longitude`

**Province Auto-detection**
- [x] `NOMINATIM_PROVINCE_MAP` covers 20 tỉnh/thành trong `PROVINCES` array
- [x] Fallback partial-match cho tên biến thể
- [x] Province dropdown chỉ update nếu detect được — không override nếu null

**Error Handling & UX**
- [x] Inline error banner thay thế `alert()`
- [x] `saveError` reset về null mỗi lần submit
- [x] Phone normalization strip spaces/dashes trước khi gửi API
- [x] Backend phone regex cập nhật hỗ trợ landline 11 chữ số

---

## Reviewer Notes

- `PlacesAddressInput` là pure presentational component — không có side effects ngoài
  Nominatim fetch. Có thể extract ra file riêng sau nếu cần tái dùng ở form khác.
- Nominatim `User-Agent` header set là `CinePrime/1.0` — đây là bắt buộc theo Nominatim
  ToS để identify ứng dụng.
- OSM iframe embed không cần API key và không giới hạn request — phù hợp production.
- Nếu team muốn chuyển sang Google Maps sau: chỉ cần thay `PlacesAddressInput` component,
  logic `handleAddressChange` và `onProvinceDetected` ở ClusterModal không cần đổi.
- Phone regex cập nhật ở backend (`CinemaClusterRequest.java`) đi kèm MR này — cần rebuild
  `movie-service` sau khi merge.
