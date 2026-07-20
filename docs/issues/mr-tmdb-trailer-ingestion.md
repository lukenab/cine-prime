## Overview / Objective

Implements `[Backend] Fetch and select an official TMDB trailer`. `Movie.trailerUrl` already
existed but TMDB integration never fetched TMDB's `/movie/{id}/videos` endpoint, so it was
always blank on import. This MR fetches TMDB video metadata, applies a selection policy
(YouTube-only, official > non-official, vi/en locale priority, Trailer preferred over Teaser),
and persists the selected trailer with provenance so a future re-sync can tell an auto-selected
TMDB pick apart from a manual admin override.

Related Issue: Closes `[Backend] Fetch and select an official TMDB trailer`
Depends on: none (reuses the shared `fetchAll()`/`getDetails()`/`importMovie()` pipeline from
`mr-tmdb-unify-import-and-genre-mapping.md`)

---

## Changes Introduced

**Controllers / Routes:**
- None. `GET /api/movies/tmdb/{tmdbId}/details` (existing endpoint) response gains `trailerUrl`
  and provenance fields, no route/method change.

**Services / Logic:**
- `TmdbService.fetchVideos(tmdbId)` — new call to `GET /movie/{id}/videos`, added as a 5th
  member of the existing `TmdbFetchBundle`/`fetchAll()` so `getDetails()` (preview) and
  `importMovie()` share the exact same fetch, same as the other 4 calls.
- `TmdbService.selectTrailer(videos, warnings)` — selection policy:
  - Only `site="YouTube"` videos are eligible at all (no other host is ever turned into a URL).
  - Ranked by `official` flag first (official beats non-official), then `vi > en` locale
    priority (unranked/other locales sort last).
  - Picks the top-ranked `type="Trailer"` candidate if one exists.
  - Falls back to the top-ranked `type="Teaser"` **only** if there is no eligible Trailer at
    all, and always appends a `TRAILER_FALLBACK_TEASER:<key>` warning when it does — never a
    silent substitution.
  - If nothing eligible exists, returns no trailer and appends a `TRAILER_NOT_FOUND` warning;
    this never blocks preview or import.
  - `trailerUrl` is always built server-side as `https://www.youtube.com/watch?v=<key>` from
    the allow-listed `YOUTUBE` provider + the selected video's key — never a raw URL/field
    taken straight out of TMDB's payload.
