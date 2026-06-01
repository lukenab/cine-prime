# Tài liệu hướng dẫn đóng góp (Contributing Guidelines)

Để đảm bảo quản lý mã nguồn hiệu quả và cộng tác tốt, mọi thành viên vui lòng tuân thủ chặt chẽ các quy định từ Git Lab Guide dưới đây.

## 1. Quản lý Task & Issue (Git Lab Issue Board)
Chúng ta sử dụng Git Lab Issues Board để log và quản lý task. Mọi Issue khi tạo ra bắt buộc phải được gắn đầy đủ các Label sau để phân loại:

* **Label Theo Loại (Type):**
  * `Type::Feature`: Phát triển tính năng mới mang lại giá trị cho người dùng.
  * `Type::Bug`: Lỗi phát sinh trong quá trình code hoặc do QA báo cáo.
  * `Type::Chore`: Các task cấu hình hạ tầng, maintain hệ thống (không liên quan trực tiếp đến end-user).
  * `Type::Docs`: Tạo tài liệu, sơ đồ, đặc tả hệ thống.

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

## 4. Hướng dẫn tạo Pull Request (PR)
Để merge tính năng mới vào nhánh `develop`, bắt buộc tạo Pull Request (PR) để theo dõi và verify. 
* **Lưu ý:** Ngay khi tạo PR, hãy gắn label `Review/ QA` để báo cho team biết code đã sẵn sàng để kiểm tra.
* **Quy trình Review:** Tuyệt đối không tự ý gộp (Merge) code của chính mình. Chỉ người được assign review mới có quyền bấm nút Merge sau khi code đạt chuẩn.

### 4.1. Template dành cho nhánh Code (Implementation Format)
```text
**Definition of Done**
* [ ] Feature works as expected and passes manual testing
* [ ] Code follows project conventions and is lint-free
* [ ] Unit and integration tests are written and passing
* [ ] No sensitive data or hardcoded secrets
* [ ] Feature is documented (README, API docs)
* [ ] CI/CD pipeline passes successfully
* [ ] Code is reviewed and approved

**Review Checklist**
* [ ] PR is linked to a task or issue
* [ ] PR title follows naming convention ([Feature], [Fix], [Refactor], etc.)
* [ ] Code is modular and follows SOLID principles
* [ ] Proper error handling and edge case coverage
* [ ] API responses are consistent and documented
* [ ] Git history is clean (no debug commits, proper messages)
* [ ] No unused code, commented-out blocks, or console logs
* [ ] Feature is integrated and does not break existing flows

**Test Coverage**
* Unit Tests:
* Manual Test Results: (Insert screenshots or logs)

**Change Description**
* Design: [Link the design pull request if have]

**Related Tasks / Issues**
* Issues: [Insert Link]