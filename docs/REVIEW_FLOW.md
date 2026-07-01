# Code Review Flow — Lấy nhánh của thành viên về review

> **Nguyên tắc vàng:** Dùng `git switch <branch>` để **LẤY** nhánh về xem.
> **KHÔNG** dùng `git pull origin <branch>` — `pull` = `fetch` + **merge vào nhánh hiện tại** → gây conflict.

---

## TL;DR

```bash
git fetch origin --prune
git switch "<tên-nhánh-của-member>"
git diff develop...HEAD          # xem thay đổi
# build/run để test
git switch develop               # xong thì quay về
```

---

## Quy tắc

| ✅ Nên | ❌ Tránh |
|--------|---------|
| `git switch <branch>` để lấy nhánh | `git pull origin <branch>` khi đang ở nhánh khác (merge chéo → conflict) |
| `git fetch` trước khi xem | `git checkout -b <new>` rồi `pull` nhánh khác (sai gốc + merge) |
| Bọc `"..."` cho tên nhánh có `#` | Quên ngoặc kép trong PowerShell (`#` = comment) |
| Working tree sạch trước khi đổi nhánh | Mang thay đổi đang dở lẫn sang nhánh review |

---

## Các bước chi tiết

### B1 — Dọn sạch việc đang làm
Tránh mang thay đổi lẫn sang nhánh review.
```bash
git status            # phải sạch
# nếu còn dở:
git stash             # cất tạm  (hoặc commit lại)
```

### B2 — Fetch nhánh mới nhất
```bash
git fetch origin --prune
```

### B3 — Chuyển sang nhánh của member
Tự tạo nhánh local bám theo `origin`, **không merge**.
```bash
git switch "features/Implementation_#85-movie-service-seed-data"
```
- Tên nhánh có `#` → **bọc ngoặc kép** (PowerShell hiểu `#` là comment).
- Nếu đã có nhánh local cũ bị lệch, ép trùng server:
  ```bash
  git switch -C "<branch>" "origin/<branch>"
  ```

### B4 — Xem code + chạy thử
```bash
git log --oneline develop..HEAD     # các commit thuộc MR
git diff develop...HEAD              # toàn bộ thay đổi so với develop
git diff --stat develop...HEAD      # danh sách file thay đổi
```
Rồi build/run theo service để test thực tế:
```bash
# Frontend
cd client && npm install && npm run dev
# Backend (một service)
cd server && ./mvnw -pl <service> spring-boot:run
```

### B5 — Xong review → quay về
```bash
git switch develop
git stash pop         # nếu B1 có stash
```

---

## Cách khác — review KHÔNG đổi nhánh (an toàn nhất)

Chỉ đọc diff, không đụng working tree — hợp khi chỉ cần đọc/nhận xét, không cần build.
```bash
git fetch origin
git diff develop...origin/<branch>                 # toàn bộ diff
git show origin/<branch>:đường/dẫn/tới/file.java    # xem 1 file cụ thể
git log --oneline develop..origin/<branch>          # commit của MR
```

---

## Cập nhật nhánh member khi nó sau develop

Chỉ `pull` khi bạn **đang đứng đúng nhánh đó** (fast-forward, hợp lệ):
```bash
git switch "<branch>"
git pull
```

---

## Xử lý sự cố

### Lỡ kẹt merge conflict khi review
```bash
git merge --abort     # thoát merge dở
# rồi làm lại đúng bằng git switch
```

### `error: Pulling is not possible because you have unmerged files`
Đang kẹt giữa merge. Chạy `git merge --abort` rồi dùng `git switch` thay vì `pull`.

### `git checkout -b` xong lại pull → tạo nhánh sai gốc
```bash
git switch develop
git branch -D <nhánh-tạo-nhầm>
git fetch origin
git switch "<branch-that>"
```

---

## Checklist khi review một MR

- [ ] Working tree sạch trước khi `switch`.
- [ ] Đúng nhánh (`git branch --show-current`).
- [ ] Đọc diff so với `develop` (`git diff develop...HEAD`).
- [ ] MR chỉ chứa file **đúng phạm vi issue** (không lẫn file service/màn hình khác).
- [ ] Không còn conflict marker (`<<<<<<<`, `=======`, `>>>>>>>`, `Updated upstream`, `Stashed changes`).
- [ ] Không còn `console.log` / `System.out.println` / debug code.
- [ ] Build pass (`npm run build` / `mvn test`).
- [ ] Đối chiếu từng dòng **Acceptance Criteria (AC)** của issue.
- [ ] Quay về `develop` sau khi xong.
