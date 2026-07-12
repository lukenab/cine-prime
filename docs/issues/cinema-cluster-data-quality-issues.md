# Issues — Cinema Cluster Data Quality
> 4 issues triển khai theo 4 mức độ data validation cho Cinema Cluster

---

## Issue 1

**Title:** `[Backend] Add input validation for Cinema Cluster API`

**Labels:** `Layer::Backend` · `Type::Feature` · `Priority::High`

```markdown
## Summary / Objective

Hiện tại các field `phoneNumber` và `address` của cinema cluster là free-text không có
validation format. Điều này cho phép nhập số điện thoại sai định dạng hoặc địa chỉ rỗng
vượt qua được API. Issue này thêm validation chuẩn vào `CinemaClusterRequest` để đảm bảo
tính nhất quán dữ liệu từ đầu vào.

---

## Estimate

- [ ] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] `phoneNumber` validate regex số điện thoại Việt Nam: bắt đầu bằng 0, đầu số hợp lệ
      (03x, 05x, 07x, 08x, 09x), đủ 10 chữ số
- [ ] `phoneNumber` là optional — nếu truyền lên thì phải đúng format, nếu không truyền thì
      bỏ qua validation
- [ ] `clusterName` không cho phép khoảng trắng đầu/cuối (trim) và độ dài 2–100 ký tự
- [ ] `address` tối thiểu 10 ký tự (tránh nhập "abc" hay "N/A")
- [ ] `province` phải nằm trong danh sách tỉnh/thành phố được phép (enum hoặc whitelist)
- [ ] Khi vi phạm validation → trả về 400 Bad Request với message rõ ràng bằng tiếng Anh
- [ ] Unit test cho các trường hợp: phone hợp lệ, phone sai định dạng, phone null, address
      quá ngắn, province không hợp lệ

---

## API Specifications

### Validation rules — CinemaClusterRequest

| Field | Rule | Error message |
|---|---|---|
| clusterName | @NotBlank, @Size(min=2, max=100) | "Cluster name must be 2–100 characters" |
| province | @NotBlank, must be in ALLOWED_PROVINCES | "Invalid province" |
| address | @NotBlank, @Size(min=10, max=255) | "Address must be at least 10 characters" |
| phoneNumber | nullable, regex ^(0[35789][0-9]{8})$ | "Invalid Vietnam phone number format" |

**Request (invalid phone):**
```json
{
  "clusterName": "CinePrime Test",
  "province": "Hà Nội",
  "address": "123 Đường ABC, Hoàn Kiếm",
  "phoneNumber": "012345"
}
```

**Response 400:**
```json
{
  "code": 400,
  "message": "Invalid Vietnam phone number format"
}
```

---

## Technical Notes

- Dùng `@Pattern(regexp = "^(0[35789][0-9]{8})$")` trên field `phoneNumber`
- Tạo `@ValidProvince` custom annotation hoặc dùng `@Pattern` với danh sách tỉnh
  được phép — danh sách khớp với `PROVINCES` array trong frontend
- Trim `clusterName` và `address` trong service/controller trước khi save

---

## Related

- Branch: `feat/cinema-cluster-validation`
- Depends on: Cinema Cluster CRUD API (đã implement)
```

---

## Issue 2

**Title:** `[Database] Add geocoding fields to cinema_cluster table`

**Labels:** `Layer::Database` · `Type::Feature` · `Priority::Medium`

