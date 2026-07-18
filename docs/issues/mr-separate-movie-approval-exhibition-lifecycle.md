# Draft MR — [Backend] Separate movie approval from exhibition lifecycle

**Suggested source branch:** `feat/separate-movie-content-exhibition-lifecycle`  
**Suggested labels:** `Layer::Backend`, `Type::Feature`, `Priority::High`, `Review/ QA`

## Overview / Objective

This MR separates editorial approval from cinema exhibition. `Movie.status` now represents only the content-review lifecycle (`DRAFT`, `PENDING_REVIEW`, `APPROVED`, `CHANGES_REQUESTED`, `ARCHIVED`), while release planning and operational availability are managed independently per cinema cluster through `MovieAvailability`.

Approval is therefore a pure content decision: `POST /api/movies/{id}/approve` transitions a movie to `APPROVED` without implicitly publishing it, opening ticket sales, or changing its exhibition state. Public `NOW_SHOWING` / `COMING_SOON` values are derived from approved content, cluster availability, and showtime data instead of being stored in `Movie.status`.

Related Issue: Closes #173

---

## Changes Introduced

**Controllers / Routes:**

- Updated the movie lifecycle commands:
  - `POST /api/movies/{id}/submit`: `DRAFT → PENDING_REVIEW`.
  - `POST /api/movies/{id}/approve`: `PENDING_REVIEW → APPROVED`.
  - `POST /api/movies/{id}/request-changes`: `PENDING_REVIEW → CHANGES_REQUESTED` and requires a reason.
  - `POST /api/movies/{id}/start-revision`: `CHANGES_REQUESTED → DRAFT`.
  - `POST /api/movies/{id}/archive`: `APPROVED → ARCHIVED`.
- Removed the movie-level exhibition commands `release`, `suspend`, `reinstate`, and `end`; equivalent operations now belong to cluster-scoped availability resources.
- Replaced `DELETE /api/movies/{id}` with the explicit archive command.
- Added `MovieAvailabilityController` endpoints for search, create, update, open, suspend, resume, and close.
- Updated `GET /api/movies/public` to accept an optional `clusterId` and return a derived public read model.
- Kept role boundaries explicit: ADMIN/EMPLOYEE can prepare content and plans, while approval and availability state transitions remain ADMIN-only.

**Services / Logic:**

- `MovieService.createMovie()` always creates `DRAFT`, regardless of whether the actor is ADMIN or EMPLOYEE.
- `MovieService.approveMovie()` now returns `APPROVED` and no longer sets `COMING_SOON`.
- Centralized content transitions through load → validate current state → mutate → `save()` → record status history.
- Restricted direct movie updates to `DRAFT`; rejected content must use `start-revision` before editing.
- Added archive protection when the movie still has a `PLANNED` or `OPEN` availability window.
- Added `MovieAvailabilityService` with a separate transition matrix:
  - `PLANNED → OPEN`.
  - `PLANNED/OPEN → SUSPENDED` with a mandatory reason.
  - `SUSPENDED → OPEN`.
  - `PLANNED/OPEN/SUSPENDED → CLOSED`.
- Availability creation requires an `APPROVED` movie, an `ACTIVE` cluster, and a valid showing date range.
- Public display state is computed from approved content, per-cluster availability, and saleable showtimes rather than copied from the editorial state.
- Removed the legacy release/end scheduler behavior that mutated `Movie.status`; availability expiration now closes the operational window without archiving the movie.

**DTOs / Mappers / Components:**

- Added request/response DTOs for creating and updating movie availability windows.
- Added `PublicMovieResponse` with derived `displayStatus`, cluster context, next showtime, and booking availability.
- Added mappings for `MovieAvailability`, cluster details, and the public movie read model.
- Updated frontend API types to distinguish:
  - `MovieStatus` for editorial content.
  - `AvailabilityStatus` for per-cluster exhibition.
  - `DisplayStatus` for derived customer-facing presentation.
- Updated admin movie actions to call `request-changes`, `start-revision`, and `archive` instead of legacy reject/rework/delete routes.
- Added the availability management panel and compatibility mapping for existing customer movie cards.

**Database / JPA / Migration:**