- `getDetails()` and `importMovie()` both call `selectTrailer()` against the same
  `bundle.videos()` — cannot diverge between preview and import (same precedent as
  `TMDB-FIX-02`'s shared draft mapper).
- `importMovie()` persists the selection onto the new `Movie` with `trailerSource = "TMDB"`
  (or `"MANUAL"` if no trailer was found — nothing to protect either way).
- `MovieService.updateMovie()` — if the admin's request includes a (non-null) `trailerUrl`,
  the four TMDB provenance fields are cleared and `trailerSource` is flipped to `"MANUAL"`,
  since a hand-typed URL is not a parsed YouTube key. This is what "local override survives a
  future re-sync" means today — there is no re-sync feature yet in this codebase, so this is a
  forward-looking guard, not an active behavior change.

**DTOs / Mappers / Components:**
- New `movieservice.dto.tmdb.TmdbVideosResponse` — raw `/movie/{id}/videos` wire shape
  (`results: [{key, name, site, type, official, iso_639_1, published_at}]`).
- `TmdbMovieDetailsResponse` — added `trailerUrl`, `trailerProvider`, `trailerExternalKey`,
  `trailerLanguageCode`, `trailerVideoType`, `trailerOfficial`.
- `MovieResponse` (admin-facing) — added `trailerSource` (`TMDB` | `MANUAL`) so the admin UI can
  show whether the current trailer came from TMDB or was hand-entered. `PublicMovieResponse`
  (customer-facing) is untouched — customers only ever need the playable URL.

**Database / JPA / Migration:**
- `V5__add_movie_trailer_provenance.sql` — adds `trailer_provider`, `trailer_external_key`,
  `trailer_language_code`, `trailer_video_type`, `trailer_official`, `trailer_source` (`NOT
  NULL DEFAULT 'MANUAL'`) to `movie`, plus `chk_trailer_video_type`
  (`NULL | 'TRAILER' | 'TEASER'`) and `chk_trailer_source` (`'TMDB' | 'MANUAL'`) CHECK
  constraints. Follows this repo's established idempotent-migration convention
  (`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` before `ADD CONSTRAINT`) so it is
  safe to re-run against an already-migrated schema (required by
  `FlywayMigrationIntegrationTest`'s hand-migrated-DB scenario).
- `Movie` entity — added matching fields; `trailerSource` uses `@Builder.Default` **and**
  `@ColumnDefault("'MANUAL'")` (same pattern already used for `MovieImage.isDefault` — the
  Lombok default alone is invisible to Hibernate's DDL generator).

**Exception Handling / Error Codes:**
- None added. Per the acceptance criteria, a missing/unavailable trailer is a warning
  (`TRAILER_NOT_FOUND`), never a blocking error — neither preview nor import fails because
  TMDB has no trailer for a title.

---

## API contract

### `GET /api/movies/tmdb/{tmdbId}/details` (existing endpoint, additive response fields)

```json
{
  "code": 200,
  "result": {
    "tmdbId": 1368337,
    "trailerUrl": "https://www.youtube.com/watch?v=officialKey",
    "trailerProvider": "YOUTUBE",
    "trailerExternalKey": "officialKey",
    "trailerLanguageCode": "en",
    "trailerVideoType": "TRAILER",
    "trailerOfficial": true,
    "warnings": []
  }
}
```

No trailer available at all:
```json
{
  "code": 200,
  "result": {
    "trailerUrl": null,
    "trailerProvider": null,
    "warnings": ["TRAILER_NOT_FOUND"]
  }
}
```

Teaser fallback:
```json
{
  "code": 200,
  "result": {
    "trailerUrl": "https://www.youtube.com/watch?v=teaserKey",
    "trailerVideoType": "TEASER",
    "warnings": ["TRAILER_FALLBACK_TEASER:teaserKey"]
  }
}
```

### `POST /api/movies/tmdb/import` (existing endpoint, no request/response shape change)

`Movie.trailerUrl` (and its provenance columns) are now populated on the created `DRAFT` movie
using the same selection as the preview above; `trailerSource="TMDB"`.

### `PUT /api/movies/{id}` (existing endpoint, no shape change, new side effect)

If `trailerUrl` is included in the request body, `trailerSource` becomes `"MANUAL"` and the
TMDB provenance columns (`trailerProvider`/`trailerExternalKey`/`trailerLanguageCode`/
`trailerVideoType`/`trailerOfficial`) are cleared.

---

## Key Architectural Decisions

- **Scope cut, disclosed:** the issue's "Related" section lists `TMDB-FIX-06` (movie-level
  resync) as a dependency, but no resync feature exists anywhere in this codebase yet (checked
  before starting this MR). `trailerSource` is added now specifically so that whenever a resync
  feature is eventually built, it has a field to check before overwriting a manual trailer —
  but no resync logic itself is implemented here, since the issue's actual acceptance criteria
  don't require it.
- **Provider allow-list, not a raw copy:** `trailerUrl` is only ever synthesized from
  `"https://www.youtube.com/watch?v=" + key` for a `site="YouTube"` candidate. TMDB's own
  payload is never trusted to already contain a safe, embeddable URL.
- **Teaser fallback always warns, never silently substitutes:** the AC explicitly requires this,
  so `TRAILER_FALLBACK_TEASER:<key>` is unconditionally appended whenever the returned video's
  type is Teaser rather than Trailer — a caller can always tell which policy tier was used.
- **Single stored trailer per movie, not a candidate table:** unlike the TMDB image-import
  feature (`movie_image`, multiple rows with an admin picker), this issue only asks the backend
  to auto-select and store *one* trailer with structured provenance — building a parallel
  multi-candidate `movie_video` table and a picker UI would be well beyond the issue's own `M
  (2-4h)` estimate, so it wasn't attempted.

---

## How to Test

1. `mvnw.cmd -pl movie-service test` — includes the new `TmdbTrailerSelectionTest` (6 cases:
   official beats non-official, vi beats en, non-YouTube sites ignored, teaser fallback +
   warning, no fallback when a trailer exists, nothing found + warning). Full suite: 191/192
   passing as of this MR — the one remaining failure
   (`MovieImageRepositoryIntegrationTest.save_NativeQuery_LegacyMixedCase_UppercaseEnum`) is a
   pre-existing, unrelated enum-casing check-constraint failure confirmed present before this
   MR's changes.
2. `FlywayMigrationIntegrationTest` — both scenarios pass with `V5` included; the fresh-DB
   migration count assertion was bumped from 4 to 6 (`V1..V5` + repeatable `R`).
3. Manual: import a movie by `tmdbId` via the existing TMDB import flow and confirm
   `trailerUrl`/`trailerSource="TMDB"` are populated; then `PUT` the movie with a different
   `trailerUrl` and confirm `trailerSource` flips to `"MANUAL"` and the provenance columns clear.

---

## Checklist

**General**
- [x] Follows project coding conventions
- [x] No debug / console.log code left
- [x] Code compiles (`mvn compile`) and full test suite passes (191/192, see above)

**Backend**
- [x] No new N+1s (one extra HTTP call per preview/import, no extra DB queries)
- [x] Exception handling — no new error codes needed; missing trailer is a warning by design
- [ ] Endpoints tested via Postman / API client — not run against a live TMDB key in this
      session; reviewer should smoke-test the trailer fields against a real key before merge
- [ ] Postman collection / `API_CONTRACT.md` — not updated in this MR, reviewer should add the
      new response fields

**Frontend**
- Not touched — surfacing `trailerUrl`/`trailerSource` in the admin UI (e.g. a badge on
  `MovieEditorPage`) is a natural small follow-up, not requested by this issue.

---

## Reviewer Notes

- **`TMDB-FIX-06` (movie-level resync) is still not implemented anywhere in this codebase.**
  `trailerSource` exists purely so a future resync has something to check — there is no resync
  job or endpoint to review here.
- The migration idempotency requirement (`IF NOT EXISTS` everywhere) is not optional style in
  this repo — `FlywayMigrationIntegrationTest.handMigratedDatabaseBaselinesInsteadOfReplayingSchema`
  actively re-runs every versioned migration against an already-migrated schema, so a
  non-idempotent `ALTER TABLE ... ADD COLUMN` would fail that test (confirmed - it did, before
  the fix in this MR).
- Local dev Postgres already had a stale `flyway_schema_history` row for `V5` recorded against
  an earlier draft of this migration's checksum; it was cleared during this MR's own
  development. Nothing for the reviewer to do here, just flagging in case anyone else's local
  dev DB needs the same one-time fix (`DELETE FROM flyway_schema_history WHERE version='5'`,
  safe only because this is a local/dev database, never do this against a shared environment).