```markdown
## Summary / Objective

Bảng `cinema_cluster` hiện tại chỉ lưu địa chỉ dạng text. Để hỗ trợ hiển thị bản đồ,
tính khoảng cách "rạp gần nhất" và tích hợp Google Maps, cần thêm 2 cột `latitude` và
`longitude` vào bảng. Dữ liệu tọa độ cho 6 cluster seed hiện có sẽ được seed luôn.

---

## Estimate

- [ ] S (< 2h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Thêm cột `latitude DECIMAL(10,7)` và `longitude DECIMAL(10,7)` vào `cinema_cluster`
      (nullable — cluster cũ không bắt buộc phải có tọa độ ngay)
- [ ] Migration script idempotent (`ADD COLUMN IF NOT EXISTS`)
- [ ] Seed tọa độ cho 6 cluster hiện có (lấy từ Google Maps)
- [ ] `CinemaCluster` entity, `CinemaClusterResponse`, `CinemaClusterRequest` cập nhật
      thêm 2 field mới
- [ ] `GET /api/cinema-clusters` trả về `latitude` + `longitude` trong response
- [ ] `POST/PUT` cho phép truyền tọa độ, validate range: lat (-90, 90), lng (-180, 180)
- [ ] Schema diagram `dbdiagram_cineprime.dbml` cập nhật

---

## API Specifications

### Updated CinemaClusterResponse

```json
{
  "clusterId": 1,
  "clusterName": "CinePrime Quận 1",
  "province": "TP. Hồ Chí Minh",
  "address": "123 Nguyễn Huệ, Quận 1",
  "phoneNumber": "028 3822 1234",
  "latitude": 10.7769,
  "longitude": 106.7009,
  "status": "ACTIVE",
  "totalRooms": 4,
  "totalSeats": 400
}
```

### Seed tọa độ 6 cluster

| Cluster | Latitude | Longitude |
|---|---|---|
| CinePrime Quận 1 | 10.776966 | 106.700965 |
| CinePrime Thủ Đức | 10.850000 | 106.771667 |
| CinePrime Hoàn Kiếm | 21.028511 | 105.834160 |
| CinePrime Cầu Giấy | 21.036389 | 105.782222 |
| CinePrime Hải Châu | 16.068000 | 108.212000 |
| CinePrime Ninh Kiều | 10.033333 | 105.783333 |

---

## Technical Notes

- `DECIMAL(10,7)` đủ độ chính xác ~1cm — chuẩn cho ứng dụng map
- Nullable để không break cluster đã có trước khi có geocoding
- Validate ở backend: lat phải trong [-90, 90], lng trong [-180, 180]

---

## Related

- Branch: `feat/cinema-cluster-geocoding-fields`
- Depends on: Issue 1 (validation), Cinema Cluster CRUD
- Docs: dbdiagram_cineprime.dbml
```

---

## Issue 3

**Title:** `[Frontend] Integrate Google Maps Places API for Cinema Cluster address autocomplete`

**Labels:** `Layer::Frontend` · `Type::Feature` · `Priority::Medium`

```markdown
## Summary / Objective

Khi admin tạo/sửa cinema cluster, field `address` hiện tại là text input tự do — dễ nhập
sai địa chỉ hoặc không nhất quán format. Tích hợp Google Maps Places API Autocomplete để:
(1) gợi ý địa chỉ thực tế khi gõ, (2) tự điền `latitude`/`longitude` sau khi chọn,
(3) không thể lưu địa chỉ không tồn tại trên bản đồ.

---

## Estimate

- [ ] M (2–4h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Field `address` trong `ClusterModal` dùng Google Places Autocomplete — gợi ý địa chỉ
      khi gõ từ 3 ký tự trở lên, giới hạn kết quả trong Việt Nam (`componentRestrictions: { country: 'vn' }`)
- [ ] Khi chọn một gợi ý: `address` tự điền địa chỉ đầy đủ, `latitude` + `longitude` tự
      điền từ place geometry
- [ ] Vẫn cho phép nhập tay (không bắt buộc chọn từ autocomplete) để không block workflow
- [ ] API key Google Maps lưu trong `.env` (`VITE_GOOGLE_MAPS_API_KEY`), không hardcode
- [ ] Load Google Maps script lazily (chỉ load khi modal mở, không block trang chính)
- [ ] Hoạt động trên cả dark mode và light mode
- [ ] Fallback graceful nếu API key không có hoặc request fail: hiển thị text input bình thường

---

## Technical Notes

- Dùng `@react-google-maps/api` hoặc load script trực tiếp qua `useEffect`
- Chỉ cần enable **Places API** trên Google Cloud Console (không cần Maps JavaScript API
  riêng nếu dùng Autocomplete Service)
- Free tier: 28,500 requests/tháng — đủ cho môi trường dev/staging
- `latitude`/`longitude` gửi lên backend cùng payload POST/PUT sau Issue 2

---

## Related

- Branch: `feat/cinema-cluster-address-autocomplete`
- Depends on: Issue 2 (geocoding fields phải có trước)
- Env var: `VITE_GOOGLE_MAPS_API_KEY` thêm vào `.env.example`
```

