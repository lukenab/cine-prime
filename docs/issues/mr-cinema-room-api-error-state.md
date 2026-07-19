## Overview / Objective

Hoàn thiện issue `[Frontend] Distinguish cinema-room API errors from empty state`. Trước thay đổi này, trang Cinema Cluster Detail bỏ qua trường hợp rooms API bị reject trong `Promise.allSettled()`, khiến lỗi 4xx/5xx/network bị hiển thị sai thành trạng thái “No rooms in this cluster”.

MR này tách riêng lifecycle tải dữ liệu của cluster và room list, giữ cluster header khi room request thất bại, đồng thời bổ sung error row, Retry và correlation/request ID phục vụ troubleshooting.

Related Issue: Closes #169

---

## Changes Introduced

**Controllers / Routes:**
- Không thay đổi route hoặc backend endpoint.
- Giữ nguyên trang `/admin/clusters/{clusterId}`.

**Services / Logic:**
- Giữ `Promise.allSettled()` để cluster và room list có thể hoàn thành độc lập.
- Tách trạng thái dùng chung `loading/error` thành:
  - `clusterLoading` và `clusterError`.
  - `roomsLoading` và `roomsError`.
- Bổ sung `loadRooms()` để Retry chỉ tải lại resource phòng bị lỗi.
- Chỉ hiển thị empty state sau khi rooms API thành công với `result: []`.
- Không dùng `cluster.totalRooms` hoặc `cluster.totalSeats` để giả lập room list.

**DTOs / Mappers / Components:**
- Bổ sung `ResourceError` và hàm chuẩn hóa error response độc lập với Axios.
- Hỗ trợ đọc correlation/request ID từ các field/header phổ biến:
  - `correlationId`.
  - `requestId`.
  - `traceId`.
  - `x-correlation-id`.
  - `x-request-id`.
  - `x-trace-id`.
- Bổ sung error row ngay trong room table, giữ nguyên table header để layout không bị thay đổi đột ngột.
- Error row bao gồm:
  - Thông báo `Failed to load rooms`.
  - Error message từ API nếu có.
  - Request ID và thao tác copy.
  - Nút `Retry`.
- Giữ cluster header và cluster profile khi cluster request thành công nhưng rooms request thất bại.

**Database / JPA / Migration:**
- Không áp dụng.

**Exception Handling / Error Codes:**
- Không thay đổi backend error code.
- Frontend phân biệt rõ cluster failure, room failure và successful-empty response.
- Không còn chuyển room API failure thành empty state.

---

## Key Architectural Decisions

- **Dùng resource-specific state:** cluster metadata và room list là hai resource độc lập. Một request thất bại không được che khuất kết quả thành công của request còn lại.
- **Giữ `Promise.allSettled()`:** phù hợp với yêu cầu partial rendering; trang vẫn có thể hiển thị cluster header khi room service tạm thời không khả dụng.
- **Retry theo phạm vi lỗi:** nút Retry trong error row chỉ gọi lại rooms API, tránh tải lại cluster metadata không cần thiết.
- **Empty state chỉ đại diện cho response thành công:** `No rooms in this cluster` chỉ xuất hiện khi server xác nhận `result: []`, không dựa trên counters hoặc giá trị mặc định của state.
- **Giữ table structure ổn định:** loading, error và empty state đều được render trong `<tbody>`, nhờ đó table header không biến mất hoặc làm layout nhảy.

---

## How to Test

### Automated tests

1. Mở terminal tại thư mục `client`.
2. Chạy regression test riêng:

   ```bash
   npm test -- ClusterDetailPage.test.tsx
   ```

3. Kết quả mong đợi: `2/2` test pass.
4. Chạy toàn bộ frontend test suite:

   ```bash
   npm test
   ```

5. Kết quả đã xác nhận: `22` test files, `177/177` tests pass.
6. Chạy production build:

   ```bash
   npm run build
   ```

7. Kết quả đã xác nhận: build thành công.

### Manual verification

1. Đăng nhập bằng tài khoản `ADMIN` hoặc `EMPLOYEE` có quyền xem Cinema Cluster.
2. Mở `/admin/clusters/{clusterId}` với cluster có `totalRooms > 0`.
3. Mô phỏng rooms API trả `4xx`, `5xx` hoặc network error.
4. Xác nhận:
   - Cluster header và cluster profile vẫn hiển thị.
   - Room table hiển thị `Failed to load rooms`.
   - Không hiển thị `No rooms in this cluster`.
   - Có nút `Retry`.
5. Nếu error response có correlation/request ID, xác nhận ID hiển thị và nút copy hoạt động.
6. Khôi phục rooms API và nhấn `Retry`:
   - Nếu API trả danh sách phòng, các phòng được render bình thường.
   - Nếu API thành công với `result: []`, empty state mới được hiển thị.
7. Kiểm tra error row, Retry và request ID trên cả light mode và dark mode.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions
- [x] `git diff --check` pass

**Backend**
- Không áp dụng — MR không thay đổi backend, database hoặc API contract.

**Frontend**
- [x] Loading, success-empty và failure states được xử lý độc lập
- [x] Cluster success không bị che khi rooms API thất bại
- [x] Retry chỉ tải lại room resource bị lỗi
- [x] Correlation/request ID được hiển thị và có thể copy khi response cung cấp
- [x] Có regression test cho trường hợp `totalRooms > 0` nhưng rooms API reject
- [x] `22` test files, `177/177` tests pass
- [x] `npm run build` pass
- [x] Không thay đổi cơ chế Bearer token của `axiosClient`
- [ ] Browser QA trên light mode
- [ ] Browser QA trên dark mode

---

## Reviewer Notes

- Tập trung review thứ tự ưu tiên trong room table: `loading → error → success-empty → success-with-data`.
- Xác nhận room API failure không còn đi vào empty-state branch, kể cả khi `cluster.totalRooms > 0`.
- Nút Retry trong error row phải chỉ gọi `getRoomsByCluster()`; regression test kiểm tra cluster API vẫn chỉ được gọi một lần.
- Browser QA light/dark chưa được đánh dấu hoàn thành vì môi trường browser automation không truy cập được local loopback. Cần kiểm tra nhanh hai theme trước khi merge.
- Vite vẫn phát cảnh báo bundle lớn hơn 500 kB; đây là cảnh báo tồn tại ở cấp ứng dụng và không thuộc phạm vi issue #169.
