# Cinema Room Business Rules (Wizard / Layout Versioning)

> Scope: rules added for the Cinema Room creation wizard and versioned seat
> layout. Follows the priority legend and ID convention from
> [`MOVIE_SERVICE_BUSINESS_RULES.md`](./MOVIE_SERVICE_BUSINESS_RULES.md)
> (`ROOM-Pn-xxx` continues that document's `ROOM-P0-001`/`ROOM-P1-002`
> numbering; new IDs here start at `ROOM-P0-003` / `ROOM-P1-003` and a new
> `LAYOUT-Pn-xxx` series covers the layout entity specifically).

## Room Rules

### ROOM-P0-003 — Room Code And Name Are Unique Per Cluster, Not Globally

Business reason: multiple clusters legitimately have a "Room 1" / "R01" — chain
operators number rooms per-site, not chain-wide.

Rules:

- `roomCode` is trimmed and uppercased server-side before uniqueness checks and
  persistence (`CinemaRoomService.normalizeRoomCode`).
- `UNIQUE(cluster_id, room_code)` and the pre-existing `UNIQUE(cluster_id,
  cinema_room_name)` are both scoped to the cluster (partial unique index for
  `room_code` since legacy rooms leave it `NULL`).
- Violating either returns `ROOM_CODE_ALREADY_EXISTS` (2058) /
  `CINEMA_ROOM_NAME_EXISTED` (2004).

Current code reference: `CinemaRoomRepository.existsByCluster_ClusterIdAndRoomCode*`,
`CinemaRoomService.createWizardRoom`/`updateRoom`.

### ROOM-P0-004 — Physical And Screen Dimensions Must Be Sane

Business reason: garbage dimensions make area/aspect-ratio calculations
meaningless and can hide data-entry mistakes.

Rules:

- `lengthM`, `widthM`, `clearHeightM` must be `> 0` (`ROOM_DIMENSION_INVALID`,
  2062).
- `screenWidthM` must not exceed `widthM`; `screenHeightM` must not exceed
  `clearHeightM` (`ROOM_SCREEN_EXCEEDS_ROOM_DIMENSIONS`, 2052). Checked on both
  create and every partial update, using whichever room-width/clear-height
  value is on record after the update is applied.
- No hard-coded per-auditorium-class seat/size caps are introduced — dimension
  validation is purely "sane physical values", never a disguised business rule
  like "IMAX max 300 seats".

Current code reference: `CinemaRoomService.validatePositiveDimension`,
`validateScreenFitsRoom`.

### ROOM-P0-005 — `roomType` Must Not Dictate Seat-Type Ratios For Wizard Rooms

Business reason: the whole point of this feature is decoupling "phân hạng
phòng" from a hard-coded seat mix. The legacy `RoomType` enum
(`STANDARD`/`LARGE`/`IMAX`) carried a `maxSeats` ceiling and implied
seatsPerRow default — that coupling stays *only* on the legacy quick-create
path.

Rules:

- Wizard-created rooms still populate the (`NOT NULL`) `room_type` column with
  a placeholder (`STANDARD`) purely for schema compatibility — it is never read
  to constrain layout authoring.
- The real "phân hạng dịch vụ" for wizard rooms is `auditoriumClassId`, a
  master-data foreign key used for display, filtering and commercial reporting.
  It has no capacity or seat-mix semantics attached (see `LAYOUT-P1-002` below
  for master-data rules).
- Active service tiers are `STANDARD`, `PREMIUM`, `LUXURY` and `PRIVATE`.
- `PLF` is a presentation capability and `MOTION` is a seat/experience
  capability. They must not be offered as auditorium service tiers.
- A service tier may suggest a UI template in the future, but applying such a
  template must remain an explicit user choice and its generated layout stays
  fully editable before submission.

Current code reference: `CinemaRoomService.createWizardRoom` (hard-codes
`roomType = RoomType.STANDARD`), `AuditoriumClass` entity.

### ROOM-P1-003 — Room Details Are Only Editable While DRAFT

Business reason: once a layout has been submitted for approval, the room's
physical/technical facts (dimensions, screen size) should not silently change
underneath a pending approval.

Rules:

- `PUT /api/cinema-rooms/{roomId}` (step 1/2 fields) is rejected with
  `ROOM_NOT_DRAFT` (2059) unless `CinemaRoomStatus == DRAFT`.
- Partial updates are allowed while `DRAFT` — every field on
  `CinemaRoomUpdateRequest` is optional, since the wizard autosaves progress
  step by step ("Lưu bản nháp").

