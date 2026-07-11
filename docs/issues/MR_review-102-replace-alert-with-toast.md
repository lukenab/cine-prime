## Review — Request Changes

Cảm ơn bạn đã implement `Toast.tsx` và pattern `useToast()` rất clean, không dùng thư viện ngoài, dark/light mode đều ổn. Tuy nhiên MR chưa đáp ứng được **AC1** nên cần sửa trước khi merge.

---

### AC1 chưa đạt — Còn `alert()` ở 4 file ngoài scope ban đầu

Chạy lệnh kiểm tra:

```bash
grep -rn "alert(" client/src
```

Kết quả vẫn còn **8 lời gọi `alert()`** ở các file sau:

| File | Số chỗ còn `alert()` |
|---|---|
| `ManageAgeRatingsPage.tsx` | 2 |
| `ManageFormatsPage.tsx` | 2 |
| `ManageCompaniesPage.tsx` | 2 |
| `ManagePersonsPage.tsx` | 2 |

Những file này không có trong danh sách "Known locations" của issue gốc, nhưng AC1 yêu cầu toàn bộ `client/src` phải sạch, không giới hạn theo danh sách. Xem lại issue đã được cập nhật tại `docs/issues/issue-102-replace-alert-with-toast.md` để thấy danh sách đầy đủ 9 file cần xử lý.

---

### Những gì đã tốt, không cần sửa

- `Toast.tsx` — component và hook clean, đúng pattern
- 5 file đã sửa đúng 3 bước: import, gọi hook, render `{toastElement}`
- Backend message được giữ nguyên (`err?.response?.data?.message`)
- Không đụng logic nghiệp vụ, không outscope

---

### Việc cần làm trước khi re-request review

Áp dụng đúng pattern đã có cho 4 file còn lại:

1. Import `useToast` từ `../../components/shared/Toast`
2. Gọi `const { showToast, toastElement } = useToast();` trong component
3. Thêm `{toastElement}` ở đầu JSX return
4. Thay mỗi `alert(...)` bằng `showToast("error", ...)`

Sau khi sửa, chạy lại `grep -rn "alert(" client/src` để tự verify trước khi push.
