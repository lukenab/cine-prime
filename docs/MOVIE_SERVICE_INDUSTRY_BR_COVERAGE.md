# Movie Service Industry Business Rule Coverage

> Scope: Industry-inspired business rules for cinema/movie-theater systems, compared against the current CinePrime `movie-service`.
>
> Goal: Help the team know which business cases are already covered, partially covered, or should be planned for implementation.
>
> Status legend:
>
> - `Covered`: The current code/data model mostly supports this rule.
> - `Partial`: The model or part of the flow exists, but the rule is incomplete.
> - `Gap`: Not clearly supported yet.
> - `Plan`: Recommended future work.

## Public Industry References Used

These are public policies/docs from cinema chains, ticket platforms, and classification references. They are not copied as exact requirements; they are used to extract common business patterns.

| Source | Business Pattern Observed |
| --- | --- |
| AMC Theatres refund FAQ | Refund must be requested before showtime; convenience fees may be non-refundable. |
| Fandango ticket/concessions policy | Refund/exchange eligibility depends on theater policy; exchange can become account credit. |
| Cinemark refund FAQ | Tickets may be exchanged/refunded before showtime. |
| Regal tickets/cancellations help | Refund cutoff can be stricter, e.g. up to 60 minutes before showtime. |
| Atom Tickets help | Cancellation can be allowed up to 30 minutes before showtime; special events can have different policies. |
| BookMyShow support | Cancellation windows and refund percentage vary by cinema; some cases are not cancellable. |
| AMC/Regal/Classic Cinemas age policies | Restricted films can require adult accompaniment and may block young children for certain ratings/times. |
| Vietnam movie rating references | Local rating codes include `P`, `K`, `T13`, `T16`, `T18`, `C`. |

## Executive Coverage Summary

| Area | Current Coverage | Main Gap |
| --- | --- | --- |
| Movie approval lifecycle | Partial | Completeness checks before approval are not strict enough yet. |
| Public movie visibility | Partial | Public list is filtered, but public detail should also reject non-public statuses. |
| TMDB import | Covered/Partial | Good import foundation; still needs staff review and source reliability policy. |
| Age rating | Partial | Data model exists, but ticket purchase/admission enforcement belongs across booking/user/movie. |
| Showtime scheduling | Partial | Overlap, time window, and advance scheduling exist; room status and sale lifecycle need tightening. |
| Showtime cancellation | Gap/Partial | Status exists, but explicit cancel workflow should replace delete for business cases. |
| Seat snapshot/pricing | Partial | Showtime-seat snapshot exists; final price ownership with booking-service is not fully closed. |
| Refund/exchange policy | Gap | Mostly booking/payment-service, but movie-service must expose cutoff and showtime state. |
| Special events/private screenings | Gap | No event-specific policy model yet. |
| Room maintenance | Partial | Maintenance exists; scheduling should block unavailable rooms. |
| Audit | Partial | Some actions logged; status transitions should log consistently. |

## Coverage Matrix

### 1. Movie Catalog And Publication

| BR ID | Industry Business Rule | Current Status | Evidence In Project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-MOV-001 | Movie should not become customer-visible immediately after creation/import. | Covered | `MovieStatus.DRAFT`, `PENDING_REVIEW`, `COMING_SOON`, `NOW_SHOWING`; created/imported movies start as `DRAFT`. | Keep. Add tests for create/import default status. |
| IND-MOV-002 | Movie needs approval before being public. | Partial | `submitForReview`, `approveMovie`, `rejectMovie` exist. | Add required-data checklist before `approveMovie`: title, duration, age rating, genre, format, poster, translation. |
| IND-MOV-003 | Customer movie list should hide drafts/rejected/suspended/ended movies. | Partial | `findAllPublic()` returns `COMING_SOON`, `NOW_SHOWING`. | Also enforce same visibility in public detail endpoint. |
| IND-MOV-004 | Suspended content should disappear from customer sale surfaces but remain auditable. | Partial | `SUSPENDED` exists with `suspendedReason`. | Ensure showtimes for suspended movie are also blocked or suspended. |
| IND-MOV-005 | Ended movies remain in history/reporting, not hard-deleted. | Covered | `deleteMovie()` updates status to `ENDED` and blocks future showtimes. | Keep. Rename UI action from delete to end/archive if possible. |
| IND-MOV-006 | Duplicate movie import must be blocked. | Covered | `tmdb_id` unique, `TmdbService.importMovie()` checks existing TMDB ID. | Keep. Add duplicate test. |
| IND-MOV-007 | Same-title movies should be distinguishable by year/version. | Partial | `releaseDate` exists; duplicate guard currently title-based. | Plan better duplicate rule: `(normalizedTitle, releaseYear)` for manual create, TMDB ID for imports. |

