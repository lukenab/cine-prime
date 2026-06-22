# Tài liệu hướng dẫn đóng góp (Contributing Guidelines)

Để đảm bảo quản lý mã nguồn hiệu quả và cộng tác tốt, mọi thành viên vui lòng tuân thủ chặt chẽ các quy định từ Git Lab Guide dưới đây.

## 1. Quản lý Task & Issue (Git Lab Issue Board)
Chúng ta sử dụng Git Lab Issues Board để log và quản lý task. Mọi Issue khi tạo ra bắt buộc phải được gắn đầy đủ các Label sau để phân loại:

* **Label Theo Loại (Type):**
  * `Type::Feature`: Phát triển tính năng mới mang lại giá trị cho người dùng.
  * `Type::Bug`: Lỗi phát sinh trong quá trình code hoặc do QA báo cáo.
  * `Type::Chore`: Các task cấu hình hạ tầng, maintain hệ thống (không liên quan trực tiếp đến end-user).
  * `Type::Docs`: Tạo tài liệu, sơ đồ, đặc tả hệ thống

* **Label Theo Tầng (Layer):**
  * `Layer::Frontend`: Các task về UI/UX, quản lý state cho ứng dụng React/Vite.
  * `Layer::Backend`: Code server-side, tạo API, xử lý business logic ở các Microservices.
  * `Layer::Database`: Thiết kế schema, data modeling, migration và tối ưu câu truy vấn.
  * `Layer::Infrastructure`: Cấu hình Docker, API Gateway, Service Discovery, môi trường.

* **Label Theo Mức Độ Ưu Tiên (Priority):**
  * `Priority::High`: Task quan trọng, cần làm ngay để không block người khác.
  * `Priority::Medium`: Task tiêu chuẩn, thực hiện theo tiến độ thông thường của Sprint.
  * `Priority::Low`: Task độ ưu tiên thấp (refactor code, chỉnh UI nhỏ), làm khi rảnh.

* **Label Trạng Thái (Status):**
  * `In Progress`: Task đang được code.
  * `Review/ QA`: Đang chờ Leader hoặc team member khác review và merge.
  * **Trọng số (Effort):** Sử dụng các nhãn điểm số (1, 2, 3, 5, 8, 13) để đánh giá độ khó.

## 2. Chiến lược phân nhánh (Git Branching Strategy)

Dự án áp dụng mô hình phân nhánh sau:
* **`master` / `main`:** Nhánh Production, chỉ merge code đã test kỹ lưỡng (thường merge từ nhánh release).
* **`develop`:** Nhánh hội tụ code chính, dùng để merge các nhánh Feature và Hotfix.

### Quy tắc đặt tên nhánh con (Branch Naming Convention):
Tất cả các nhánh tạo mới bắt buộc phải tuân thủ nghiêm ngặt định dạng dưới đây. Tuyệt đối không dùng khoảng trắng, không dùng tiếng Việt có dấu, nối các từ bằng dấu gạch ngang (`-`) và luôn phải đính kèm **Issue ID** (Ví dụ: `#12`).

* **Nhánh Code Tính năng (Feature Implementation):**
  Cú pháp: `features/Implementation_#<IssueID>-<mô-tả-ngắn>`
  Ví dụ: `features/Implementation_#12-login-api`

* **Nhánh Thiết kế (Feature Design):**
  Cú pháp: `features/Design_#<IssueID>-<mô-tả-ngắn>`
  Ví dụ: `features/Design_#13-erd-database-schema`

* **Nhánh Sửa lỗi (Hotfix):**
  Cú pháp: `hotfix/Bug_#<IssueID>-<mô-tả-lỗi>`
  Ví dụ: `hotfix/Bug_#15-payment-crash-fix`

* **Nhánh Cấu hình/Hạ tầng (Chore):**
  Cú pháp: `chore/#<IssueID>-<mô-tả>`
  Ví dụ: `chore/#18-setup-api-gateway`

* **Nhánh Tài liệu (Docs):**
  Cú pháp: `docs/#<IssueID>-<mô-tả>`
  Ví dụ: `docs/#19-update-readme-instructions`

* **Nhánh Phát hành (Release):**
  Cú pháp: `release/sprint_<số-thứ-tự>`
  Ví dụ: `release/sprint_1`

## 3. Quy tắc Commit (Commit Rules)
Viết commit rõ ràng theo cú pháp Conventional Commits kết hợp với `Layer` đang làm.
* **Cú pháp:** `<type>(<layer>): <mô tả ngắn gọn>`
* **Ví dụ chuẩn:**
  * `feat(backend): tạo User Entity và cấu hình JPA cho user-service`
  * `fix(frontend): sửa lỗi tràn layout ở trang danh sách phim React`
  * `chore(infrastructure): thêm allowPublicKeyRetrieval vào cấu hình MySQL`
  * `docs(database): cập nhật sơ đồ ERD cho module thanh toán`
* **Yêu cầu:** Mỗi commit chỉ giải quyết ĐÚNG MỘT thay đổi. Tuyệt đối không gom chung code sửa UI React và code sửa file `docker-compose` vào một commit.

## 4. Quy trình Tạo và Duyệt Merge Request (MR Process)
Mọi lượt gộp code từ nhánh con vào nhánh `develop` đều bắt buộc phải thông qua Merge Request để kiểm tra chất lượng và theo dõi.

