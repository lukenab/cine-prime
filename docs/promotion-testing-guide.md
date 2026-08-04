# Promotion — Hướng dẫn test thủ công (P0 demo)

**Phạm vi:** luồng khách hàng nhập mã giảm giá khi đặt vé + luồng admin quản lý promotion.
**Không thuộc phạm vi:** promotion theo phim/suất chiếu cụ thể (UI chưa có, xem mục "Gap đã biết" cuối tài liệu).

---

## 1. Chuẩn bị môi trường

### 1.1. Service cần chạy (theo thứ tự)
1. `discovery-server`
2. `api-gateway`
3. `auth-service`
4. `user-service`
5. `movie-service`
6. `booking-service`
7. `promotion-service`
8. `concession-service` *(cần nếu test luôn bước thêm bắp nước)*
9. `payment-service`
10. `client` (`npm run dev`)

### 1.2. Dữ liệu demo có sẵn (đã seed qua migration, không cần tạo tay)

| Field | Giá trị |
|---|---|
| Code | `CINEPRIME20` |
| Tên | CinePrime Opening Offer |
| Loại giảm giá | Percentage 20%, tối đa 50.000đ |
| Đơn tối thiểu | 100.000đ |
| Giới hạn toàn hệ thống | 100 |
| Giới hạn mỗi tài khoản | **1** (cố ý để lần thứ 2 báo hết hạn mức ngay) |
| Trạng thái | `ACTIVE` |

> Nếu không thấy promotion này khi load `ManagePromotionPage`, kiểm tra `promotion_db` đã chạy đủ migration V1–V4 chưa (`docker exec postgres psql -U postgres -d promotion_db -c "\dt"` phải ra ≥ 5 bảng).

### 1.3. Tài khoản test cần có
- 1 tài khoản `ROLE_MEMBER` (đặt vé) — nên tạo **mới** hoặc chưa từng dùng `CINEPRIME20` để test được đủ cả hai nhánh (còn hạn mức / hết hạn mức).
- 1 tài khoản `ROLE_ADMIN` (quản lý promotion).

---

## 2. Test case — Khách hàng đặt vé kèm mã giảm giá

Thực hiện theo đúng thứ tự để tài khoản test tự "dùng hết" hạn mức ở TC-05.

| ID | Bước | Kỳ vọng |
|---|---|---|
| TC-01 | Chọn phim → suất chiếu → chọn ghế → tại panel bên phải, nhập `CINEPRIME20` vào ô "Promotion code" → bấm Continue | Booking được tạo thành công, chuyển sang bước "Choose food & drinks" (`/checkout/{id}/concessions`) |
| TC-02 | Ở bước concession, bấm "Continue" mà không thêm gì (hoặc thêm 1 combo) → sang trang checkout | Trang checkout hiển thị: mã `CINEPRIME20`, số tiền giảm (đúng 20%, không vượt 50.000đ), giá vé gốc, tổng thanh toán đúng = vé + concession − giảm giá. **Không có ô "Apply" nào ở đây** (chỉ hiển thị, không cho sửa mã) |
| TC-03 | Thanh toán qua VNPAY Sandbox thành công | Vé xuất ra QR, phần "Concessions"/vé hiển thị đúng promotion đã áp dụng |
| TC-04 (backend) | Sau khi thanh toán, kiểm tra promotion detail (mục 3) | `Committed` tăng thêm 1, `Reserved` giảm về đúng số đang treo |
| TC-05 | Lặp lại TC-01 **bằng đúng tài khoản vừa dùng** ở TC-01 | Booking **vẫn được tạo thành công** (ghế vẫn giữ), nhưng ở bước "Choose food & drinks" hiện banner vàng: *"Your promotion code wasn't applied. This promotion code has reached its usage limit. Your seats are still held — you can continue at full price."* Checkout không có giảm giá, thanh toán full giá bình thường |
| TC-06 | Nhập mã sai chính tả, ví dụ `CINEPRIME2O` (số 0 → chữ O) | Giống TC-05: booking vẫn tạo được, banner hiện lý do *"This promotion code isn't valid for this booking."*, ghế không bị mất |
| TC-07 | Không nhập mã gì, đặt vé bình thường | Không có banner, không giảm giá, hoạt động như trước khi có tính năng promotion |
| TC-08 | Chọn 1 ghế duy nhất có giá dưới 100.000đ, nhập `CINEPRIME20` | Banner báo lý do không đủ điều kiện (dưới ngưỡng tối thiểu), booking vẫn thành công không giảm giá |
| TC-09 | TC-01 xong nhưng **không thanh toán**, để hết hạn giữ ghế (hoặc bấm Cancel booking) | Sau khi hủy/hết hạn, kiểm tra promotion detail: `Reserved` giảm về 0 cho reservation này (quota được trả lại, không bị "kẹt") |

