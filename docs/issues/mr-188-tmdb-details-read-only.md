## Overview / Objective

Chuyen `GET /api/movies/tmdb/{tmdbId}/details` thanh preview thuan doc - khong con goi `upsertCompany()`/`upsertPerson()` (tuc la khong con tu tao `ProductionCompany`/`Person` trong DB chi vi admin mo modal xem truoc). Company/Person con thieu van duoc tao that su nhu cu, nhung CHI xay ra luc admin xac nhan Save (create/update movie) o frontend - dung tinh than "khong ghi DB truoc khi command duoc xac nhan" cua issue.

Related Issue: Closes #188
Depends on: khong co

---

## Changes Introduced

**Controllers / Routes:**
- Khong doi signature. `TmdbController.getDetails()` giu nguyen `GET /api/movies/tmdb/{tmdbId}/details`, chi response DTO shape ben trong thay doi (xem "Key Architectural Decisions").

**Services / Logic:**
- `TmdbService.getDetails()`: bo han `@Transactional`, khong con goi `upsertCompany()`/`upsertPerson()` nua. Company duoc "tim thu" qua `previewCompany()` moi (read-only, match theo ten - cung logic voi `upsertCompany()` nhung KHONG `save()`). Cast duoc "tim thu" qua `previewCastMember()` moi (read-only, match theo `tmdbId` qua `personRepository.findByTmdbId()`).
- `resolveGenres()`/`resolveAgeRating()` giu nguyen - 2 ham nay von da read-only tu truoc, khong phai nguon gay bug.
- `importMovie()` (`POST /tmdb/import`) giu nguyen hoan toan - van dung `upsertCompany()`/`upsertPerson()` cu, vi day la command tao that su, dung cho, khong phai preview.

**DTOs / Mappers / Components:**
- Backend - 2 DTO moi: `TmdbCompanyPreview` (tmdbId, name, country, logoUrl, localCompanyId - null neu chua tung import) va `TmdbCastPreview` (tmdbId, fullName, photoUrl, roleType, characterName, billingOrder, localPersonId - null neu chua tung import).
- Backend - `TmdbMovieDetailsResponse`: bo `companyId`/`companyName` (so it, bat buoc local ID co san), doi `cast: List<CastResponse>` (yeu cau `personId` khong null) sang `List<TmdbCastPreview>`. Them field `companies: List<TmdbCompanyPreview>`. `genreIds`/`ageRatingId` giu nguyen (2 helper resolve nay von read-only).
- Frontend - `movieApi.ts`: them type `TmdbCompanyPreview`/`TmdbCastPreview`, cap nhat `TmdbMovieDetails` theo shape moi cua backend.
- Frontend - `MovieModal.tsx`:
  - `CastRow.personId` doi tu `number` sang `number | null` + them `tmdbPersonId?: number` (giu provenance de tao Person moi neu can).
  - Them state `pendingCompany` - giu tam thong tin company tu TMDB neu chua tung import (localCompanyId null).
  - Them 2 ham moi `resolveCompanyId()`/`resolveCastPersonIds()` - goi `movieApi.createCompany()`/`movieApi.createPerson()` (2 endpoint CRUD da co san, chi la chua tung duoc modal nay dung toi) de tao that su cac entity con thieu, CHI luc `handleSubmit()` chay (tuc la luc admin bam Save).
  - `buildPayload()` doi sang nhan `resolvedCompanyId`/`resolvedCast` lam tham so bat buoc thay vi doc thang tu `form.companyId`/`form.cast` - buoc goi phai di qua 2 ham resolve o tren truoc.
  - `applyTmdb()`: cap nhat theo response shape moi (`details.companies[0]`, `details.cast[].localPersonId`), khong con gan `personId`/`companyId` truc tiep tu preview nua.

**Database / JPA / Migration:** Khong co.

**Exception Handling / Error Codes:** Khong co thay doi.

---

## Key Architectural Decisions

