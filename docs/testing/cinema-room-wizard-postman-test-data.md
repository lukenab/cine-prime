# Cinema Room Wizard — Postman Manual Test Guide

Companion to [`cinema-cluster-room-sample-data.md`](./cinema-cluster-room-sample-data.md)
(legacy quick-create flow) — this file covers the new wizard/layout-versioning
endpoints added in [`CINEMA_ROOM_CREATION_FLOW.md`](../CINEMA_ROOM_CREATION_FLOW.md).
Assumes movie-service running on `http://localhost:8081` (direct) or
`http://localhost:8080` (via API Gateway), an `ADMIN` and an `EMPLOYEE` JWT in
the `Authorization: Bearer <token>` header for the relevant requests, and an
existing `ACTIVE` cinema cluster (see the companion doc for how to create one).

Look up real `auditoriumClassId`/`projectionTechnologyId`/`resolutionId`/`audioFormatId`
values first:

```http
GET /api/cinema-room-master-data
```

(No auth required. `auditoriumClasses` only returns active commercial service
tiers: `STANDARD`, `PREMIUM`, `LUXURY`, `PRIVATE`. `PLF` and `MOTION` are not
service tiers and are inactive after migration `V19`. IDs are database-generated,
so always confirm them from the live response instead of assuming fixed values.)

---

## 1. Create a valid DRAFT room (Step 1)

```http
POST /api/cinema-rooms
Authorization: Bearer <EMPLOYEE token>
Content-Type: application/json

{
  "cinemaRoomName": "Room W1",
  "wizardMode": true,
  "roomCode": "r01",
  "clusterId": 1,
  "auditoriumClassId": 1,
  "lengthM": 20,
  "widthM": 15,
  "clearHeightM": 6,

  "roomType": "STANDARD",
  "numberOfRows": 1,
  "seatsPerRow": 1,
  "standardRowCount": 1,
  "vipRowCount": 0,
  "coupleRowCount": 0,
  "defaultPrice": 1
}
```

Expected: `200`, `result.status = "DRAFT"`, `result.roomCode = "R01"` (trimmed +
uppercased), `result.activeLayout.version = 1`, `result.activeLayout.status =
"DRAFT"`. Note the `cinemaRoomId` and `activeLayout.roomLayoutId` — needed for
every request below. The `roomType`/`numberOfRows`/.../`defaultPrice` fields
are required by the shared DTO but ignored server-side in wizard mode — send
exactly these placeholder values.

## 2. Duplicate room code in the same cluster

Repeat request 1 with the same `clusterId` + `roomCode` (any case — it's
normalized before comparing).

Expected: `409`, error code `ROOM_CODE_ALREADY_EXISTS` (2058).

## 3. Zero / negative dimensions

```json
{
  "cinemaRoomName": "Room W2", "wizardMode": true, "roomCode": "R02", "clusterId": 1,
  "auditoriumClassId": 1, "lengthM": 0, "widthM": 15, "clearHeightM": 6,
  "roomType": "STANDARD", "numberOfRows": 1, "seatsPerRow": 1,
  "standardRowCount": 1, "vipRowCount": 0, "coupleRowCount": 0, "defaultPrice": 1
}
```

Expected: `400`, error code `ROOM_DIMENSION_INVALID` (2062). Same result for a
negative value or for `widthM`/`clearHeightM` = 0.

## 4. Screen larger than the room (Step 2, after request 1 succeeds)

```http
PUT /api/cinema-rooms/{roomId}
Authorization: Bearer <EMPLOYEE token>
Content-Type: application/json

{
  "screenWidthM": 30,
  "screenHeightM": 5
}
```

Expected: `400`, error code `ROOM_SCREEN_EXCEEDS_ROOM_DIMENSIONS` (2052) — room
width from Step 1 was `15`, screen width `30` exceeds it.

## 5. Valid Standard/VIP/Couple layout (Step 3)