**Lưu ý khi test TC-05/06/08:** đây chính là hành vi vừa được sửa — trước đó mã bị từ chối sẽ hủy luôn cả giữ ghế, giờ chỉ mất phần giảm giá. Nếu thấy phải chọn lại ghế từ đầu khi gõ sai mã → đây là regression, cần báo ngay.

---

## 3. Test case — Admin quản lý promotion

Vào `Admin → Promotions`.

| ID | Bước | Kỳ vọng |
|---|---|---|
| TA-01 | Mở danh sách Promotions | Thấy `CINEPRIME20` trạng thái `Active`, đúng số liệu Total/Active/Draft/Paused ở 4 ô thống kê đầu trang |
| TA-02 | Gõ "cine" vào ô Search | Danh sách lọc còn đúng `CINEPRIME20` |
| TA-03 | Chọn filter status = `Draft` | Danh sách rỗng nếu chưa tạo promotion nháp nào |
| TA-04 | Bấm "Create promotion" → điền: code `TESTQA10`, tên bất kỳ, discount 10%, min order 0 → "Save draft" | Tạo thành công, chuyển sang trang Detail, trạng thái là `Draft` |
| TA-05 | Ở trang Detail của `TESTQA10`, bấm "Activate" | Trạng thái chuyển `Active`, nút đổi thành Pause/Archive |
| TA-06 | Bấm "Pause" | Trạng thái chuyển `Paused` |
| TA-07 | Bấm "Archive" | Trạng thái chuyển `Archived`, không còn nút Activate |
| TA-08 | Quay lại Edit `TESTQA10` khi đã Active/Archived (không phải Draft) | Nút "Edit" không hiện trong danh sách/detail cho promotion không phải Draft; nếu vào thẳng URL `/admin/promotions/edit/{id}` → hiện lỗi "Only draft promotions can be edited." |
| TA-09 | Mở Detail của `CINEPRIME20` sau khi đã chạy xong mục 2 (TC-01→TC-09) | Section **Usage** hiện đúng 3 số: Reserved / Committed / Remaining khớp với các bước đã làm ở mục 2. Section **Audit timeline** liệt kê đủ các hành động đã thực hiện (CREATED, ACTIVATED...) kèm thời gian, người thực hiện |
| TA-10 | Bấm "Refresh" ở danh sách sau khi vừa đổi trạng thái ở tab khác | Danh sách cập nhật đúng trạng thái mới nhất |

---

## 4. Kiểm tra sâu ở tầng dữ liệu (khi UI không đủ để xác nhận)

```bash
# Xem toàn bộ promotion và số liệu quota
docker exec postgres psql -U postgres -d promotion_db -c \
  "SELECT code, status, global_usage_limit, per_account_usage_limit, active_reservation_count, committed_usage_count FROM promotion;"

# Xem lịch sử reserve/commit/release của 1 promotion cụ thể
docker exec postgres psql -U postgres -d promotion_db -c \
  "SELECT status, account_id, booking_id, discount_amount, reserved_at, committed_at, released_at, expired_at FROM promotion_reservation ORDER BY reserved_at DESC LIMIT 10;"

# Xem audit log (khớp với Audit timeline trên UI)
docker exec postgres psql -U postgres -d promotion_db -c \
  "SELECT action, actor_account_id, created_at FROM promotion_audit_log ORDER BY created_at DESC LIMIT 10;"
```

Trên `booking_db`, kiểm tra booking đã lưu đúng snapshot mã/giảm giá:
```bash
docker exec postgres psql -U postgres -d booking_db -c \
  "SELECT booking_id, promotion_code, promotion_discount_amount, total_amount, final_amount FROM booking ORDER BY created_at DESC LIMIT 5;"
```

---

## 5. Gap đã biết (không phải bug, không nằm trong phạm vi test lần này)

- **Chưa có UI chọn scope theo phim/suất chiếu cụ thể** — form Create/Edit promotion hiện chỉ tạo được promotion áp dụng toàn hệ thống (global). Backend đã sẵn sàng nhận (`promotion_target`), chỉ là chưa có ô nhập ở UI.
- Nội bộ `/api/internal/promotions/**` chỉ gọi được từ `booking-service` (qua Feign + `X-Internal-Service-Key`), không có route ở API Gateway — **không cần test bằng Postman/trực tiếp từ trình duyệt**, vì sẽ luôn bị từ chối, đúng như thiết kế.