### 2. Ratings And Admission Eligibility

| BR ID | Industry Business Rule | Current Status | Evidence In Project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-RATE-001 | Movie must store local age rating. | Partial | `AgeRating`, `age_rating_id`, TMDB rating mapping exist. | Make age rating required before approval/open sale. |
| IND-RATE-002 | Vietnam ratings should support `P`, `K`, `T13`, `T16`, `T18`, `C`. | Covered/Partial | `AgeRating` lookup exists; TMDB maps VN/US cert. | Verify seed data contains all local codes and `C` is blocked from public release. |
| IND-RATE-003 | Restricted movies require age check at ticket purchase/admission. | Gap in movie-service | Movie-service only stores rating. | Cross-service plan: booking-service checks member DOB or employee confirms ID at counter. |
| IND-RATE-004 | Parental accompaniment rule can apply for child/teen ratings. | Gap | No guardian/accompaniment model. | Plan only if target business requires strict age policy. |
| IND-RATE-005 | Some chains block very young children from restricted/late shows. | Gap | No age-by-showtime policy. | Backlog unless required by product owner. |

### 3. Showtime Scheduling

| BR ID | Industry Business Rule | Current Status | Evidence In Project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-SHOW-001 | A room cannot have overlapping showtimes. | Covered | `existsByCinemaRoomAndOverlappingTime`, request and DB conflict checks. | Keep. Add/update tests for overlap and excluding self on update. |
| IND-SHOW-002 | Showtime end time should be computed from movie duration. | Covered | `endTime = startTime.plusMinutes(movie.getDurationMinutes())`. | Keep. Do not accept client-provided end time as source of truth. |
| IND-SHOW-003 | Showtime must be inside operating hours. | Covered/Partial | `08:00` to `23:00` enforced in standalone create/update. | Apply same strict rule to all showtime creation paths. |
| IND-SHOW-004 | Showtime should be scheduled in advance. | Covered | `showDate >= today + 3 days`. | Keep; make value configurable later. |
| IND-SHOW-005 | Only active rooms should be schedulable. | Gap | Room existence checked; room status not clearly checked in create. | Implement: block `MAINTENANCE`, `TEMPORARILY_UNAVAILABLE`, `CLOSED`. |
| IND-SHOW-006 | Only approved/public movies should be scheduled or opened for sale. | Gap/Partial | Movie status exists, but showtime create does not clearly enforce allowed movie status. | Allow scheduling for `COMING_SOON`/`NOW_SHOWING`; block `DRAFT`, `REJECTED`, `ENDED`, `SUSPENDED`. |
| IND-SHOW-007 | Cancelled showtimes should use cancellation status/reason, not hard delete. | Gap/Partial | `CANCELLED`, `cancellationReason`, `cancelledAt`, `cancelledBy` fields exist. | Add explicit cancel API and customer visibility behavior. |
| IND-SHOW-008 | Special screenings/private events can have different cancellation/sale rules. | Gap | No special event type/policy fields. | Backlog: `showtime_type`, `refund_policy_code`, `is_special_event`. |

### 4. Ticket Sale Eligibility And Refund Support

This section touches booking/payment-service, but movie-service still owns the showtime facts needed to decide eligibility.

| BR ID | Industry Business Rule | Current Status | Movie-Service Responsibility | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-TKT-001 | Tickets can often be refunded/exchanged only before a cutoff before showtime. | Gap | Expose showtime start time/status and optional refund cutoff policy. | Plan with booking-service: `refund_cutoff_minutes` or policy config. |
| IND-TKT-002 | Convenience/platform fees may be non-refundable. | Out of scope | Movie-service does not own fees. | Booking/payment-service rule. Movie-service only provides showtime data. |
| IND-TKT-003 | Cancellation windows can vary by cinema or event. | Gap | Movie-service owns room/showtime and can attach policy. | Add showtime/cinema policy only if Sprint scope includes refunds. |
| IND-TKT-004 | No refund after showtime starts except manager/support override. | Gap | Expose accurate showtime start/end/status. | Booking-service enforces; admin override should be audited. |
| IND-TKT-005 | Exchange can move value to another showtime if policy allows. | Gap | Movie-service must validate target showtime is sellable and has seats. | Plan after booking cancellation/refund MVP. |