- Added `@Version` to `Movie` and `MovieAvailability` for optimistic concurrency control.
- Added `movie_status_history` as an append-only audit trail for editorial transitions.
- Added `movie_availability` with one release window per movie, cluster, and showing start date.
- Added `movie_availability_history` for availability transition auditing.
- Added migration `V28__separate_movie_content_and_availability_lifecycle.sql` for the additive schema.
- Added migration `V29__backfill_movie_lifecycle_and_availability.sql` to:
  - convert `REJECTED → CHANGES_REQUESTED`;
  - convert legacy exhibition states to `APPROVED`;
  - infer per-cluster availability from existing showtimes;
  - tighten the canonical `movie.status` constraint;
  - remove the legacy `suspended_reason` column after backfill.
- Added migration `V30__fix_movie_version_column_type_collision.sql` to replace the obsolete varchar `movie.version` column with the numeric optimistic-lock version.
- Updated the fresh-database initialization script to include the canonical lifecycle schema.

**Exception Handling / Error Codes:**

- Added domain errors for non-editable content, active availability during archive, invalid availability transitions, inactive clusters, unapproved movies, invalid date ranges, and duplicate release windows.
- Added global handling for `OptimisticLockingFailureException`, returning HTTP 409 with stable error code `1010`.
- Maps unique availability-window conflicts to a domain-level HTTP 409 response.

---

## Key Architectural Decisions

- **Editorial and exhibition lifecycles are separate aggregates.** A movie may remain `APPROVED` after every release window has closed and may later be scheduled for a re-release without re-importing or re-approving its content.
- **Availability is cluster-scoped.** The same approved movie may be `OPEN` at one cluster, `PLANNED` at another, and absent from a third cluster.
- **Public display status is derived, not persisted.** `NOW_SHOWING` and `COMING_SOON` describe a customer's current cluster context and therefore must not be stored as a global content status.
- **Lifecycle changes use command endpoints.** Clients cannot assign workflow status through create/update payloads; each transition has an explicit route, role, validation rule, and audit event.
- **Transitions use entity `save()` instead of bulk JPQL updates.** Bulk updates bypass JPA `@Version`; load-mutate-save enables optimistic locking and prevents silent concurrent approval overwrites.
- **Legacy backfill only infers facts supported by showtime data.** A legacy exhibition movie without showtime history is converted to approved content but does not receive a guessed availability row; it requires manual operational review.
- **Archive replaces delete.** Historical movie, review, availability, and audit data are retained instead of being hard-deleted.

---

## How to Test

### 1. Automated verification

From `server/`:

```powershell
.\mvnw.cmd -pl movie-service -am test "-DskipTests=false" "-Dtest=MovieServiceTest,MovieAvailabilityServiceTest,MovieMapperTest" "-Dsurefire.failIfNoSpecifiedTests=false"
```

Expected result: 42 tests pass with no failures.

From `client/`:

```powershell
npm run build
```

Expected result: production build succeeds. A bundle-size warning may still be reported and is unrelated to this lifecycle change.

### 2. Apply database migrations

Apply the migrations in order to an existing `movie_db`:

```powershell
Get-Content -Raw .\docs\database\movie-service\V28__separate_movie_content_and_availability_lifecycle.sql | docker exec -i postgres psql -v ON_ERROR_STOP=1 -U postgres -d movie_db
Get-Content -Raw .\docs\database\movie-service\V29__backfill_movie_lifecycle_and_availability.sql | docker exec -i postgres psql -v ON_ERROR_STOP=1 -U postgres -d movie_db
Get-Content -Raw .\docs\database\movie-service\V30__fix_movie_version_column_type_collision.sql | docker exec -i postgres psql -v ON_ERROR_STOP=1 -U postgres -d movie_db
```

Restart `movie-service` and verify that Hibernate starts without a schema-validation error.

### 3. Verify content approval is not exhibition

1. Create a movie as ADMIN or EMPLOYEE and confirm its status is `DRAFT`.
2. Call `POST /api/movies/{id}/submit`; confirm `PENDING_REVIEW`.
3. Call `POST /api/movies/{id}/approve` as ADMIN; confirm `APPROVED`.
4. Confirm approval did not create a `movie_availability` row and did not automatically expose the movie as `NOW_SHOWING`.

### 4. Verify request-changes and revision flow

