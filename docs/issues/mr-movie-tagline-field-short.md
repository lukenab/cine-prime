# MR - Add tagline support to movies and translations

## Overview / Objective

This MR adds an optional tagline to both `Movie` and `MovieTranslation`. Taglines can be entered manually or imported from TMDB, returned by the existing movie APIs, edited in the admin movie form, and displayed in movie details.

The implementation reuses the existing TMDB draft mapping pipeline so preview and import produce the same result. It also records whether the canonical tagline came from TMDB or a manual edit.

Closes #150

---

## Changes Introduced

**Backend:**

- Added `tagline` to `Movie` and `MovieTranslation`.
- Added `taglineSource` to `Movie`, with supported values `TMDB` and `MANUAL`.
- Added optional tagline fields to create, update, translation, movie response, and TMDB preview DTOs.
- Added a maximum length validation of 500 characters.
- Mapped the canonical TMDB tagline and localized translation taglines through `TmdbDraftMapper`.
- Normalized blank TMDB taglines to `null`.
- Marked imported taglines as `TMDB` and manually edited taglines as `MANUAL`.
- Reconciled localized taglines together with existing title and synopsis translations.

**Frontend:**

- Added localized tagline inputs for Vietnamese and English in `MovieEditorPage`.
- Kept tagline separate from synopsis to avoid mixing a short marketing phrase with the movie description.
- Added tagline fields to the frontend API types.
- Displayed the tagline above the synopsis in `MovieDetailModal` when a value exists.

**Database:**

- Added migration `V7__add_movie_tagline.sql`.
- Added nullable `movie.tagline VARCHAR(500)`.
- Added `movie.tagline_source` with default `MANUAL` and a database check constraint.
- Added nullable `movie_translation.tagline VARCHAR(500)`.

**API impact:**

- No endpoint was added or removed.
- Existing movie create, update, detail, and TMDB preview payloads now support optional tagline fields.
- The change is additive for existing API consumers.

---

## Key Architectural Decisions

- TMDB preview and import share one mapping pipeline; no second tagline mapping path was introduced.
- Blank TMDB values are stored as `null`, not as meaningful empty strings.
- Missing taglines do not block draft creation, import, or review submission.
- Manual edits change `taglineSource` to `MANUAL` so a future TMDB resync can preserve user-owned content.
- The UI uses localized tagline fields instead of adding a third independent canonical input.

---

## How to Test

### Backend

From `server/`:

```powershell
.\mvnw.cmd -pl movie-service -am test "-Dtest=TmdbDraftMapperTest,TmdbServiceTest,MovieServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Verify these cases:

1. TMDB details with a tagline populate the preview and imported movie.
2. A blank or missing TMDB tagline becomes `null` and does not fail the import.
3. English and Vietnamese translation taglines are stored independently.
4. Updating a tagline manually sets `taglineSource` to `MANUAL`.
5. Updating unrelated movie fields does not overwrite the existing tagline source.
6. A tagline longer than 500 characters is rejected by validation.

### Frontend

From `client/`:

```powershell
npm test
npm run build
```

Manual verification:

1. Open the Create Movie page.
2. Import a TMDB movie that has a tagline.
3. Confirm the localized tagline field is populated.
4. Save the movie and reopen the Edit page.
5. Confirm the tagline is retained and displayed above the synopsis in movie details.
6. Edit the tagline manually and save again.
7. Confirm the updated value is returned with `taglineSource = MANUAL`.
8. Verify the form in both light and dark mode.

---

## Checklist

**General**

- [x] Code compiles
- [x] No debug code added
- [x] Existing endpoints remain backward compatible

**Backend**

- [x] Entity, DTO, mapper, and service support added
- [x] Database migration added
- [x] Field length validated at API and database levels
- [x] Missing tagline remains optional
- [x] TMDB and manual provenance handled
- [x] Unit tests added for mapper and service behavior
- [ ] Full Postman flow verified against the Docker database
- [ ] API contract updated with the additive fields

**Frontend**

- [x] Localized tagline inputs added
- [x] Tagline displayed separately from synopsis
- [x] Frontend API types updated
- [x] Frontend tests pass
- [x] Production build succeeds
- [ ] Light and dark mode manually verified

---

## Reviewer Notes

- This MR does not implement a general TMDB resync job. `taglineSource` only prepares the field for safe future resync behavior.
- Tagline is optional and must never be used as a fallback for synopsis.
- Apply migration V7 before testing against an existing `movie_db`.
- Review only the additive tagline fields; movie lifecycle and exhibition scheduling are outside this MR.