---

## Issue 4

**Title:** `[Backend] Implement Cinema Cluster approval workflow and audit log`

**Labels:** `Layer::Backend` · `Type::Feature` · `Priority::Low`

```markdown
## Summary / Objective

Trong môi trường production của chuỗi rạp thực tế, dữ liệu location (địa chỉ, tọa độ, tên
cụm rạp) ảnh hưởng trực tiếp đến trải nghiệm khách hàng và SEO. Cần có approval workflow
để ADMIN cấp cao (SUPER_ADMIN) review trước khi cluster mới được public, kết hợp audit log
ghi lại mọi thay đổi — ai tạo/sửa/duyệt khi nào.

---

## Estimate

- [ ] L (4–8h)

---

## Acceptance Criteria (Definition of Done)

- [ ] Thêm trạng thái `PENDING_REVIEW` vào `ClusterStatus` (DRAFT → PENDING_REVIEW → ACTIVE)
- [ ] `POST /api/cinema-clusters` tạo cluster với status `DRAFT` — chưa hiển thị trên
      trang khách hàng
- [ ] `POST /api/cinema-clusters/{id}/submit` — ADMIN submit để SUPER_ADMIN review
- [ ] `POST /api/cinema-clusters/{id}/approve` — SUPER_ADMIN approve → status ACTIVE
- [ ] `POST /api/cinema-clusters/{id}/reject` — SUPER_ADMIN reject kèm `rejectionNote`
- [ ] Bảng `cinema_cluster_audit_log` ghi lại: clusterId, action (CREATE/UPDATE/APPROVE/
      REJECT/DEACTIVATE), performedBy (accountId), oldStatus, newStatus, note, timestamp
- [ ] `GET /api/cinema-clusters/{id}/audit-log` — xem lịch sử thay đổi của 1 cluster
      (ADMIN only)
- [ ] `GET /api/cinema-clusters` mặc định chỉ trả về status ACTIVE cho public endpoint;
      ADMIN thấy tất cả status

---

## API Specifications

### State machine

DRAFT → PENDING_REVIEW (ADMIN submit)
PENDING_REVIEW → ACTIVE (SUPER_ADMIN approve)
PENDING_REVIEW → DRAFT (SUPER_ADMIN reject)
ACTIVE → INACTIVE (ADMIN deactivate)
INACTIVE → ACTIVE (ADMIN reactivate)

### POST /api/cinema-clusters/{id}/reject

**Request:**
```json
{
  "rejectionNote": "Địa chỉ không chính xác, vui lòng kiểm tra lại tọa độ"
}
```

**Response 200:**
```json
{
  "code": 200,
  "message": "Cluster rejected",
  "result": {
    "clusterId": 7,
    "status": "DRAFT",
    "rejectionNote": "Địa chỉ không chính xác, vui lòng kiểm tra lại tọa độ"
  }
}
```

### GET /api/cinema-clusters/{id}/audit-log

**Response 200:**
```json
{
  "code": 200,
  "result": [
    {
      "action": "CREATE",
      "performedBy": "admin_01",
      "oldStatus": null,
      "newStatus": "DRAFT",
      "note": null,
      "timestamp": "2026-07-10T10:00:00Z"
    },
    {
      "action": "APPROVE",
      "performedBy": "superadmin_01",
      "oldStatus": "PENDING_REVIEW",
      "newStatus": "ACTIVE",
      "note": "Verified address and coordinates",
      "timestamp": "2026-07-10T11:30:00Z"
    }
  ]
}
```

---

## Technical Notes

- Tham khảo pattern `movie_action_log` đang có trong movie-service — dùng cùng cấu trúc
- `SUPER_ADMIN` role cần được thêm vào auth-service nếu chưa có; hoặc tạm thời dùng
  `ROLE_ADMIN` với permission check riêng qua `@PreAuthorize`
- Audit log nên lưu snapshot của dữ liệu (JSON) để có thể rollback nếu cần

---

## Related

- Branch: `feat/cinema-cluster-approval-workflow`
- Depends on: Issue 1 (validation), Issue 2 (geocoding)
- Pattern reference: `MovieActionLog.java`, `AuditLogService.java`
```