### 4.1. Quy trình từng bước áp dụng cho người làm (Assignee)
1. **Đẩy code lên mạng:** Tiến hành tạo nhánh con, commit và push nhánh chứa code của bạn lên GitLab.
2. **Khởi tạo MR:** Trên GitLab, bấm nút **New Merge Request**, chọn nguồn là nhánh của bạn và đích đến là nhánh `develop`.
3. **Ghi nhận thông tin:** 
   * Đặt tiêu đề MR rõ ràng bắt đầu bằng tiền tố loại công việc (`[Feature]`, `[Fix]`, `[Refactor]`, `[Docs]`).
   * Chỉ định người kiểm duyệt chéo (Reviewer/Leader) ở mục Reviewers.
   * Gắn nhãn `Review/ QA` cho Merge Request đó.
4. **Áp dụng Template:** Sao chép chính xác nội dung mẫu mô tả MR tương ứng dưới đây dán vào phần Description.
   * **Simple Format** — dùng cho feature nhỏ, bug fix, hoặc chore đơn giản.
   * **Detailed Format** — dùng cho feature phức tạp, tích hợp nhiều service, hoặc mọi task `Type::Docs`.
5. **Cung cấp Bằng chứng (Evidence):**
   * Đối với task Code: Nhánh code của bạn đã được đẩy lên ở Bước 1. Tuy nhiên, để Reviewer có thể xem nhanh kết quả thực tế mà chưa cần clone code về máy, bạn bắt buộc phải đính kèm ảnh chụp màn hình chạy thử API (Postman) hoặc giao diện chạy thành công vào mục **Test Coverage** trong nội dung (Description) của MR.
   * Đối với task Document: Viết tài liệu trực tiếp bằng định dạng Markdown (`.md`) nằm trong thư mục `docs/` để Reviewer có thể nhìn thấy rõ các dòng chữ thay đổi và comment trực tiếp.
6. **Yêu cầu Duyệt:** Gửi link MR cho người được phân công phụ trách Review.

### 4.2. Quy trình dành cho Người kiểm duyệt (Reviewer)
* Reviewer có trách nhiệm rà soát kỹ mã nguồn, đối chiếu với danh sách các tiêu chí trong phần *Review Checklist* của MR.
* Nếu phát hiện lỗi hoặc điểm chưa tối ưu, thực hiện để lại Comment ngay tại dòng code lỗi để Assignee quay lại sửa đổi.
* Khi code đạt chất lượng và các checklist đều được tích chọn đầy đủ, Reviewer bấm nút **Approve** (Phê duyệt) và thực hiện thao tác **Merge** để gộp code.
* **Tuyệt đối nghiêm cấm:** Thành viên không được tự ý ấn nút Merge vào các nhánh chính khi chưa có sự phê duyệt từ Reviewer/Leader.

---

### 4.3. Các Mẫu mô tả Merge Request (MR Templates)

---

#### Template A — Simple Format
> Dùng cho: feature nhỏ, bug fix, chore, refactor đơn lẻ.

```text
## Change Description
<!-- Mô tả ngắn gọn thay đổi/tính năng đã làm -->
-

## Definition of Done
- [ ] Feature works as expected and passes manual testing
- [ ] Code follows project conventions and is lint-free
- [ ] No sensitive data or hardcoded secrets
- [ ] Feature is documented (README, API docs) if applicable
- [ ] Code is reviewed and approved

## Review Checklist
- [ ] MR is linked to a task or issue
- [ ] MR title follows naming convention ([Feature], [Fix], [Refactor], [Docs], etc.)
- [ ] Code is modular and follows SOLID principles
- [ ] Proper error handling and edge case coverage
- [ ] API responses are consistent and documented
- [ ] Git history is clean (no debug commits, proper messages)
- [ ] No unused code, commented-out blocks, or console logs
- [ ] Feature is integrated and does not break existing flows

## Test Coverage
- Unit Tests:
- Manual Test Results: <!-- Attach screenshots (Postman / UI) -->

## Related Issues
- Closes #<IssueID>
```

---

#### Template B — Detailed Format
> Dùng cho: feature phức tạp tích hợp nhiều service, mọi task `Type::Docs`.

```text
## 1. Description / Overview
<!--
  Tóm tắt MR này làm gì và tại sao cần thay đổi.
  Nêu rõ version trước (nếu có) và phạm vi thay đổi.
  Ví dụ: "This MR synchronizes the Auth Service API documentation with the
  actual Spring Boot implementation, updating auth-service.yaml and
  API_CONTRACT.md to reflect missing endpoints and corrected schemas. #61"
-->


## 2. Core Changes & Implementation Details
<!--
  Liệt kê chi tiết từng file/component đã thay đổi, nhóm theo module.
  Ví dụ:

  **auth-service (Backend):**
  - Added POST /api/auth/resend-otp handler with rate-limit guard (Redis cooldown key).
  - Added EMAIL_SEND_FAILED (1019) error code to AuthErrorCode.java.

  **client (Frontend):**
  - EditUserPage: fetches account + profile in parallel via Promise.all.
  - authApi.ts: added updateAccount() calling PUT /api/accounts/{id}.
-->


## 3. Acceptance Criteria Verification
<!--
  Checklist cụ thể, có thể verify được — KHÔNG dùng checklist chung chung.
  Mỗi item phải trả lời được câu hỏi: "Làm sao reviewer biết cái này đúng?"
  Ví dụ:
  - [ ] POST /api/auth/resend-otp returns 429 when called twice within 60 s.
  - [ ] RegisterRequest phone pattern in YAML matches @Pattern in RegisterRequest.java.
-->
- [ ]
- [ ]
- [ ]

## 4. Files Changed Summary
<!--
  Liệt kê ngắn gọn từng file và mục đích thay đổi.
  Ví dụ:
  - `docs/api-specs/auth-service/auth-service.yaml` — Added missing endpoints, corrected schemas, added JWT security scheme.
  - `client/src/pages/admin/EditUserPage.tsx` — Integrated GET by ID + PUT update flow.
-->
| File | Change |
|---|---|
| `` | |

## Related Issues
- Closes #<IssueID>
```