- **Tai sao tao Company/Person luc Save thay vi qua mot command "confirm import" rieng:** frontend hien tai KHONG co flow "confirm import" nao ca - `movieApi.tmdbImport()` (goi `POST /tmdb/import`) ton tai trong code nhung chua he duoc UI nao dung toi (da grep toan bo `client/src`, xac nhan 0 usage). Moi thu di qua 1 form editable roi submit thang vao `createMovieV2`/`updateMovieV2`. Giai phap toi thieu, dung nguyen tac "chi ghi khi command duoc xac nhan", la tai su dung 2 endpoint CRUD da co san (`POST /api/companies`, `POST /api/persons`) va goi chung ngay truoc khi build payload trong `handleSubmit()`, thay vi lam lai toan bo pipeline.
- **Vi sao khong refactor thanh 1 pipeline hop nhat (TMDB-FIX-02):** nam ngoai scope #188, va la thay doi lon hon nhieu (hop nhat preview + import + create thanh 1 command duy nhat, dung 1 mapper thuan). Viec nay de danh cho `TMDB-FIX-02` (da co san trong `docs/issues/tmdb-ingestion-bug-fix-issue-pack.md`).
- **Ghi lai ID that vao form state ngay sau khi resolve:** trong `handleSubmit()`, sau khi `resolveCompanyId()`/`resolveCastPersonIds()` chay xong, ket qua duoc `setForm()` lai vao state truoc khi build payload - tranh tao trung Company/Person neu admin bam Save nhieu lan (vi du lan dau loi mang, thu lai lan 2 trong cung phien mo modal).
- **Company van match theo ten (khong doi tu upsertCompany() cu):** `previewCompany()` dung lai dung logic match-theo-ten cua `upsertCompany()` de dam bao 2 ham nay luon dong bo cach "coi la cung 1 company". Gioi han da biet: neu 2 company khac nhau trung ten (hoac 1 company doi ten tren TMDB), match theo ten co the sai - day la gioi han co san tu truoc (khong phai do MR nay gay ra), du kien duoc giai quyet o `TMDB-FIX-02`/update `#151` (them `tmdbCompanyId` on dinh lam identity chinh thay vi ten).

---

## How to Test

1. Backend: `mvn -pl movie-service -am test -Dtest=TmdbServiceTest,MovieServiceTest,MovieMapperTest` — **luu y:** moi truong viet MR nay khong chay duoc Maven that (sandbox chan Maven Central), nen chi verify duoc bang tay (byte-clean, brace/paren can bang) - reviewer can tu chay lai truoc khi merge.
2. Frontend: `cd client && npx tsc --noEmit` — **da chay that** trong luc viet MR nay, xac nhan **0 loi type** o ca `movieApi.ts` va `MovieModal.tsx` (baseline truoc khi sua cung dang sach o rieng 2 file nay; cac loi TS con lai trong project la loi co san khong lien quan, vi du thieu package `@radix-ui/*`).
3. Manual API — verify preview khong ghi DB: mo Postman/pgAdmin, ghi lai `SELECT count(*) FROM production_company` va `SELECT count(*) FROM person`. Goi `GET /api/movies/tmdb/{tmdbId}/details` voi 1 tmdbId co company/cast **MOI** (chua tung import) vai lan lien tiep. Query lai count — phai giu nguyen, khong tang.
4. Manual API — xac nhan response shape moi: phai co `companies: [{ tmdbId, name, country, logoUrl, localCompanyId }]` va `cast: [{ tmdbId, fullName, photoUrl, roleType, characterName, billingOrder, localPersonId }]` — khong con `companyId`/`companyName` o cap top-level nua.
5. Frontend end-to-end: dang nhap admin → Movies → Add Movie → tab Browse & Import → chon 1 phim **chua tung import**, co company/actor DB local chac chan chua co → xac nhan modal auto-fill day du company + cast dung nhu truoc (UX khong doi, khong thay khac biet gi tren man hinh) → bam Save → xac nhan movie tao thanh cong.
6. Query lai `production_company`/`person` **SAU** buoc 5 — bay gio PHAI tang dung bang so company/cast moi (vi da Save, khong phai vi da preview o buoc 4).
7. Test double-submit: sau buoc 5 (modal van dang mo o Gallery tab), sua them 1 field khac (vd trailer URL) roi Save lan 2 — xac nhan KHONG co company/person trung lap duoc tao them (count phai khong doi o buoc nay).
8. Test cast/company da ton tai san: chon 1 phim ma company/actor da co san trong DB (import truoc do roi) — xac nhan preview tra dung `localCompanyId`/`localPersonId` (khac null), va Save khong tao them entity trung.

