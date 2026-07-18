## Overview / Objective

Implements `[Backend] Import selected TMDB posters/backdrops/stills` (`TMDB-FIX-05`): lets an
admin pick specific TMDB images to attach to a movie instead of the previous behavior, where
`thumbnailUrl` was silently populated with a copy of `posterUrl` and no poster/backdrop/still
selection existed at all. Adds a ranked media-preview payload to the existing TMDB details
endpoint, a new selective import endpoint, per-image TMDB provenance columns, and a dedicated
Create/Edit Movie page (`MovieEditorPage`) with a media picker, replacing the old
`MovieModal`.

Related Issue: Closes `[Backend] Import selected TMDB posters backdrops and stills`
Depends on: none (builds on the existing `TmdbService`/`TmdbController` pipeline from
`mr-tmdb-unify-import-and-genre-mapping.md`)

---

## Changes Introduced

**Controllers / Routes:**
- `MovieImageController` — rewritten to delegate entirely to the new `MovieImageService`. Added `@PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")` to every endpoint (previously the controller had **no** method-level authorization at all — closed as a side effect of this MR, not the original ask).
- New `POST /api/movies/{movieId}/images/tmdb-import` — selective import of TMDB-selected posters/backdrops/stills.
- `GET /api/movies/tmdb/{tmdbId}/details` (existing endpoint) — response gains `thumbnailUrl` and `media` (ranked candidate lists), no method/route change.