Current code reference: `CinemaRoomService.updateRoom`.

## Layout Rules

### LAYOUT-P0-001 — A Layout Position Is Either A Seat Or It Isn't

Business reason: `AISLE`/`EXIT`/`EMPTY_SPACE` cells must never accidentally
carry stale seat data (e.g. a seat that was "deleted" by re-typing the cell but
left its old seatCode behind), and `SEAT` cells must never be missing the data
needed to sell them.

Rules:

- `positionType = SEAT` ⇒ `seatNumber`, `seatCode`, `seatType` all required.
- `positionType != SEAT` ⇒ `seatNumber`, `seatCode`, `seatType`, `seatGroupId`
  must all be `null`.
- Enforced twice: a DB `CHECK` constraint (`chk_position_seat_fields`, the
  backstop) and application validation before every save
  (`RoomLayoutService.validateIncomingPositions`,
  `ROOM_LAYOUT_POSITION_FIELDS_INVALID`, 2060).

### LAYOUT-P0-002 — Couple Seats Are An Atomic Pair, Never A Singleton

Business reason: a "half a couple seat" is unsellable and a booking-UI/pricing
bug waiting to happen.

Rules:

- Every `seatGroupId` used by a `COUPLE`-type position must appear on **exactly
  2** positions (`ROOM_LAYOUT_COUPLE_GROUP_INVALID`, 2049).
- Those 2 positions must be in the **same row** and have **adjacent**
  `columnIndex` values (`|c1 - c2| == 1`).
- Re-checked at both save time (`validateIncomingPositions`) and submit time
  (`validateStoredPositions`, defense in depth against any path that could
  bypass save-time validation).
- Capacity counts a couple group once (2 people, 1 sellable unit) — see
  `LAYOUT-P1-001`.

Current code reference: `RoomLayoutService.validateIncomingPositions`,
`validateStoredPositions`.

### LAYOUT-P0-003 — No Duplicate Coordinates Or Seat Codes Within A Layout

Rules:

- `(rowIndex, columnIndex)` must be unique within a layout
  (`ROOM_LAYOUT_POSITION_DUPLICATE_COORDINATE`, 2047) — DB backstop:
  `uq_layout_coordinate`.
- `seatCode` must be unique within a layout when present
  (`ROOM_LAYOUT_POSITION_DUPLICATE_SEAT_CODE`, 2048) — DB backstop:
  `uq_layout_seat_code` (partial, `WHERE seat_code IS NOT NULL`).

### LAYOUT-P0-004 — Capacity Is Always Backend-Derived

Business reason: a client bug or a stale cached value must never let a room
advertise more capacity than its actual seat map supports.

Rules:

- `personCapacity` and `sellableUnitCount` are recomputed from the persisted
  position set on every save (`RoomLayoutService.recomputeCapacity`) —
  whatever the client sends for these fields (there is no such field on the
  request DTO at all) is irrelevant.
- The frontend's live stats panel is explicitly labeled an estimate.

### LAYOUT-P0-005 — Cannot Submit An Empty Or Invalid Layout

Rules:

- `submit` on a layout with zero positions is rejected (`ROOM_LAYOUT_EMPTY`,
  2050).
- `submit` re-validates every couple group from the persisted rows (not just
  trusting the last successful save), rejecting with
  `ROOM_LAYOUT_COUPLE_GROUP_INVALID` if corrupted.

### LAYOUT-P0-006 — Approved/Active Layouts Are Immutable; Changes Require A New Version

Rules:

- `PUT .../layouts/{layoutId}` on anything but a `DRAFT` layout is rejected
  (`ROOM_LAYOUT_NOT_EDITABLE`, 2046).
- To change an `APPROVED`/`ACTIVE`/`REJECTED`/`SUPERSEDED` layout, clone it —
  `clone` creates `version = max(version) + 1` as a new `DRAFT`, copying all
  positions. `clone` on a `DRAFT` or `PENDING_APPROVAL` source is rejected
  (`ROOM_LAYOUT_INVALID_TRANSITION`) — there's no reason to clone a version
  that's already editable or already mid-review.
- Old versions are retained forever (never deleted) for audit.

### LAYOUT-P0-007 — Activation Must Not Silently Corrupt An Already-Booked Seat's Identity

Business reason: `ShowtimeSeat` snapshots a `Seat` by FK
(`SEAT-P0-001` in `MOVIE_SERVICE_BUSINESS_RULES.md`). If activation ever
reassigned an existing `Seat.id` to a *different* physical position, an
already-sold ticket would silently start pointing at the wrong seat.

