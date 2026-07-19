# movie-service Authorization Matrix

`[Backend] Enforce movie-service endpoint authorization matrix`. Documents, per resource, who is
allowed to call it — Anonymous/CUSTOMER, EMPLOYEE, ADMIN — and where that's enforced: the
`SecurityConfig` filter-chain matcher (URL-level, decides whether a request needs *any*
authenticated principal at all) and/or `@PreAuthorize` (method-level, decides *which* role).
Both layers matter: a broad filter-chain matcher that `permitAll()`s a whole path prefix means
every future endpoint added under it is public-by-default unless someone remembers to add
`@PreAuthorize` — the actual bug class this issue exists to close out.

Legend: **Allow** = can call · **Deny** = 401/403 · **Own only** = allowed but scoped to a
resource the caller created/owns · role names are the JWT's Spring Security authorities
(`ROLE_ADMIN`, `ROLE_EMPLOYEE`, `ROLE_MEMBER` for a logged-in customer, or no authentication at
all for Anonymous).

---

## 1. Movie catalog

| Endpoint | Anonymous/CUSTOMER | EMPLOYEE | ADMIN | Enforced by |
|---|---|---|---|---|
| `GET /api/movies/public`, `GET /api/movies/public/{id}` | Allow (published/bookable only — `MovieService.isPubliclyVisible()`) | Allow | Allow | `SecurityConfig` matcher (permitAll on `/api/movies/public/**`) |
| `GET /api/movies/{id}`, `GET /api/movies` (internal, full workflow state) | Deny | Allow | Allow | `@PreAuthorize` |
| `GET /api/movies/all` | Deny | Allow | Allow | `@PreAuthorize` |
| `POST /api/movies`, `PUT /api/movies/{id}` | Deny | Allow (own draft) | Allow | `@PreAuthorize` |
| `POST /api/movies/{id}/submit`, `/start-revision` | Deny | Allow | Allow | `@PreAuthorize` |
| `POST /api/movies/{id}/approve`, `/request-changes`, `/archive` | Deny | Deny | Allow | `@PreAuthorize` |
| `POST /api/movies/images`, movie image CRUD, TMDB image import | Deny | Allow | Allow | `@PreAuthorize` |

`GET /api/movies/{id}`/`GET /api/movies` were previously reachable anonymously (fixed in
`[Backend] Separate public and internal movie catalog APIs`) — kept here for completeness since
it's the same resource family.

## 2. TMDB browse/details/import

| Endpoint | Anonymous/CUSTOMER | EMPLOYEE | ADMIN | Enforced by |
|---|---|---|---|---|
| `GET /api/movies/tmdb/search`, `/now-playing`, `/upcoming`, `/{id}/details` | Deny | Allow | Allow | `@PreAuthorize` |
| `POST /api/movies/tmdb/import` | Deny | Allow | Allow | `@PreAuthorize` |
| `POST /api/movies/tmdb/genres/sync` | Deny | Deny | Allow | `@PreAuthorize` |

Already correctly gated by `@PreAuthorize` before this issue. The `SecurityConfig` matcher used
to be a blanket `GET /api/movies/**` `permitAll()`, which put these routes' *filter-chain*
posture at odds with their (correct) method-level gate — narrowed to `/api/movies/public/**` in
the movies-catalog-separation MR, so the matcher now matches reality instead of relying solely
on nobody forgetting a `@PreAuthorize`.

## 3. Cinema clusters

| Endpoint | Anonymous/CUSTOMER | EMPLOYEE | ADMIN | Enforced by |
|---|---|---|---|---|
| `GET /api/cinema-clusters` (list) | Allow (ACTIVE only) | Allow (all statuses) | Allow (all statuses) | Controller logic (`isStaff()`) |
| `GET /api/cinema-clusters/{id}` (detail) | Allow (ACTIVE only, else 404) | Allow (all statuses) | Allow (all statuses) | Controller logic (`isStaff()`) — **fixed by this issue**, previously leaked full detail of any-status cluster to anyone who guessed an ID |
| `POST /api/cinema-clusters`, `PUT /{id}` | Deny | Allow (own draft) | Allow | `@PreAuthorize` |
| `POST /{id}/submit` | Deny | Allow (own draft) | Allow | `@PreAuthorize` + self-approval guard in service |
| `POST /{id}/approve`, `/reject` | Deny | Deny | Allow (not own creation — self-approval guard) | `@PreAuthorize` + service |
| `DELETE /{id}` (retire/hard-delete unused draft) | Deny | Deny | Allow | `@PreAuthorize` |
| `GET /{id}/audit-log` | Deny | Deny | Allow | `@PreAuthorize` |

