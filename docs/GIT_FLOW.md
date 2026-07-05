# Git Flow

---

## 1. Branch Model

```
main
 └── develop
      ├── feature/#<issue-id>-<short-description>
      ├── fix/#<issue-id>-<short-description>
      └── docs/#<issue-id>-<short-description>
```

| Branch | Mục đích | Ai được push? |
|---|---|---|
| `main` | Code production, luôn stable | Chỉ merge từ `develop` qua MR |
| `develop` | Integration branch, base cho mọi feature | Chỉ merge qua MR, không push trực tiếp |
| `feature/*` | Implement tính năng mới | Owner của branch |
| `fix/*` | Sửa bug | Owner của branch |
| `docs/*` | Cập nhật tài liệu | Owner của branch |

> **Không push thẳng lên `develop` hoặc `main`.** Mọi thay đổi phải qua MR và được review.

---

## 2. Branch Naming

```
{type}/#<issue-id>-<short-description>
```

| Type | Dùng khi nào |
|---|---|
| `feature` | Implement tính năng mới |
| `fix` | Sửa bug |
| `docs` | Cập nhật tài liệu, API spec |

**Ví dụ:**
```
feature/#53-create-hold-seat-api
feature/#54-cancel-booking-api
fix/#88-booking-status-null-error
docs/#20-sequence-diagram-user-service
```

**Không dùng:**
```
❌ features/Implementation_#57-admin-showtime       (prefix sai)
❌ frontend/#59-showtime-selection-screen           (dùng feature thay vì frontend)
❌ feature/showtime-write-api                       (thiếu issue ID)
❌ feat/employee-management                         (không đúng convention)
```

---

## 3. Quy trình làm việc

### Bước 1 — Tạo branch từ develop

```bash
git checkout develop
git pull origin develop
git checkout -b feature/#53-create-hold-seat-api
```

### Bước 2 — Làm việc và commit

```bash
git add .
git commit -m "feat(booking): implement hold seat API with pessimistic lock"
```

### Bước 3 — Trước khi tạo MR, sync với develop

```bash
git checkout develop
git pull origin develop
git checkout feature/#53-create-hold-seat-api
git rebase develop         # hoặc merge develop nếu team quen merge
```

Giải quyết conflict nếu có, sau đó:

```bash
git push origin feature/#53-create-hold-seat-api
```

### Bước 4 — Tạo Merge Request

- Target branch: `develop`
- Điền MR template đầy đủ
- Assign ít nhất 1 reviewer
- Không tự merge MR của mình

### Bước 5 — Sau khi MR được approve và merge

```bash
# Xóa branch local
git branch -d feature/#53-create-hold-seat-api

# Xóa branch remote (hoặc GitLab tự xóa nếu bật "Delete source branch")
git push origin --delete feature/#53-create-hold-seat-api
```

---

## 4. Commit Message Convention

Theo chuẩn **Conventional Commits**:

```
<type>(<scope>): <short description>
```

| Type | Dùng khi nào |
|---|---|
| `feat` | Thêm tính năng mới |
| `fix` | Sửa bug |
| `refactor` | Refactor code, không thêm feature / sửa bug |
| `docs` | Cập nhật tài liệu |
| `test` | Thêm / sửa test |
| `chore` | Config, build, dependency update |
| `style` | Format code, không thay đổi logic |

**Scope** là tên service hoặc module: `auth`, `booking`, `movie`, `user`, `gateway`, `frontend`

**Ví dụ đúng:**
```
feat(booking): implement cancel booking API
fix(auth): handle expired JWT token on refresh
feat(movie): add showtime write API (POST/PUT/DELETE)
docs(booking): update API contract for seat lock flow
refactor(user): move email validation to common module
chore: add .dockerignore for server build context
```

**Không dùng:**
```
❌ resolve seat booking page
❌ resolve conflict
❌ email sending from auth-service to notification-service
❌ feat/showtime-dto-repository
❌ [Backend] Movie Service: Implement ShowTime Read API
❌ update
❌ fix bug
```

---

## 5. Merge Request Rules

- Mỗi MR chỉ giải quyết **1 issue / 1 tính năng**
- MR phải pass CI (nếu có) trước khi merge
- Cần ít nhất **1 approval** từ reviewer
- Author **không tự approve** MR của mình
- Không merge khi có comment chưa được resolve
- Dùng **Squash merge** nếu branch có quá nhiều commit lộn xộn (vd: "wip", "fix typo")

---

## 6. Xử lý Conflict

```bash
# Sync develop về local
git checkout develop && git pull origin develop

# Rebase feature branch lên develop
git checkout feature/#53-create-hold-seat-api
git rebase develop

# Giải quyết conflict trong từng file, sau đó:
git add <file-đã-resolve>
git rebase --continue

# Push (cần --force-with-lease vì rebase thay đổi history)
git push origin feature/#53-create-hold-seat-api --force-with-lease
```

> Dùng `--force-with-lease` thay vì `--force` để tránh ghi đè commit của người khác.

---

## 7. Những thứ KHÔNG làm

```bash
# ❌ Push thẳng lên develop
git push origin develop

# ❌ Commit trên branch develop
git checkout develop && git commit ...

# ❌ Force push lên develop / main
git push origin develop --force

# ❌ Merge develop vào feature bằng merge commit lặp đi lặp lại
# → Dùng rebase thay thế

# ❌ Để branch sống quá lâu mà không sync với develop
# → Rebase với develop ít nhất mỗi 2 ngày nếu branch chưa xong
```

---

## 8. Tóm tắt nhanh

```
Bắt đầu task:
  git checkout develop && git pull
  git checkout -b feature/#<id>-<description>

Trong quá trình làm:
  git commit -m "feat(scope): description"

Trước khi tạo MR:
  git rebase develop
  git push origin feature/#<id>-<description>

Sau khi merge:
  git branch -d feature/#<id>-<description>
```