**Services / Logic:**
- New `MovieImageService`, extracted from the controller: `getImages`, `addImage` (manual uploads, tagged `source="MANUAL"`), `deleteImage`, and `importFromTmdb` (the new selective-import flow, `@Transactional`).
- `TmdbService` gains: `fetchImages(tmdbId)` (raw `/movie/{id}/images` call), `getImageConfig()` (cached `/configuration` call — dynamic base URL/size profiles instead of a hardcoded `w500`, with an in-code fallback if TMDB's config call itself fails), and `buildMediaPreview(...)` — the ranking/selection algorithm shared by preview and import:
  - Dedupes candidates by `filePath` (TMDB's own `/images` response can repeat an asset).
  - Filters by aspect-ratio band per category (poster `0.5–0.8`, backdrop `1.5–2.0`) to exclude mistagged images.
  - Ranks by language priority (`vi` > `en` > textless) → `vote_average` desc → resolution desc, and marks the top candidate per category `recommended`.
  - Stills are capped at a configurable maximum (`tmdb.image.max-stills`, default 10) and exclude whichever backdrop was already recommended.
- New private `resolvePosterMedia(tmdbId, fallbackPosterUrl)` in `TmdbService`, now called by **both** `getDetails()` (preview) and `importMovie()` (create-from-TMDB) so poster/thumbnail resolution can no longer diverge between the two paths. Fixes a latent bug: `importMovie()` previously never set `Movie.thumbnailUrl` at all during TMDB import.
- `importFromTmdb()`: enforces per-type limits (max 1 poster, max 1 backdrop, max `getMaxStills()` stills — else `MOVIE_IMAGE_TYPE_LIMIT_EXCEEDED`), re-fetches TMDB's current `/images` response to confirm each selected `filePath` still exists (else `TMDB_IMAGE_NOT_FOUND`) and to capture width/height/aspect ratio/language for storage (the request itself only carries `filePath` + `imageType`, not full metadata), skips selections already imported (checked via `findExistingSourcePathKeys`, counted and reported as a warning rather than erroring), and catches `DataIntegrityViolationException` on save → `TMDB_IMAGE_ALREADY_IMPORTED` (closes the race window between the existence check and the insert for two concurrent imports of the same asset).

**DTOs / Mappers / Components:**
- New (`movieservice.dto.tmdb`): `TmdbImagesResponse` (raw `/movie/{id}/images` wire shape: `posters`/`backdrops`/`logos`), `TmdbConfigurationResponse` (raw `/configuration` wire shape).
- New (`movieservice.dto.response`): `MovieMediaCandidateResponse` (`filePath, url, width, height, aspectRatio, languageCode, voteAverage, recommended`), `MovieMediaPreviewResponse` (`recommendedPosterPath, recommendedBackdropPath, posters, backdrops, stills`).
- New (`movieservice.dto.request`): `TmdbImageImportRequest` (`tmdbId`, `selections: [{filePath, imageType, languageCode, displayOrder}]` — `selections` is `@NotEmpty`, there is no implicit "import everything" default).
- New (`movieservice.dto.response`): `TmdbImageImportResponse` (`importedCount, skippedDuplicateCount, images, warnings`).
- `TmdbMovieDetailsResponse` — added `thumbnailUrl`, `media: MovieMediaPreviewResponse`.
- `MovieImageResponse` — added `source, externalPath, languageCode, width, height, aspectRatio, isDefault` (MapStruct auto-maps these by field name against the entity, no explicit `@Mapping` needed).
- **Frontend:** new `TmdbMediaPicker.tsx` (`client/src/layouts/`) — single-select poster/backdrop, multi-select stills capped at `maxStills`, pre-seeds selection from the recommended candidates, imports immediately if `movieId` is already known or hands selections back to the parent via `onPendingSelectionChange` when composing a brand-new movie (import then happens right after creation).
- **Frontend:** new dedicated `MovieEditorPage.tsx` (`client/src/pages/admin/`) replacing the old `MovieModal.tsx` (deleted, confirmed unused). Two-column layout — form sections stacked and scrollable on the left, poster preview + TMDB import panel + `TmdbMediaPicker` + photo gallery docked (`lg:sticky`) on the right — chosen by the user over a side-drawer alternative for a Create/Edit Movie flow that was previously cramped inside a modal.
- `client/src/routes/AppRoutes.tsx` — added `movies/new` and `movies/:movieId/edit` routes for `MovieEditorPage` (mirrors the existing `CinemaRoomEditorPage` new/edit pattern); `ManageMoviePage.tsx` now navigates to those routes instead of opening a modal.

**Database / JPA / Migration:**
- `V3__add_movie_image_and_tmdb_provenance.sql` — adds `source`, `external_path`, `language_code`, `width`, `height`, `aspect_ratio`, `is_default` (`NOT NULL DEFAULT false`) to `movie_image`; adds a partial unique index `uq_movie_image_source_path` on `(movie_id, source, external_path)` (only when both are non-null) so re-importing the same TMDB asset is rejected at the DB level, not just app-level; adds a `chk_image_type` CHECK constraint.
- `MovieImage` entity — added matching fields; `isDefault` uses `@Builder.Default` **and** `@org.hibernate.annotations.ColumnDefault("false")` — the Lombok default alone is invisible to Hibernate's DDL generator and was breaking a `ddl-auto=create-drop` integration test that inserts via raw native SQL without setting the column explicitly.
- `MovieImageRepository` — added `findExistingSourcePathKeys(movieId): Set<String>` (JPQL `CONCAT(source, ':', externalPath)`), the app-level half of the dedup check.

**Exception Handling / Error Codes:**
| Code | HTTP | Meaning |
|---|---|---|
| `2084` `TMDB_IMAGE_NOT_FOUND` | 400 | A selected `filePath` is no longer offered by TMDB's current `/images` response for this title |
| `2085` `TMDB_IMAGE_ALREADY_IMPORTED` | 409 | Concurrent-import race caught at the unique-index level |
| `2086` `MOVIE_IMAGE_TYPE_LIMIT_EXCEEDED` | 400 | More than 1 poster, more than 1 backdrop, or more stills than `tmdb.image.max-stills` in one request |
| `2087` `MOVIE_IMAGE_NOT_FOUND` | 404 | `deleteImage` target doesn't exist or belongs to a different movie |

---

## API contract

### `GET /api/movies/tmdb/{tmdbId}/details` (existing endpoint, additive response fields)

```json
{
  "code": 200,
  "result": {
    "tmdbId": 1368337,
    "posterUrl": "https://image.tmdb.org/t/p/w500/abc.jpg",
    "thumbnailUrl": "https://image.tmdb.org/t/p/w185/abc.jpg",
    "media": {
      "recommendedPosterPath": "/abc.jpg",
      "recommendedBackdropPath": "/def.jpg",
      "posters": [
        { "filePath": "/abc.jpg", "url": "https://image.tmdb.org/t/p/w500/abc.jpg", "width": 2000, "height": 3000, "aspectRatio": 0.667, "languageCode": "en", "voteAverage": 8.1, "recommended": true }
      ],
      "backdrops": [ { "filePath": "/def.jpg", "url": "...", "aspectRatio": 1.78, "recommended": true } ],
      "stills": [ { "filePath": "/ghi.jpg", "url": "...", "aspectRatio": 1.78, "recommended": false } ]
    },
    "warnings": []
  }
}
```

### `POST /api/movies/{movieId}/images/tmdb-import`

Request:
```json
{
  "tmdbId": 1368337,
  "selections": [
    { "filePath": "/abc.jpg", "imageType": "POSTER", "languageCode": "en", "displayOrder": 1 },
    { "filePath": "/def.jpg", "imageType": "BACKDROP", "displayOrder": 2 },
    { "filePath": "/ghi.jpg", "imageType": "STILL", "displayOrder": 3 }
  ]
}
```

Response 200:
```json
{
  "code": 200,
  "result": {
    "importedCount": 3,
    "skippedDuplicateCount": 0,
    "images": [ { "imageId": 101, "imageType": "POSTER", "source": "TMDB", "externalPath": "/abc.jpg", "languageCode": "en", "width": 2000, "height": 3000, "isDefault": true } ],
    "warnings": []
  }
}
```

Error responses (standard `ApiResponse` error shape):

| Code | HTTP | When |
|---|---|---|
| `2084` `TMDB_IMAGE_NOT_FOUND` | 400 | Selected `filePath` no longer exists on TMDB |
| `2085` `TMDB_IMAGE_ALREADY_IMPORTED` | 409 | Concurrent duplicate import |
| `2086` `MOVIE_IMAGE_TYPE_LIMIT_EXCEEDED` | 400 | Too many posters/backdrops/stills in one request |
| `2003` `MOVIE_NOT_FOUND` | 404 | `movieId` doesn't exist |

### `DELETE /api/movies/{movieId}/images/{imageId}` (existing route, now returns `2087` on miss)

Auth: all three endpoints above require `ROLE_ADMIN` or `ROLE_EMPLOYEE` (newly enforced — previously ungated).

---

## Key Architectural Decisions

- **Scope cut, disclosed:** the original issue pack lists `TMDB-FIX-06` (movie-level metadata provenance/resync) as a dependency, but this MR only implements **per-image** provenance (`source`/`externalPath` on `movie_image`). `TMDB-FIX-05`'s actual acceptance criteria (select specific images, avoid duplicate import, store where each image came from) are fully satisfied without the much larger XL movie-level resync system — that stays a separate, not-yet-started ticket.
- **TMDB's `/images` endpoint has no "stills" category for movies** (only `posters`/`backdrops`/`logos` — "stills" is a TV-episode-only TMDB concept). This app's own `MovieImageType.STILL` is populated from **extra backdrops** beyond the one recommended as the movie's primary backdrop, not from a TMDB field of the same name.
- **Dedup enforced at two layers, deliberately:** `findExistingSourcePathKeys` is an app-level pre-check (fast, gives a clean warning instead of an error for the common "already imported, just skip it" case), while the partial unique index is the actual correctness guarantee for the concurrent-import race — the service catches the resulting `DataIntegrityViolationException` and remaps it to `TMDB_IMAGE_ALREADY_IMPORTED` rather than leaking a raw DB error.
- **Configuration-driven image URLs, not hardcoded `w500`:** `TmdbService.getImageConfig()` calls TMDB's `/configuration` once and caches it for the app's lifetime, with a static fallback if that call itself fails — so size profiles aren't hand-maintained constants that silently drift from what TMDB actually serves.
- **Dedicated `MovieEditorPage` over a bigger modal:** the create/edit movie modal was already cramped before this feature added a media picker on top; user chose a 2-column dedicated page (form left, sticky preview/import/gallery right) over a side-drawer alternative, matching the precedent already set by `CinemaRoomEditorPage`. `MovieModal.tsx` was deleted after confirming (via grep) nothing else imports it.

---

## How to Test

1. `mvnw.cmd -pl movie-service -am test` — includes the new `TmdbImageSelectionTest` (8 cases: language-priority ranking, vote-average tiebreak, thumbnail vs. poster size difference, aspect-ratio filtering, TMDB-side dedup, stills capped at the configured max and excluding the recommended backdrop, graceful fallback + warning when no poster exists, recommended-flag correctness) and `MovieImageServiceTest` (7 cases: per-type limits for poster/backdrop/stills, rejecting a selection no longer present in TMDB's response, skip-not-error on already-imported assets, successful import with metadata capture, manual add tagged `source=MANUAL`).
2. `MovieImageRepositoryIntegrationTest` — confirms the `uq_movie_image_source_path` partial unique index and the `is_default` column default behave against a real `ddl-auto=create-drop` schema.
3. Manual/live QA performed this session via Playwright against a running dev stack: admin login → Add Movie → TMDB search → apply "The Odyssey" (`tmdbId 1368337`) → media picker renders ranked/recommended poster+backdrop+stills → select extra stills → hit (and resolve) the pre-existing "select a screening format" validation → save → confirm `POST /api/movies` (200) then `POST /api/movies/{id}/images/tmdb-import` (200) → verified via direct DB query that all 4 images persisted with correct `image_type/source/external_path/language_code/width/height/is_default` → reopened the Edit page and confirmed the Photo Gallery renders all 4 with correct labels.
4. `mvnw.cmd -pl movie-service -am compile` and `npm run typecheck` (client) both clean.

---

## Checklist

**General**
- [x] Follows project coding conventions
- [x] No debug / console.log code left
- [x] Code compiles (backend `mvn compile`, frontend `tsc`)

**Backend**
- [x] No new N+1s (`importFromTmdb` batches selections into one `saveAll`, one re-fetch of TMDB's `/images`)
- [x] Exception handling uses correct error codes (table above)
- [x] Endpoints exercised live (not just unit tests) against a running TMDB-backed dev stack, see "How to Test" #3
- [ ] Postman collection / `API_CONTRACT.md` — not updated in this MR, reviewer should add the new endpoint

**Frontend**
- [x] Loading and error states handled (`TmdbMediaPicker` disables "Import Selected" while in flight, surfaces failures via `sonner` toast)
- [x] `axiosClient` Bearer token attached correctly (reused existing `movieApi` client, no new auth wiring)
- [ ] Dark/light mode — verified light mode only during live QA this session; reviewer should spot-check dark mode

---

## Reviewer Notes

- **Breaking-ish change for frontend consumers of `GET /tmdb/{id}/details`:** new `media`/`thumbnailUrl` fields are additive, nothing existing was removed or renamed — safe for any other caller.
- `MovieModal.tsx` was deleted, not deprecated-in-place — grep confirmed zero remaining imports before removal, but worth a second look if any long-lived feature branch still references it.
- `TMDB-FIX-06` (movie-level provenance/resync) remains unimplemented and unscoped — flagging here so it isn't assumed done because this MR touched adjacent territory.
- The `is_default` column default fix (`@ColumnDefault("false")`) is a one-line, easy-to-miss detail: without it, any raw-SQL test/tooling that inserts into `movie_image` without naming every column will fail against a Hibernate-generated (`create-drop`) schema even though the Flyway-managed production schema is fine, because Lombok's `@Builder.Default` never reaches the DDL generator.