### 5. Seat Inventory And Pricing

| BR ID | Industry Business Rule | Current Status | Evidence In Project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-SEAT-001 | Seat availability must prevent double selling. | Partial | `ShowtimeSeatStatus`, reserved/sold states exist; booking-service also has locks. | Decide one concurrency owner. Prefer booking-service for transaction lock, movie-service for seat inventory snapshot. |
| IND-SEAT-002 | Seat reservation expires after a short hold window. | Partial | Movie-service lock uses 15 minutes; booking-service has its own lock behavior. | Avoid duplicate lock systems. Align on one TTL and one source of truth. |
| IND-SEAT-003 | Showtime seats should snapshot room seats and prices. | Partial | `ShowtimeSeat` stores `seatCode`, `seatType`, `price`. | Generate snapshots before sale opening, not lazily on first customer request. |
| IND-SEAT-004 | Premium formats/seat types can affect price. | Partial | `ScreeningFormat.surcharge`, `Seat.price`, `ShowtimeSeat.price`. | Define formula: base price + format surcharge + seat type surcharge + promotion. |
| IND-SEAT-005 | Blocked/maintenance seats should not be sellable. | Partial | `SeatStatus`, `ShowtimeSeatStatus.BLOCKED` exist. | Ensure snapshot generation excludes or blocks inactive/maintenance seats. |
| IND-SEAT-006 | Sold seats must remain attached to booking/order history. | Partial | `ShowtimeSeat.bookingId` exists. | Integrate booking confirmation event/API to mark `SOLD`. |

### 6. Cinema Room Operations

| BR ID | Industry Business Rule | Current Status | Evidence In Project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-ROOM-001 | Room capacity must be controlled by room type/layout. | Covered | `RoomType.getMaxSeats`, `SEAT_QUANTITY_EXCEEDS_LIMIT`. | Keep. Add tests. |
| IND-ROOM-002 | Room maintenance should make room unavailable. | Covered/Partial | `reportMaintenance()` sets `TEMPORARILY_UNAVAILABLE`. | Also block new showtimes and flag future showtimes for action. |
| IND-ROOM-003 | Resolving maintenance should restore room only when all open issues are resolved. | Partial | `resolveMaintenance()` checks open maintenance records. | Review boolean naming/logic carefully in MR. |
| IND-ROOM-004 | Existing future showtimes in a broken room need cancellation/reassignment workflow. | Gap | No reassignment workflow. | Backlog/Plan: room maintenance impact report. |

### 7. Content And Asset Quality

| BR ID | Industry Business Rule | Current Status | Evidence In Project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-ASSET-001 | Customer-facing movie should have poster/thumbnail. | Partial | Fields exist; upload validation exists. | Require before approval/public release. |
| IND-ASSET-002 | Multiple images are useful for carousel/gallery. | Covered/Partial | `MovieImage` exists. | Ensure display order and type/purpose are in API/UI. |
| IND-ASSET-003 | Trailer URL should be validated. | Gap/Partial | `trailerUrl` field exists. | Add URL validation; optionally YouTube/Vimeo allowlist. |
| IND-ASSET-004 | Image upload should limit type/size. | Covered | JPG/PNG/WebP and 5 MB limit. | Keep; document Cloudinary limits. |

### 8. Search, Discovery, And Display

| BR ID | Industry Business Rule | Current Status | Evidence In Project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-DISC-001 | Customers filter by status: now showing / coming soon. | Partial | Status model exists. | Ensure customer APIs expose clear status filters. |
| IND-DISC-002 | Customers filter by genre/date/cinema. | Partial | Movie filters exist; showtime endpoints exist. | Plan combined discovery API if UI needs it. |
| IND-DISC-003 | Movie detail should show cast/director, language, subtitles, age rating, duration. | Partial | Data exists across Movie/Cast/ShowTime. | Ensure response DTO exposes fields consistently. |
| IND-DISC-004 | Search should support localized title. | Partial | Translations exist. | Add search by `movie_translation.title` if not implemented. |

### 9. Audit, Compliance, And Admin Workflow

