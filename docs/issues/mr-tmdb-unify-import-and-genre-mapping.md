## Overview / Objective

Implements `TMDB-FIX-02` ("Unify TMDB preview and import mapping pipeline") and `TMDB-FIX-03`
("Stop silently dropping unmapped TMDB genres") from `docs/issues/tmdb-ingestion-bug-fix-issue-pack.md`.
Builds on top of `TMDB-FIX-01` (already merged, commit `dd9c715`, "Make TMDB movie details preview
read-only").

Backend only — the frontend's Add-Movie flow does not call `POST /tmdb/import` today (confirmed
dead code per `docs/issues/mr-188-tmdb-details-read-only.md`); wiring it up is `TMDB-FIX-10`, a
separate frontend ticket, not touched here.

Related Issues: `TMDB-FIX-02`, `TMDB-FIX-03`
Depends on: `TMDB-FIX-01`

---

## Changes Introduced

**Controllers / Routes:**
- `TmdbController.importMovie()` now forwards the full `TmdbImportRequest` (not just `tmdbId`) to `TmdbService.importMovie()`.
- New `POST /api/movies/tmdb/genres/sync` (`ADMIN`) → `TmdbService.syncGenres()`. Read-only report comparing TMDB's genre taxonomy against local `Genre.tmdbGenreId` mappings.

**Services / Logic:**
- `TmdbService.getDetails()` (preview) and `TmdbService.importMovie()` (import) now both call the same `fetchAll()` (groups the 4 existing TMDB HTTP calls) and the same `TmdbDraftMapper.toDraft()` — a pure, repository-free normalization step — so they can no longer silently diverge on runtime, cast ordering, translation fallback, or genre extraction.
- `importMovie()` no longer silently defaults missing runtime to `90` minutes: if TMDB provides no runtime and the request has no `confirmedRuntimeMinutes`, it throws `MISSING_RUNTIME` (400) instead of guessing.
- `importMovie()` no longer auto-attaches a hardcoded `2D` screening format: formats are left empty on import (`Movie.formats = []`), and the response always carries a `"SCREENING_FORMAT_NOT_SET"` warning. Format is confirmed later by an admin (e.g. via the existing update-movie endpoint) or at release-version/showtime level.
- Duplicate detection now checks both `tmdbId` (pre-fetch) and `imdbId` (post-fetch), and `movieRepository.save()` is wrapped to catch `DataIntegrityViolationException` — a concurrent double-import now always surfaces as `TMDB_MOVIE_ALREADY_EXISTS` (409), closing the race window between the `existsBy*()` pre-checks and the insert.
- Genre resolution (`resolveGenreMatches()`) now matches primarily by the new `Genre.tmdbGenreId` (stable), falls back to the legacy in-memory `TMDB_GENRE_CODES` map (migration-only) and then case-insensitive name match — and, critically, **never drops an unmatched genre**. Unmapped genres are reported (preview) or must be explicitly resolved (import) via the request's `selectedGenreMappings` / `createPendingGenres` / `ignoredGenres`. Anything left unresolved after that blocks the import with `UNRESOLVED_GENRE_MAPPING` (400) — import never auto-creates an `ACTIVE` genre from external data.
- `MovieService.submitForReview()` now blocks `DRAFT → PENDING_REVIEW` with `GENRE_PENDING_REVIEW` (400) if the movie has any attached genre still `Genre.status = PENDING_REVIEW`.
- Whole `importMovie()` stays `@Transactional`: a failure at any step (company/genre/cast/translation/duplicate) rolls back the entire draft.
- "Không truyền toàn bộ payload TMDB từ browser" constraint was already satisfied structurally (both endpoints take only `tmdbId` + admin decisions and refetch server-side) — no change needed there.

