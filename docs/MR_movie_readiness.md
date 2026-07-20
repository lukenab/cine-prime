## Overview / Objective

MR này implement tính nang Readiness Summary và Inline Validation cho màn hình Movie Editor, giúp Admin có th? nhìn th?y tr?c quan các tru?ng còn thi?u (ho?c vi ph?m business rules) tru?c khi Submit for Review.
Lu?ng ho?t d?ng dã du?c tách b?ch:
1. Client-side Structural Validation: Ch? check ki?u d? li?u co b?n d? hi?n Inline Errors khi Save Draft.
2. Backend Readiness Rules Validation: B?t và mapping l?i t? API tr? v? (HTTP 400 violations) và hi?n th? tr?c quan vào dúng tru?ng và section tuong ?ng.

Related Issue: Closes #152

---

## Changes Introduced

**DTOs / Mappers / Components:**
- C?p nh?t \movieApi.ts\: B? sung type \ReadinessViolation\
- C?p nh?t \MovieEditorPage.tsx\:
  - Thêm state \alidationErrors\ và \ackendViolations\
  - Render component \InlineError\ du?i các tru?ng tuong ?ng
  - Render \ReadinessSummary\ báo l?i t?ng quan tru?c khi Submit for Review
  - Catch exception 400 khi \submitForReview\ và map l?i v? state.
- C?p nh?t \MovieEditorWorkflow.tsx\: B? sung indicator ch?m than màu d? (\hasError\) cho các tab có l?i vi ph?m.
- Kh?i t?o \MovieEditorPage.validation.test.tsx\ cho ph?n logic validation

**Exception Handling / Error Codes:**
- B?t l?i HTTP 400 v?i format \iolations\ custom tr? v? t? backend thay cho thông báo l?i c?c b?.

---

## Key Architectural Decisions

- **Tách bi?t Validation logic**: Client-side (nhanh, b?t ngay c?u trúc co b?n khi save draft) và Server-side (Readiness blocker rules - ví d? b?t bu?c có Poster, Synopsis khi Approval) d? dáp ?ng dúng yêu c?u Save Draft không b? ch?n b?i backend blockers.

---

## How to Test

1. Truy c?p màn hình Movie Editor.
2. Ði?n th? 1 Draft thi?u tru?ng Original Title. ?n Save Draft -> B? ch?n và có báo l?i inline màu d?.
3. Ði?n Original Title, ch?n th? lo?i, format. ?n Save Draft -> Thành công.
4. ?n Submit for Review (c? tình d? tr?ng poster).
5. Hi?n th? thông báo Toast. Review section hi?n th? b?ng summary các Blockers. Tab Navigation hi?n bi?u tu?ng Warning d?.
6. Fix th? 1 l?i (t?i poster), ?n l?i Submit for Review -> Blocker poster bi?n m?t.

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Frontend (if applicable)**
- [x] Loading and error states handled
- [x] axiosClient attaches Bearer token correctly
- [x] Tested on both dark and light mode