Rules:

- Seat-sync at activation matches existing `Seat` rows to new layout positions
  by `(rowLabel, colNumber)`, where `colNumber` is derived from the position's
  own **physical `columnIndex`**, not a re-derived "nth seat in row" count —
  see [`CINEMA_ROOM_CREATION_FLOW.md` §6](./CINEMA_ROOM_CREATION_FLOW.md#6-seat-table-sync-on-activation)
  for why a sequential count is unsafe here.
- A `Seat` whose coordinate disappears from the new layout is **soft-retired**
  (`status = INACTIVE`), never deleted — `ShowtimeSeat` FKs stay valid forever.
- Covered by `CinemaRoomLayoutWizardIntegrationTest` (backend), which
  activates a layout, attaches a real `ShowtimeSeat` to one of its seats,
  activates a second version that drops that seat, and asserts the seat is
  retired (not deleted) and the `ShowtimeSeat`'s FK is unchanged.

### LAYOUT-P0-008 — Activation Is Blocked While The Room Has Future Showtimes On A Different Version

Business reason: swapping the operating layout out from under an already
on-sale showtime would invalidate whatever seat map the customer saw at
booking time.

Rules:

- If the room already has an `ACTIVE` layout and any `ShowTime` for that room
  is `SCHEDULED` or `ON_SALE` with `showDate >= today`, activating a
  *different* version is rejected (`ROOM_LAYOUT_HAS_FUTURE_SHOWTIMES`, 2051).
- First-ever activation (no prior `ACTIVE` layout) is always allowed — no
  showtime could reference a room that never had an active seat map.
- This is a deliberately simple **block-outright** policy, not a partial
  compatibility check — see [scope cuts](#scope-cuts-out-of-scope-this-sprint).

### LAYOUT-P1-001 — Capacity Formula

| Seat type | Person capacity | Sellable units |
|---|---|---|
| `STANDARD` | 1 | 1 |
| `VIP` | 1 | 1 |
| `ACCESSIBLE` (wheelchair) | 1 | 1 |
| `COUPLE` (per group, not per position) | 2 | 1 |
| `AISLE` / `EXIT` / `EMPTY_SPACE` | 0 | 0 |

### LAYOUT-P1-002 — Master Data, Not Enums, For Configurable Dimensions

Business reason: auditorium class, projection technology, resolution, and
audio format are catalog data an operator should be able to extend without a
code deploy — unlike `SeatType`/`LayoutPositionType`/`LayoutStatus`, which are
stable values tied directly to business logic (capacity math, state machine
transitions) and stay Java enums.

Rules:

- `auditorium_class`, `projection_technology`, `resolution`, `audio_format`
  are real tables (mirroring the existing `age_rating`/`screening_format`
  pattern), seeded via migration `V18`.
- Referenced by ID from `cinema_room`; must exist and be `active = true`
  (`AUDITORIUM_CLASS_NOT_FOUND` 2053 / `PROJECTION_TECHNOLOGY_NOT_FOUND` 2054 /
  `RESOLUTION_NOT_FOUND` 2055 / `AUDIO_FORMAT_NOT_FOUND` 2056).
- Frontend never hardcodes these lists — `GET /api/cinema-room-master-data` is
  the single source, consumed by the wizard's dropdowns.
- Admin CRUD for these 4 tables is out of scope this sprint (see below) —
  they're migration-seeded only.

## Scope Cuts (Out Of Scope This Sprint)

Documented explicitly so they're a deliberate decision, not a gap discovered
later:

1. No `AccessibilityType` enum — wheelchair spaces reuse the existing
   `SeatType.ACCESSIBLE`, avoiding a duplicate concept.
2. No admin CRUD UI/endpoints for the 4 new master-data tables — read-only via
   the aggregate endpoint, seeded by migration.
3. Seat-editor multi-select is click / Ctrl-click / Shift-click-range / row-select
   — not free-form rectangular drag-marquee.
4. Layout activation blocks outright on any future scheduled/on-sale
   showtime — no partial-compatibility reconciliation (e.g. "only the removed
   seats are unsellable, the rest can proceed") is attempted.
5. No "ADMIN create = instantly ACTIVE" shortcut for rooms (unlike clusters,
   where `POST /api/cinema-clusters` self-approves for ADMIN). An ADMIN reaches
   the same end state by chaining submit → approve → activate, which they
   already have permission to do — just not in one call.
6. No admin CRUD for master data (auditorium class, projection technology,
   resolution, audio format) beyond migration seeding.