1. Submit another DRAFT movie for review.
2. Call `POST /api/movies/{id}/request-changes` with:

```json
{
  "note": "Primary poster and Vietnamese synopsis must be corrected."
}
```

3. Confirm status becomes `CHANGES_REQUESTED` and the reason is retained.
4. Confirm direct update returns a conflict while the movie is not DRAFT.
5. Call `POST /api/movies/{id}/start-revision`; confirm status returns to `DRAFT` and the movie becomes editable.

### 5. Verify per-cluster availability

1. Create an availability plan for an APPROVED movie and ACTIVE cluster:

```http
POST /api/movie-availabilities
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "movieId": 1,
  "clusterId": 1,
  "salesStartAt": "2026-07-20T08:00:00",
  "showingStartDate": "2026-07-25",
  "showingEndDate": "2026-08-15"
}
```

2. Confirm the initial status is `PLANNED`.
3. Open, suspend with a reason, resume, and close the availability using the command endpoints.
4. Confirm none of these commands changes `Movie.status` from `APPROVED`.
5. Call `GET /api/movies/public?clusterId=1` and confirm `displayStatus` is derived from availability/showtime state.

### 6. Verify archive protection and permissions

1. With a `PLANNED` or `OPEN` availability, call `POST /api/movies/{id}/archive`; expect HTTP 409, code `2071`.
2. Close all active availability windows and retry archive; confirm `APPROVED → ARCHIVED`.
3. Repeat ADMIN-only approval/open/suspend/resume/close/archive calls with an EMPLOYEE token; expect HTTP 403.
4. Submit a blank request-changes note; expect HTTP 400 validation failure.

---

## Checklist

**General**

- [x] Code compiles, no errors
- [x] No debug / console.log code left in the changed lifecycle paths
- [x] Follows project coding conventions

**Backend**

- [ ] No N+1 query issues confirmed from Hibernate/runtime output
- [x] Exception handling uses domain error codes for availability and archive rules
- [ ] Endpoints fully tested via Postman / API client against migrated Docker database
- [x] API lifecycle contract updated
- [x] Targeted unit tests pass: 42 tests, 0 failures
- [ ] Concurrent approval integration test added and verified
- [ ] V28 → V29 → V30 migration chain verified against a copy of legacy production-like data

**Frontend**

- [x] Frontend API calls use the canonical lifecycle endpoints
- [x] Customer UI reads derived `displayStatus` instead of editorial `movieStatus`
- [x] Production build succeeds
- [ ] Availability UI manually tested in both dark and light mode
- [ ] Explicit `Save & Approve` create action implemented and verified

---

## Reviewer Notes

- Keep this MR in **Draft** until the unchecked concurrency, migration, Postman, and UI verification items are completed.
- Review the boundary carefully: `Movie.status` must never contain `COMING_SOON`, `NOW_SHOWING`, `SUSPENDED`, `ENDED`, or `REJECTED` after V29.
- Confirm V29 backfill results for legacy exhibition movies with and without showtime history before accepting the tightened status constraint.
- V30 intentionally drops the legacy varchar `movie.version` column before creating the numeric optimistic-lock column. Reconfirm that no meaningful legacy value exists in the target database before applying it.
- The current global optimistic-lock response is HTTP 409 with generic code `1010`; the lifecycle contract currently mentions movie/availability-specific conflict names and should be aligned before the MR is marked ready.
- Invalid content transition currently uses `INVALID_STATUS_TRANSITION` with HTTP 400, while issue #173 expects a conflict response. Align it to HTTP 409 or explicitly update the issue contract.
- `MovieAvailabilityRepository.search()` maps lazy movie/cluster associations. Check Hibernate SQL during list/search requests and add an entity graph/fetch join if N+1 queries are observed.
- No concurrent two-admin approval integration test is present yet; optimistic locking is implemented, but the acceptance criterion still requires runtime proof.
- The explicit combined `Save & Approve` action requested by the issue is not implemented; current behavior is Create DRAFT → Submit → Approve as separate commands.
- This worktree contains unrelated Cinema Cluster, Cinema Room, TMDB, auth/gateway, and shared UI changes. Before opening the MR, create the source branch and stage only lifecycle-related files so the MR does not absorb unrelated scope.