**DTOs / Mappers / Entities:**
- New pure draft classes (`movieservice.dto.tmdb`): `TmdbMovieDraft`, `TmdbCompanyDraft`, `TmdbCastDraft`, `TmdbGenreDraft`, `TranslationDraft`, `TmdbGenreListResponse` (raw `/genre/movie/list` wire shape).
- New `TmdbDraftMapper` (`movieservice.mapper`) — pure function, zero repository access, shared by preview and import.
- New response DTOs: `TmdbGenrePreview` (`tmdbGenreId, name, localGenreId, mappingStatus`), `TmdbGenreSyncResponse` (`mapped, unmapped[]`).
- `TmdbMovieDetailsResponse`: replaced `genreIds: List<Long>` with `genres: List<TmdbGenrePreview>` (same "flat ID → preview object" pattern `TMDB-FIX-01` established for `companies`/`cast` — unmapped genres are now included, not dropped), added `warnings: List<String>`.
- `TmdbImportRequest`: added `confirmedAgeRatingId`, `confirmedRuntimeMinutes`, `selectedGenreMappings: Map<Integer, Long>`, `createPendingGenres: List<Integer>`, `ignoredGenres: Map<Integer, String>` (all optional; `tmdbId` still required).
- `TmdbImportResponse`: added `warnings: List<String>`.
- `Genre` entity: added `tmdbGenreId` (nullable `Integer`, unique) and `status` (`GenreStatus`, `@Builder.Default = ACTIVE`). `GenreRepository.findByTmdbGenreId()` added. `GenreResponse` exposes both new fields.
- New enum `GenreStatus { ACTIVE, PENDING_REVIEW }`.

**Database / JPA / Migration:**
- `docs/database/movie-service/V16__add_tmdb_genre_mapping_to_genre.sql` — adds `genre.tmdb_genre_id` (nullable, unique) and `genre.status` (`NOT NULL DEFAULT 'ACTIVE'`), backfills the 14 seeded genres that have a known TMDB id (mirrors `TmdbService.TMDB_GENRE_CODES`; `biography` has no TMDB equivalent and is left unmapped). Manual `ddl-auto: none` convention — apply by hand like `V13`–`V15`.

**Exception Handling / Error Codes:**
- `MISSING_RUNTIME` (2038, 400), `UNRESOLVED_GENRE_MAPPING` (2039, 400), `GENRE_PENDING_REVIEW` (2040, 400) added to `MovieErrorCode`.

---

## API contract

### `GET /api/movies/tmdb/{tmdbId}/details` (preview, read-only, unchanged endpoint/method)

Response shape change — `genreIds: List<Long>` replaced by `genres`, `warnings` added:

```json
{
  "code": 200,
  "result": {
    "tmdbId": 693134,
    "originalTitle": "Dune: Part Two",
    "durationMinutes": 166,
    "companies": [{ "tmdbId": 923, "name": "Legendary Pictures", "localCompanyId": null }],
    "cast": [{ "tmdbId": 100, "fullName": "Denis Villeneuve", "roleType": "DIRECTOR", "localPersonId": null }],
    "genres": [
      { "tmdbGenreId": 878, "name": "Science Fiction", "localGenreId": 6, "mappingStatus": "MAPPED" },
      { "tmdbGenreId": 99, "name": "Documentary", "localGenreId": null, "mappingStatus": "UNMAPPED" }
    ],
    "ageRatingId": 4,
    "warnings": ["GENRE_UNMAPPED:99"]
  }
}
```
`mappingStatus` ∈ `MAPPED | PENDING_REVIEW | UNMAPPED`.

### `POST /api/movies/tmdb/import`

Request — all fields except `tmdbId` are optional and only needed to resolve what preview flagged:

```json
{
  "tmdbId": 693134,
  "confirmedAgeRatingId": 4,
  "confirmedRuntimeMinutes": null,
  "selectedGenreMappings": { "99": 12 },
  "createPendingGenres": [10770],
  "ignoredGenres": { "37": "not relevant to VN catalog" }
}
```

Response 200:

```json
{
  "code": 200,
  "result": {
    "movieId": 42,
    "tmdbId": 693134,
    "status": "DRAFT",
    "importedCastCount": 16,
    "importedCompanyCount": 1,
    "warnings": ["SCREENING_FORMAT_NOT_SET", "GENRE_IGNORED:37:not relevant to VN catalog"]
  }
}
```