| BR ID | Industry Business Rule | Current Status | Evidence In Project | Recommended Action |
| --- | --- | --- | --- | --- |
| IND-AUD-001 | Publish/reject/suspend/end actions must be audited. | Partial | `MovieActionLog`, `AuditLogService`; some create logs. | Add logs in every status transition method. |
| IND-AUD-002 | Showtime cancel/open-sale should be audited. | Gap/Partial | Showtime fields exist; no clear transition APIs. | Implement explicit APIs first, then audit. |
| IND-AUD-003 | Admin should not self-approve sensitive changes if team workflow forbids it. | Process Gap | MR process docs exist outside movie-service. | Enforce via GitLab workflow, not service code. |
| IND-AUD-004 | External import source should be traceable. | Partial | `tmdb_id`, `imdb_id` exist. | Add `imported_from`, `imported_at`, `last_synced_at` if sync becomes a feature. |

## Recommended Plan By Priority

### Must Plan / Implement Soon

These are the most important gaps for a realistic cinema system:

1. Approval completeness check before public release.
2. Public detail filtering for non-public movie statuses.
3. Block showtime creation for inactive/maintenance/closed rooms.
4. Block showtime creation/open-sale for movies not ready for sale.
5. Explicit showtime cancel API with reason, actor, timestamp, and seat impact.
6. Single source of truth for seat lock and sold state between movie-service and booking-service.
7. Audit all movie/showtime status transitions.

### Should Plan After Core Flow Is Stable

1. Refund/cancellation policy model shared with booking-service.
2. Showtime-specific policy for special events/private screenings.
3. Search by localized title and cast/person.
4. Stronger age-rating enforcement with booking/user-service.
5. Price formula for format surcharge and seat type surcharge.

### Can Backlog

1. Parental accompaniment modeling.
2. Very-young-child admission restrictions by rating/time.
3. Room reassignment workflow for maintenance incidents.
4. TMDB re-sync and data freshness workflow.
5. Advanced dynamic pricing or demand-based pricing.

## Suggested Issues To Create

### Issue 1 - Enforce Movie Approval Readiness

Type: Backend

Priority: High

Business value: Prevent incomplete movies from becoming visible to customers.

Acceptance criteria:

- `approveMovie` rejects movies missing required fields.
- Required fields: duration, at least one genre, at least one format, at least one translation, poster/thumbnail, age rating.
- Rejection returns a business error code, not generic 500.
- Unit tests cover missing required fields and successful approval.

### Issue 2 - Protect Public Movie Detail Endpoint

Type: Backend

Priority: High

Business value: Customers must not access draft/rejected/suspended/ended movies by direct URL.

Acceptance criteria:

- Public detail endpoint returns only `COMING_SOON` or `NOW_SHOWING`.
- Admin detail endpoint can still see all statuses.
- Tests cover direct access to `DRAFT`, `REJECTED`, `SUSPENDED`, `ENDED`.

### Issue 3 - Block Showtime Scheduling For Unavailable Rooms

Type: Backend

Priority: High

Business value: Prevent scheduling screenings in rooms under maintenance or closed.

Acceptance criteria:

- Create/update showtime rejects rooms not `ACTIVE`.
- Error response uses movie-service business error code.
- Tests cover `MAINTENANCE`, `TEMPORARILY_UNAVAILABLE`, `CLOSED`.

### Issue 4 - Add Showtime Cancel Workflow

Type: Backend

Priority: High

Business value: Real cinemas cancel showtimes with traceable reason instead of deleting business records.

Acceptance criteria:

- Add API to cancel showtime.
- Store `cancellation_reason`, `cancelled_at`, `cancelled_by`.
- Cancelled showtime is hidden from customer sellable list.
- Related showtime seats become `CANCELLED` or unavailable.
- Audit log is written.

### Issue 5 - Define Seat Inventory Contract With Booking-Service

Type: Backend / Integration

Priority: High

Business value: Prevent double-selling seats and inconsistent prices.

Acceptance criteria:

- Document which service owns seat lock TTL.
- Document how booking confirmation updates `ShowtimeSeat` to `SOLD`.
- Document how cancellation releases or cancels seats.
- Update API contract docs.

## Notes For Team Planning

- Do not implement every industry rule immediately. The most valuable rules are the ones that protect public visibility, showtime correctness, and seat revenue.
- Age-rating enforcement is important, but it is cross-service: movie-service stores rating; booking/user/employee flows enforce it.
- Refund/exchange policy is mostly booking/payment-service, but movie-service must provide accurate showtime status and cutoff metadata if the business wants automated refunds.
- Special events and private screenings should be separate backlog unless the product owner confirms this is in scope.

