# Merge Request Review & Approval Process — HCM26_CPL_JAVA_05_Group1

## Overview

Tài liệu này mô tả quy trình chuẩn để review và approve một Merge Request trong dự án.
Mọi MR đều phải đi qua đủ các bước dưới đây trước khi được merge vào nhánh chính.

---

## Step 1 — Đọc MR Description

Trước khi xem code, reviewer phải đọc kỹ MR description để hiểu:

- **Objective:** MR này giải quyết vấn đề gì?
- **Issue liên quan:** Closes #? — mở issue ra để đọc Acceptance Criteria.
- **Scope of changes:** Những file/layer nào bị ảnh hưởng?
- **Key Decisions:** Tác giả đã đưa ra quyết định kỹ thuật gì và tại sao?
- **Reviewer Notes:** Có điểm nào cần chú ý đặc biệt không?

> Nếu MR thiếu description hoặc description quá sơ sài → yêu cầu tác giả bổ sung trước khi review.

---

## Step 2 — Checkout nhánh về local

```bash
git fetch origin
git checkout <branch-name>

# Ví dụ:
git checkout feat/admin-booking-management-ui
```

Chạy project để đảm bảo không có lỗi compile:

```bash
# Frontend
cd client && npm install && npm run dev

# Backend
cd server/<service-name> && mvn spring-boot:run
```

> Nếu project không chạy được sau khi checkout → đây là blocker, comment ngay, không review tiếp.

---

## Step 3 — Review Code

Đọc từng file thay đổi theo thứ tự từ tầng thấp lên cao:

```
Database / Entity → Repository → Service → Controller → DTO → Frontend API → Component → Page
```

Trong quá trình đọc, kiểm tra các tiêu chí sau:

### Correctness (Logic đúng không?)
- Business logic có đúng với Acceptance Criteria trong issue không?
- Các edge case có được xử lý không? (null, empty list, invalid input)
- Status transition có đúng không? (PENDING → CONFIRMED, không được CANCELLED → CONFIRMED)

### Security
- Endpoint có được bảo vệ đúng role chưa? (`@PreAuthorize`, `ProtectedRoute`)
- JWT token có được validate đúng không?
- Không để lộ thông tin nhạy cảm trong response (password hash, internal IDs không cần thiết)
- Input validation có đầy đủ không? (`@NotBlank`, `@Pattern`, frontend form validation)

### Code Quality
- Không có code thừa, debug log, `console.log`, `System.out.println`
- Đặt tên biến/function rõ ràng, đúng convention
- Không có code lặp lại — tái sử dụng đúng chỗ
- Không hardcode magic number hay string

### Database / JPA (Backend)
- Không có N+1 query — kiểm tra Hibernate console output
- Transaction được dùng đúng (`@Transactional`)
- Index có được tạo cho các cột query thường xuyên không?

### Frontend
- `axiosClient` attach Bearer token đúng — không gửi `"null"` hay `"undefined"`
- Loading state và error state được handle đủ
- UI cập nhật đúng sau khi action thành công (không hiển thị data cũ)
- Tested cả dark mode và light mode

---

## Step 4 — Chạy thử theo "How to Test" trong MR

Làm theo đúng các bước trong phần **How to Test** của MR description.

Nếu MR không có phần How to Test → yêu cầu tác giả bổ sung.

Ghi lại kết quả: pass hay fail từng bước.

---

## Step 5 — Để lại comments

Phân loại comment theo mức độ:

| Tag | Ý nghĩa | Tác giả có bắt buộc fix không? |
|---|---|---|
| `[BLOCKER]` | Lỗi nghiêm trọng, sai logic, security risk, không compile được | Bắt buộc fix trước khi approve |
| `[MAJOR]` | Vấn đề quan trọng ảnh hưởng chất lượng, cần fix nhưng không block deploy | Nên fix trong MR này |
| `[MINOR]` | Cải thiện nhỏ, code style, naming | Có thể fix sau hoặc tạo issue riêng |
| `[QUESTION]` | Reviewer chưa hiểu, cần tác giả giải thích | Tác giả trả lời, không nhất thiết phải thay đổi code |
| `[NITPICK]` | Góp ý cá nhân, không ảnh hưởng functionality | Tùy tác giả |

**Ví dụ comment:**

```
[BLOCKER] axiosClient đang gửi token "null" khi chưa đăng nhập vì:
  const token = localStorage.getItem("accessToken"); // trả về string "null"
  headers["Authorization"] = `Bearer ${token}`;      // → "Bearer null"
Fix: chỉ attach header khi token là non-empty string thực sự.

[QUESTION] Tại sao dùng saveAndFlush thay vì save ở đây? 
Có phải để đảm bảo accountId được gen ra trước khi publish Kafka event không?

[NITPICK] Tên biến `data` ở dòng 42 hơi generic, đổi thành `bookingResponse` rõ hơn.
```

> Comment phải kèm dòng code cụ thể, không comment chung chung.

---

## Step 6 — Approve hoặc Request Changes

### Approve khi:
- Không còn `[BLOCKER]` nào
- Tất cả `[MAJOR]` đã được fix hoặc tác giả có lý do hợp lý để defer
- How to Test đã pass

Trên GitLab: **Submit review → Approve**

### Request Changes khi:
- Còn ít nhất 1 `[BLOCKER]` chưa được fix
- Project không chạy được sau khi checkout

Trên GitLab: **Submit review → Request changes** — tác giả sẽ nhận notification.

---

## Step 7 — Merge

Sau khi MR được approve, **người tạo MR** (không phải reviewer) thực hiện merge:

1. Đảm bảo không có conflict với nhánh target (`develop` / `main`)
2. Resolve conflict nếu có (tác giả tự resolve, reviewer review lại nếu conflict lớn)
3. Chọn merge strategy: **Squash and merge** (recommended) hoặc **Merge commit**
4. Xóa nhánh sau khi merge (GitLab có tùy chọn "Delete source branch")
5. Verify issue tự động đóng (nếu MR description có `Closes #<number>`)

---

## Step 8 — Dọn dẹp nhánh local sau khi merge

Sau khi MR được merge và GitLab đã xóa nhánh remote, **tác giả** dọn dẹp local:

```bash
# 1. Checkout develop và lấy code mới nhất
git checkout develop
git pull origin develop

# 2. Xóa nhánh feature local
git branch -D feat/tên-nhánh
```

> Dùng `-D` (force delete) thay vì `-d` vì Squash merge khiến Git không nhận ra nhánh đã được merge, nên `-d` sẽ báo lỗi.

Nếu GitLab không tự xóa nhánh remote (không tick "Delete source branch" lúc merge):

```bash
git push origin --delete feat/tên-nhánh
```

Sau đó tạo nhánh mới cho task tiếp theo từ `develop` mới nhất:

```bash
git checkout -b feat/tên-feature-mới
```

---

## Quy tắc chung

- Reviewer phải hoàn thành review trong **24 giờ** kể từ khi được assign
- Một MR cần **ít nhất 1 approval** trước khi merge vào `develop`
- Tác giả **không tự merge** MR của mình
- MR quá lớn (> 500 dòng thay đổi) nên được chia nhỏ thành nhiều MR
- Mọi comment `[BLOCKER]` phải được resolve và reviewer confirm trước khi approve