Error responses (all via the standard `ApiResponse` error shape, `code` = `MovieErrorCode`'s numeric code):

| Code | HTTP | When |
|---|---|---|
| `2021` `TMDB_MOVIE_ALREADY_EXISTS` | 409 | `tmdbId` or `imdbId` already imported, including a concurrent-insert race |
| `2038` `MISSING_RUNTIME` | 400 | TMDB has no runtime and `confirmedRuntimeMinutes` wasn't supplied |
| `2039` `UNRESOLVED_GENRE_MAPPING` | 400 | A TMDB genre didn't match locally and wasn't mapped/created-pending/ignored in the request |
| `2016` `AGE_RATING_NOT_FOUND` | 404 | `confirmedAgeRatingId` doesn't exist |
| `2010` `GENRE_NOT_FOUND` | 404 | `selectedGenreMappings` points at a non-existent local genre id |

### `POST /api/movies/tmdb/genres/sync`

```json
{
  "code": 200,
  "result": {
    "mapped": 14,
    "unmapped": [
      { "tmdbGenreId": 99, "name": "Documentary", "status": "PENDING_REVIEW" },
      { "tmdbGenreId": 10402, "name": "Music", "status": "PENDING_REVIEW" }
    ]
  }
}
```
Read-only report — never writes, safe to call repeatedly.

### `POST /api/movies/{id}/submit` (existing endpoint, new failure mode)

Now also returns `2040 GENRE_PENDING_REVIEW` (400) if the movie has an attached genre whose
`status` is still `PENDING_REVIEW` (i.e. it was auto-created from an unmapped TMDB genre during
import and hasn't been promoted to `ACTIVE` by a genre admin yet).

---

## Key Architectural Decisions

- **The "pure mapper" only produces `TmdbMovieDraft` — genre/company/person matching against the local database is not part of it.** `TmdbDraftMapper.toDraft()` never touches a repository; it turns raw TMDB payloads into `TmdbCompanyDraft`/`TmdbCastDraft`/`TmdbGenreDraft`/`TranslationDraft` and a `RUNTIME_MISSING` warning when applicable. Matching those drafts against `Genre`/`ProductionCompany`/`Person` inherently needs repository access, so it lives in `TmdbService` (`resolveGenreMatches()`, `previewCompany()`/`upsertCompany()`, etc.) but is still the *same* method called by both `getDetails()` and `importMovie()` — satisfying "preview và import command dùng cùng mapper và cùng validation/warning rules" without conflating "pure" with "shared."
- **Genre.status = PENDING_REVIEW, not a separate mapping table.** Per the ticket's own note ("với scope nhỏ có thể thêm tmdbGenreId vào Genre"), a `PENDING_REVIEW` genre is a real, queryable `Genre` row from the moment it's created — no separate approval workflow/entity was introduced. Promoting a `PENDING_REVIEW` genre to `ACTIVE` (a genre-admin action) is not requested by either ticket and is a natural, small follow-up on `GenreService`/`GenreController`.
- **Unresolved genre blocks the whole import, not a partial success.** Rather than silently dropping (the original bug) or silently creating an `ACTIVE` genre (a different, worse bug), an unresolved TMDB genre throws `UNRESOLVED_GENRE_MAPPING` and nothing is persisted (the check runs before any upsert/save). The admin must explicitly map, create-pending, or ignore-with-reason every unmapped genre.
- **Missing runtime blocks import instead of silently defaulting.** `Movie.durationMinutes` is `NOT NULL` in the schema, so there's no way to "just warn and continue" without writing a wrong value — the ticket's "block submit per policy" option was chosen over "warn and default."
- **Company/person upsert behavior is otherwise unchanged.** `Movie` still only associates one `ProductionCompany` (`companies.get(0)`) — this is the pre-existing limitation tracked separately under `Update #151` (multi-company support), not part of either ticket implemented here.

---

## How to Test

1. `mvnw.cmd -pl movie-service -am test` — full existing suite plus new tests pass (`60 tests, 0 failures` at time of writing, including `BulkShowTimeConcurrencyIntegrationTest`'s Testcontainers integration test).
2. `TmdbDraftMapperTest` — pure unit tests, no mocks: runtime-missing warning, zero-runtime treated as missing, EN translation fallback to `originalTitle`/`overview`, VI translation only when TMDB provides it, director+top-15-actor cast ordering by TMDB `order`, raw genre id/name extraction.
3. `TmdbServiceTest` — preview read-only tests (issue #188, unchanged), preview reports `UNMAPPED` genre instead of dropping it, import blocks on missing runtime / succeeds with override, import creates `DRAFT` with no formats + `SCREENING_FORMAT_NOT_SET` warning, import blocks on unresolved genre / succeeds via `selectedGenreMappings` / succeeds via `createPendingGenres` (asserts `PENDING_REVIEW` + `tmdbGenreId` + `genreCode="TMDB_<id>"` on the created genre) / succeeds via `ignoredGenres`, duplicate `tmdbId` and duplicate `imdbId` both → `TMDB_MOVIE_ALREADY_EXISTS`, concurrent unique-constraint violation on save mapped to the same error.
4. `MovieServiceTest` — `submitForReview()` throws `GENRE_PENDING_REVIEW` when the movie has a `PENDING_REVIEW` genre attached, succeeds when all attached genres are `ACTIVE`.
5. Manual: apply `V16__add_tmdb_genre_mapping_to_genre.sql` against a database seeded from `data.sql`, then `SELECT genre_code, tmdb_genre_id, status FROM genre;` to confirm the 14 backfilled rows and that `biography` is left `tmdb_genre_id = NULL, status = 'ACTIVE'`.

---

## Checklist

**General**
- [x] Follows project coding conventions
- [x] No debug / console.log code left
- [x] Code compiles (`mvnw.cmd -pl movie-service -am compile`) and full test suite passes (`mvnw.cmd -pl movie-service -am test`, 60/60)

**Backend**
- [x] No N+1 query issues beyond what already existed (`resolveGenreMatches()` still does one `findAll()` for the name-fallback map, matching the prior `resolveGenres()`)
- [ ] Endpoints tested via Postman / API client — not run against a live TMDB key in this session; reviewer should smoke-test `POST /tmdb/import` and `POST /tmdb/genres/sync` against a real key before merge
- [ ] Postman collection / `API_CONTRACT.md` (if any) updated to match the response shapes documented above

**Frontend**
- Not touched — `TMDB-FIX-10` (separate ticket) covers wiring the Add-Movie modal to this pipeline and surfacing warnings/mapping decisions in the UI.

---

## Reviewer Notes

- **Breaking change:** `GET /tmdb/{id}/details` response drops `genreIds: List<Long>` in favor of `genres: List<TmdbGenrePreview>`. Per `mr-188`'s own grep, `MovieModal.tsx` is the only frontend consumer of this endpoint and it does not currently read `genreIds` (genres are handled through the manual create/update form's `genreIds` field, not this preview) — but re-verify before merge in case that's changed since.
- `POST /api/movies/tmdb/import` remains **unwired** from the frontend (confirmed dead code per `mr-188`); this MR makes it correct and safe to call, not reachable from the UI. Wiring it is `TMDB-FIX-10`.
- The legacy `TMDB_GENRE_CODES` hardcoded map is kept intentionally as a fallback (tagged migration-only in code comments) — it's what currently maps ~14 of the 19 core TMDB genres for existing rows created before this MR; new imports going forward always populate `Genre.tmdbGenreId` directly via `createPendingReviewGenre()`/`selectedGenreMappings`, making the hardcoded map obsolete over time without needing a hard cutover.
- No endpoint yet promotes a `PENDING_REVIEW` genre to `ACTIVE` — until one exists, any movie that pulled in an auto-created pending genre stays blocked at `submitForReview()`. This is intentional (matches "block submit until processed") but worth flagging to product/ops before this ships, so a genre reviewer has somewhere to go.