```http
PUT /api/cinema-rooms/{roomId}/layouts/{layoutId}
Authorization: Bearer <EMPLOYEE token>
Content-Type: application/json

{
  "numberOfRows": 2,
  "maxPositionsPerRow": 4,
  "firstRowLabel": "A",
  "numberingDirection": "LEFT_TO_RIGHT",
  "positions": [
    { "rowIndex": 0, "columnIndex": 0, "rowLabel": "A", "positionType": "SEAT", "seatNumber": 1, "seatCode": "A1", "seatType": "STANDARD" },
    { "rowIndex": 0, "columnIndex": 1, "rowLabel": "A", "positionType": "SEAT", "seatNumber": 2, "seatCode": "A2", "seatType": "STANDARD" },
    { "rowIndex": 0, "columnIndex": 2, "rowLabel": "A", "positionType": "AISLE" },
    { "rowIndex": 0, "columnIndex": 3, "rowLabel": "A", "positionType": "EXIT" },
    { "rowIndex": 1, "columnIndex": 0, "rowLabel": "B", "positionType": "SEAT", "seatNumber": 1, "seatCode": "B1", "seatType": "VIP" },
    { "rowIndex": 1, "columnIndex": 1, "rowLabel": "B", "positionType": "SEAT", "seatNumber": 2, "seatCode": "B2", "seatType": "COUPLE", "seatGroupId": "couple-b1" },
    { "rowIndex": 1, "columnIndex": 2, "rowLabel": "B", "positionType": "SEAT", "seatNumber": 3, "seatCode": "B3", "seatType": "COUPLE", "seatGroupId": "couple-b1" },
    { "rowIndex": 1, "columnIndex": 3, "rowLabel": "B", "positionType": "EMPTY_SPACE" }
  ]
}
```

Expected: `200`, `result.personCapacity = 5` (2 standard + 1 VIP + 2 from the
couple group), `result.sellableUnitCount = 4` (2 standard + 1 VIP + 1 couple
unit).

## 6. Duplicate coordinate

Same body as request 5, but change the last position's `rowIndex`/`columnIndex`
to `1`/`2` (colliding with the couple seat's second half).

Expected: `400`, error code `ROOM_LAYOUT_POSITION_DUPLICATE_COORDINATE` (2047).

## 7. Couple seat missing its other half

Take request 5's body and change `B3`'s `seatGroupId` to a *different* value
than `B2` (e.g. `"couple-b2"`), or delete the `B3` position entirely so
`"couple-b1"` only appears once.

Expected: `400`, error code `ROOM_LAYOUT_COUPLE_GROUP_INVALID` (2049).

## 8. Submit → Approve → Reject → Activate

```http
POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/submit
Authorization: Bearer <EMPLOYEE token>
```

Expected: `200`, `result.status = "PENDING_APPROVAL"`. Submitting again (or
submitting an empty layout) returns `ROOM_LAYOUT_INVALID_TRANSITION` (2045) /
`ROOM_LAYOUT_EMPTY` (2050) respectively.

```http
POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/reject
Authorization: Bearer <ADMIN token>
Content-Type: application/json

{ "note": "Move the exit further from the couple row." }
```

Expected: `200`, `result.status = "DRAFT"`, `result.rejectionReason` set. Trying
this as an `EMPLOYEE` token returns `403`.

Re-submit (request 8's first call again), then:

```http
POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/approve
Authorization: Bearer <ADMIN token>
```

Expected: `200`, `result.status = "APPROVED"`.

```http
POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/activate
Authorization: Bearer <ADMIN token>
```

Expected: `200`, `result.status = "ACTIVE"`. Follow up with
`GET /api/cinema-rooms/{roomId}/seats` — should show 4 `Seat` rows (2 STANDARD,
1 VIP, 1 COUPLE with a `seatGroupId`), matching `sellableUnitCount` from step 5.

## 9. Clone an activated layout, then re-activate

```http
POST /api/cinema-rooms/{roomId}/layouts/{layoutId}/clone
Authorization: Bearer <EMPLOYEE token>
```

Expected: `201`, `result.version = 2`, `result.status = "DRAFT"`, positions
copied from version 1. Editing/submitting/approving/activating this new
version follows the same steps as above; once activated, version 1 flips to
`SUPERSEDED` and version 2 becomes the room's `ACTIVE` layout.

## 10. Activation blocked by a future showtime

With version 1 `ACTIVE` (from step 8) and a real `SCHEDULED`/`ON_SALE`
`ShowTime` created against this room for today or later (via
`POST /api/schedules`), submit + approve a new layout version, then call
`activate` on it.

Expected: `409`, error code `ROOM_LAYOUT_HAS_FUTURE_SHOWTIMES` (2051).