## 4. Cinema rooms / seats / layouts

| Endpoint | Anonymous/CUSTOMER | EMPLOYEE | ADMIN | Enforced by |
|---|---|---|---|---|
| `GET /api/cinema-rooms`, `GET /{id}` | Allow (hides DRAFT/PENDING_APPROVAL) | Allow (all statuses) | Allow (all statuses) | Controller + service logic (`isStaff()`) — **fixed by this issue**, previously returned any-status room (including in-progress wizard drafts) to anyone |
| `GET /{id}/seats` (room's seat map) | Allow | Allow | Allow | `SecurityConfig` matcher (permitAll `/api/cinema-rooms/**`) — legitimate, customers need this before booking |
| `POST /api/cinema-rooms`, `PUT /{id}` | Deny | Allow (own draft) | Allow | `@PreAuthorize` |
| `DELETE /{id}` (hard delete unused draft) | Deny | Allow (own draft only — policy enforced in service) | Allow | `@PreAuthorize` + service ownership check |
| `POST /{id}/maintenance`, `/maintenance/{id}/resolve`, `PATCH /{id}/status` | Deny | Allow | Allow | `@PreAuthorize`; actor now taken from verified `Authentication`, **fixed by this issue** (previously trusted a client-supplied `X-User-Name` header, default `"unknown"`) |
| `GET /api/cinema-rooms/{roomId}/layouts`, `GET /{layoutId}` | Allow | Allow | Allow | `SecurityConfig` matcher — seat-position data only, not sensitive; a customer needs the ACTIVE layout to see the seat map |
| `PUT /{layoutId}`, `/submit`, `/clone` | Deny | Allow (own room) | Allow | `@PreAuthorize` |
| `/approve`, `/reject`, `/activate` | Deny | Deny | Allow | `@PreAuthorize` |
| `GET /api/seats/room/{roomId}`, `GET /{id}` | Allow | Allow | Allow | `SecurityConfig` matcher (permitAll `/api/seats/**`) — legitimate, seat browsing |
| `PUT /api/seats/{id}` (edit seat type/price — structural, not booking) | Deny | Allow | Allow | `@PreAuthorize` — **fixed by this issue**, previously had none at all (any authenticated CUSTOMER could edit seat structure) |
| `PATCH /api/seats/{id}/status` | Deny | Deny | Allow | `@PreAuthorize` (unchanged) |
| `GET /api/showtimes/{id}/seats` | Allow | Allow | Allow | `SecurityConfig` matcher — **added by this issue** (was falling through to `.anyRequest().authenticated()`, requiring login just to browse a seat map) |
| `PUT /api/showtimes/{id}/seats/lock` (hold seats) | Allow, authenticated only (any signed-in customer may hold seats for their own booking) | Allow | Allow | `.anyRequest().authenticated()` (no role restriction — intentional) |

## 5. Schedules (showtimes admin CRUD)

| Endpoint | Anonymous/CUSTOMER | EMPLOYEE | ADMIN | Enforced by |
|---|---|---|---|---|
| `GET /api/schedules`, `/{id}`, `/movie/{movieId}` | Allow | Allow | Allow | `SecurityConfig` matcher (permitAll) — legitimate, customers browse showtimes to book |
| `POST`, `POST /generate-preview`, `POST /bulk`, `PUT /{id}`, `DELETE /{id}` | Deny | Deny | Allow | `SecurityConfig` matcher (`hasRole('ADMIN')`) **and** `@PreAuthorize` (defense in depth, already correct before this issue) |

## 6. Reference-data mutation (genres, age ratings, screening formats, production companies, persons)

| Endpoint | Anonymous/CUSTOMER | EMPLOYEE | ADMIN | Enforced by |
|---|---|---|---|---|
| `GET` on all of the above | Allow (genres/rooms/room-master-data explicitly permitAll; persons/companies/age-ratings/formats fall to `.anyRequest().authenticated()` — any logged-in user, no role narrowing) | Allow | Allow | mixed, see notes below |
| `POST/PUT/DELETE` genres, age ratings, screening formats, production companies | Deny | Deny | Allow | `@PreAuthorize` (unchanged, already correct) |
| `POST/PUT` persons (cast/crew) | Deny | Allow (needed inline while creating/editing a movie's cast) | Allow | `@PreAuthorize` — **fixed by this issue**, previously had none at all |
| `DELETE` persons | Deny | Deny | Allow | `@PreAuthorize` — **fixed by this issue** |

Residual note: `GET /api/persons`, `/api/companies`, `/api/age-ratings`, `/api/screening-formats`
require *some* authenticated principal (no `SecurityConfig` matcher permits them anonymously)
but do **not** narrow by role — any logged-in CUSTOMER can read this reference data. Left as-is:
it's low-sensitivity lookup data (cast bios/photos, company names, rating codes, format names),
consistent with how genres/room-master-data are already fully public. Tightening this further
is a low-value follow-up, not a live vulnerability, so it wasn't bundled into this fix.

## 7. Movie availability (per-cluster exhibition/release plan)

| Endpoint | Anonymous/CUSTOMER | EMPLOYEE | ADMIN | Enforced by |
|---|---|---|---|---|
| All of `GET/POST/PUT /api/movie-availabilities` | Deny | Allow | Allow | `@PreAuthorize` |
| `/open`, `/suspend`, `/resume`, `/close` | Deny | Deny | Allow | `@PreAuthorize` |

Already correctly gated before this issue.

---

## Fixes made under this issue

1. **`X-User-Name` header spoofing (`CinemaRoomController`)** — `reportMaintenance()`,
   `resolveMaintenance()`, `setRoomStatus()` accepted a client-supplied header
   (`defaultValue = "unknown"`) as the audit actor instead of the verified JWT `Authentication`,
   unlike every other mutating endpoint in the same controller. Now uses the same
   `actor(authentication)` helper `createRoom`/`updateRoom`/`deleteRoom` already used.
2. **`GET /api/cinema-clusters/{id}` direct-ID enumeration** — `getAll()` already hid non-ACTIVE
   clusters from non-staff callers; `getById()` didn't, so a DRAFT/PENDING_REVIEW cluster's ID
   could be guessed and its full detail read anonymously. Same visibility rule now applied to
   both, and a hidden cluster 404s exactly like a nonexistent one (existence isn't leaked).
3. **`GET /api/cinema-rooms`, `GET /{id}` direct-ID enumeration** — same class of bug as #2:
   DRAFT/PENDING_APPROVAL rooms (an in-progress wizard workflow, nothing bookable) were visible
   to anyone. Non-staff callers now only see rooms past that gate.
4. **`PUT /api/persons/*`, `POST`, `DELETE`** — no `@PreAuthorize` at all; any authenticated
   CUSTOMER could create/edit/delete cast & crew reference data.
5. **`PUT /api/seats/{id}`** — no `@PreAuthorize` at all; edits seat *structure* (type/price),
   not a booking action, so any authenticated CUSTOMER could change it.
6. **`GET /api/showtimes/{id}/seats`** — added an explicit permitAll matcher; was requiring
   login just to browse a showtime's seat map, inconsistent with every other seat/room browse
   endpoint being public.

## Known gaps intentionally not in scope here

- Reference-data `GET` endpoints (persons/companies/age-ratings/formats) require login but not a
  specific role — see the note under §6. Low-sensitivity, not addressed.
- Room layout `GET` (seat coordinate data) stays public regardless of layout lifecycle status —
  coordinates alone aren't sensitive; only the *room's* DRAFT/PENDING_APPROVAL status (fixed in
  #3) gated on anything meaningful.
- Gateway-level verification that no spoofed identity header (`X-User-Name`, `X-Role`, etc.) is
  forwarded from outside the trust boundary was **not** independently re-verified against the
  API Gateway's own routing config in this pass — this issue only fixed the movie-service side
  (stopped *reading* that header as truth). If the gateway does forward client-supplied headers
  under the same names, downstream services relying on the JWT alone (as movie-service now
  does everywhere) are unaffected, but this is worth a dedicated gateway-focused audit.