---

## Checklist

**General**
- [x] Follows project coding conventions
- [x] No debug / console.log code left
- [ ] Code compiles, no errors — Backend: chua chay `mvn test` that (Maven Central bi chan trong sandbox nay). Frontend: **da** chay `npx tsc --noEmit` that, 0 loi o 2 file lien quan.

**Backend**
- [x] No N+1 query issues — `previewCompany()`/`previewCastMember()` moi cai 1 query, khong tang so luong query so voi `upsertCompany()`/`upsertPerson()` cu.
- [ ] Endpoints tested via Postman / API client — chua tu test that (khong co TMDB network + Postgres that trong sandbox nay), reviewer can tu test theo buoc 3/4 o tren.
- [ ] API contract / Postman collection updated — **chua** cap nhat `API_CONTRACT.md`/Postman samples de phan anh response shape moi (`companies[]`/`cast[].localPersonId`).

**Frontend**
- [x] Loading and error states handled — khong doi, giu nguyen logic cu.
- [x] axiosClient attaches Bearer token correctly — khong doi, khong dung cho MR nay.
- [x] Tested on both dark and light mode — khong doi UI/style, khong can test lai.

---

## Reviewer Notes

- **Breaking change quan trong nhat:** response shape cua `GET /tmdb/{id}/details` doi hoan toan — bo `companyId`/`companyName` (so it) va `cast[].personId` (bat buoc non-null), thay bang `companies[]`/`cast[].localPersonId` (co the null). Da grep toan bo `client/src`, xac nhan **chi co `MovieModal.tsx` dung endpoint nay** — khong co consumer nao khac can cap nhat theo.
- `POST /api/movies/tmdb/import` (`importMovie()`) van ton tai va khong doi, nhung frontend hien **khong goi no o dau ca** (da verify bang grep, `movieApi.tmdbImport()` la dead code tu goc nhin frontend). Neu tuong lai co ai wire lai ham nay, can xem lai co bi double-create company/person hay khong, vi `importMovie()` tu upsert rieng, doc lap voi `resolveCompanyId()`/`resolveCastPersonIds()` moi them o `MovieModal.tsx`.
- Da phat hien lai `.git/index.lock` ton tai trong repo (0 byte) tai thoi diem viet MR nay — **cung canh bao nhu MR #140:** kiem tra khong co tien trinh git nao khac dang chay truoc khi commit/merge.
- **Phat hien phu, ngoai pham vi MR nay:** file `docs/issues/mr-140-movie-listing-sections.md` (duoc ghi nhan la da tao trong phien lam viec truoc) hien khong con ton tai trong repo (`find` khong thay). Khong co dau hieu git reset/checkout dang chay (khong co git process nao dang hoat dong), va toan bo code fix cua issue #143 va #188 trong phien lam viec nay van con nguyen ven - nen nhieu kha nang file MR-140 do don gian la chua tung duoc ghi thanh cong vao dung duong dan repo tu truoc. Ban nen tu kiem tra lai, minh co the viet lai file do neu can.
- Chua viet test cho edge case "2 company khac nhau trung ten nhung khac `tmdbId` that" (gioi han cua viec match-theo-ten thay vi match-theo-tmdbId) — day la gioi han da biet truoc do, thuoc pham vi `TMDB-FIX-02`/update `#151` (them `tmdbCompanyId` on dinh), khong phai bug moi do MR nay gay ra.
