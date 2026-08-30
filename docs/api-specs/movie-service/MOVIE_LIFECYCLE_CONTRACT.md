# Movie Content & Exhibition Lifecycle Contract (MOV-LC-02)

Canonical contract for MOV-LC-03..10. Supersedes the mixed `Movie.status`
model (`DRAFT, PENDING_REVIEW, REJECTED, COMING_SOON, NOW_SHOWING, SUSPENDED,
ENDED`) that conflated content review with per-location exhibition.

## Three separate concepts

| Domain | Owner | Scope | Persisted where |
|---|---|---|---|
| Content status | Editorial (ADMIN/EMPLOYEE) | Whole system, one value per movie | `movie.status` |
| Availability status | Operations (ADMIN), per cluster | One or more rows per movie | `movie_availability.status` |
| Display status | Derived, read-only | Per movie **and** per cluster | Not persisted — computed at read time |

### 1. Content status — `MovieStatus`

```
DRAFT → PENDING_REVIEW → APPROVED → ARCHIVED
              ↓        ↑
     CHANGES_REQUESTED ┘  (start-revision returns to DRAFT)
```

| From | Command | To | Role | Notes |
|---|---|---|---|---|
| — | create | `DRAFT` | ADMIN/EMPLOYEE | status never accepted from request body |
| `DRAFT` | `submit` | `PENDING_REVIEW` | ADMIN/EMPLOYEE | `MovieReadinessValidator.requireReadyForReview` |
| `PENDING_REVIEW` | `approve` | `APPROVED` | ADMIN | `requireReadyForApproval`; **no longer sets an exhibition state** |
| `PENDING_REVIEW` | `request-changes` | `CHANGES_REQUESTED` | ADMIN | body `{ "note": string }`, required |
| `CHANGES_REQUESTED` | `start-revision` | `DRAFT` | ADMIN/EMPLOYEE | |
| `APPROVED` | `archive` | `ARCHIVED` | ADMIN | blocked if any `movie_availability` row is `OPEN`/`PLANNED` |

Only `DRAFT` is directly editable via `PUT /api/movies/{id}`; any other status
returns `409 MOVIE_NOT_EDITABLE`. `APPROVED` does **not** imply public or
on-sale anywhere — that's entirely the availability layer's job.

### 2. Availability status — `AvailabilityStatus` (new `movie_availability` table, MOV-LC-03)

```
PLANNED → OPEN ⇄ SUSPENDED
            ↓        ↓
          CLOSED ← ──┘
```

One row per `(movie, cluster, showing_start_date)`. Commands: `open`,
`suspend` (reason required), `resume`, `close` — see MOV-LC-06. Creating a
plan requires the movie to already be `APPROVED`. `CLOSED` never touches
`movie.status`; a movie stays `APPROVED` after every one of its availability
windows closes, until an admin explicitly archives it.

### 3. Display status — derived, per cluster (MOV-LC-07)

Computed, never stored:

- `NOW_SHOWING`: availability is `OPEN` **and** at least one saleable showtime exists at that cluster.
- `COMING_SOON`: a future availability exists (`PLANNED`, or `OPEN` with no saleable showtime yet).
- Otherwise: not returned in the public listing for that cluster.

`SUSPENDED`/`CLOSED` availability never produces a public display status.
Content states other than `APPROVED` are never visible publicly.

## Deprecation plan for legacy endpoints

The old model conflated content and exhibition inside `Movie`, so several
endpoints have no equivalent left at the content layer — they move to
`MovieAvailability` (MOV-LC-06) instead of surviving as movie-level actions.

| Legacy endpoint | Disposition |
|---|---|
| `POST /api/movies/{id}/submit` | kept, same semantics |
| `POST /api/movies/{id}/approve` | kept, semantics changed (→ `APPROVED`, not `COMING_SOON`) |
| `POST /api/movies/{id}/reject` | **removed**, replaced by `/request-changes` |
| `POST /api/movies/{id}/rework` | **removed**, replaced by `/start-revision` |
| `POST /api/movies/{id}/suspend` | **removed** — becomes `POST /api/movie-availabilities/{id}/suspend` |
| `POST /api/movies/{id}/end` | **removed** — becomes `POST /api/movie-availabilities/{id}/close` |
| `POST /api/movies/{id}/release` | **removed** — becomes `POST /api/movie-availabilities/{id}/open` |
| `POST /api/movies/{id}/reinstate` | **removed** — becomes `POST /api/movie-availabilities/{id}/resume` |
| `DELETE /api/movies/{id}` | **removed** — explicit `POST /api/movies/{id}/archive` only |

Confirmed via codebase audit before removal: the frontend never called
`suspend/end/release/reinstate` (no `movieApi.ts` wrappers existed for them),
so removing them has zero frontend blast radius. `reject`/`rework`/`DELETE`
each have exactly one frontend caller, updated in the same change as the
backend (no separate deprecation window needed — this is a same-PR cutover,
not a phased rollout).

## Optimistic locking & audit trail

- `movie.version` and `movie_availability.version` (`@Version`) — a
  concurrent transition on a stale row throws
  `ObjectOptimisticLockingFailureException`, translated to `409
  MOVIE_CONCURRENT_MODIFICATION` / `AVAILABILITY_CONCURRENT_MODIFICATION`.
- New table `movie_status_history` (movie_id, from_status, to_status, actor,
  reason, created_at) — one row per content transition. Availability
  transitions are similarly recorded on `movie_availability_history`.
- `GET /api/movies/{id}/status-history` exposes that content-transition audit
  trail to authorized `MOVIE_READ` review surfaces, newest transition first.
  It is an internal endpoint and never forms part of the public movie response.
- Lifecycle transitions stop using the old `@Modifying` bulk JPQL updates
  (`MovieRepository.updateStatus/suspendMovie/rejectMovie`) because bulk
  updates bypass `@Version` increment; they're replaced by
  load-mutate-`save()` so optimistic locking actually engages.

## Data migration (MOV-LC-05)

| Legacy `movie.status` | New `movie.status` | Availability created? |
|---|---|---|
| `DRAFT` | `DRAFT` | none |
| `PENDING_REVIEW` | `PENDING_REVIEW` | none |
| `REJECTED` | `CHANGES_REQUESTED` | none |
| `COMING_SOON` | `APPROVED` | one `PLANNED` row per cluster inferred from that movie's showtimes |
| `NOW_SHOWING` | `APPROVED` | one `OPEN` row per cluster inferred from that movie's showtimes |
| `SUSPENDED` | `APPROVED` | one `SUSPENDED` row per cluster (reason copied from `movie.suspended_reason`) |
| `ENDED` | `APPROVED` | one `CLOSED` row per cluster |

Cluster is inferred from `show_time.cinema_room.cluster_id` for that movie.
A movie with no showtime history but a legacy exhibition status (COMING_SOON
etc.) gets **no** availability row and is reported for manual follow-up
rather than guessed. `movie.suspended_reason` is dropped after backfill (its
content is copied into the relevant `movie_availability.suspension_reason`
first).

## Response envelope

Unchanged: `{ code, message, result }`. Every command returns the updated
`MovieResponse`/`MovieAvailabilityResponse`, not `void`.
