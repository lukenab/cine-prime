# Draft MR — [Backend] Restrict hard deletion to unused Cinema Room drafts

**Suggested source branch:** `fix/room-draft-only-hard-delete`  
**Suggested labels:** `Layer::Backend`, `Type::Bug`, `Priority::High`, `Review/ QA`

## Overview / Objective

This MR replaces the previous permissive Cinema Room deletion behavior with a lifecycle-aware hard-delete policy. A room can now be permanently deleted only when it is an unused `DRAFT` that has never entered the approval or operational workflow; rooms with historical showtimes, submitted layouts, materialized seats, or maintenance history are preserved for audit and operational integrity.

The delete command now derives the actor and role from the verified Spring Security context, serializes deletion against layout lifecycle transitions with a pessimistic database lock, returns `204 No Content` on success, and exposes stable domain errors for forbidden and conflicting operations. The affected admin UI uses the same policy for action visibility and replaces native browser confirmation/alert behavior with the shared confirmation dialog and toast feedback.

Related Issue: Closes #203

---

## Changes Introduced

**Controllers / Routes:**

- Kept the canonical endpoint `DELETE /api/cinema-rooms/{id}`.
- Restricted the endpoint to authenticated `ROLE_ADMIN` or `ROLE_EMPLOYEE` actors.
- Passed the verified `Authentication` object to the service instead of accepting a client-supplied actor identity.
- Changed the successful response from an `ApiResponse` body to HTTP `204 No Content`.

**Services / Logic:**

- Reworked `CinemaRoomService.deleteCinemaRoom()` into one transactional hard-delete command.
- Allows deletion only when all conditions are satisfied:
  - room status is `DRAFT`;
  - actor is an ADMIN or the EMPLOYEE who created the draft;
  - no historical showtime exists, including completed or cancelled records;
  - every related layout remains a never-submitted `DRAFT`;
  - no layout has `submittedAt` or `approvedAt` history;
  - no operational `Seat` has been materialized;
  - no maintenance record exists.
- Deletes draft layouts and their draft positions in the same transaction before deleting the room.
- Removed the previous behavior that deleted materialized seats to make a room eligible for deletion.
- Records the permanent deletion with the verified actor and primary role instead of hard-coded `SYSTEM` / `Admin` values.
- Keeps operational rooms available for the separate suspension, maintenance, and retirement lifecycle rather than destroying their history.

**Concurrency Control:**

- Added `CinemaRoomRepository.findByIdForUpdate()` using `PESSIMISTIC_WRITE`.
- Uses the same room-level lock in layout `submit`, `approve`, `reject`, and `activate` transitions.
- Serializes delete against lifecycle commands so only one concurrent command can succeed.
- Keeps the room and its layout graph transactionally consistent: either the draft deletion wins, or the lifecycle transition wins.

**Repositories / Persistence:**

- Added `CinemaRoomMaintenanceRepository.existsByCinemaRoom_CinemaRoomId()`.
- Replaced destructive `SeatRepository.deleteByCinemaRoomCinemaRoomId()` usage with the non-mutating dependency check `existsByCinemaRoomCinemaRoomId()`.
- Added the locked room lookup to `CinemaRoomRepository`.
- Uses the existing room-layout ownership/cascade rules only for draft layout positions; operational seats and history are never purged to satisfy deletion preconditions.

**Frontend / Components:**

- Shows the Cinema Room delete action only when the room is `DRAFT` and the current actor is:
  - ADMIN; or
  - the EMPLOYEE whose username matches `room.createdBy`.
- Added `createdBy` to the normalized room response used by the UI.
- Replaced `window.confirm()` in the room delete flow with the shared `ConfirmDialog`.
- Added a busy state to `ConfirmDialog` to prevent double submission while DELETE is running.
- Displays backend domain messages through toast feedback and keeps the room in the table when deletion fails.
- Refreshes the room list and cluster statistics after a successful delete.
- Replaced the remaining native `alert()` in the affected Room Detail flow with toast feedback.

**Exception Handling / Error Codes:**

| Error | HTTP | Code | Meaning |
|---|---:|---:|---|
| `CINEMA_ROOM_NOT_FOUND` | 404 | `2003` | Room does not exist or was already deleted |
| `CINEMA_ROOM_HAS_SHOWTIMES` | 409 | `2028` | Room has historical showtime references |
| `CINEMA_ROOM_DELETE_NOT_ALLOWED` | 409 | `2082` | Room is not an unused, never-operated draft |
| `CINEMA_ROOM_DELETE_FORBIDDEN` | 403 | `2083` | Actor is neither ADMIN nor the draft creator EMPLOYEE |

**Tests / Documentation:**

- Added controller coverage for verified authentication delegation and the `204` response.
- Added service tests for:
  - ADMIN deleting an unused draft;
  - creator EMPLOYEE deleting their own draft;
  - a different EMPLOYEE or CUSTOMER being denied;
  - non-DRAFT room rejection;
  - historical showtime rejection;
  - previously submitted layout rejection even after returning to `DRAFT`;
  - materialized-seat rejection;
  - maintenance-history rejection;
  - audit actor sourced from the verified principal.
- Added a PostgreSQL/Testcontainers concurrency test for delete racing layout submit.
- Added the complete Postman/UI/manual verification flow to `docs/testing/cinema-cluster-room-flow-test-guide.md`.

---

## API Specifications

### Delete unused Cinema Room draft

| Field | Details |
|---|---|
| Method | `DELETE` |
| Endpoint | `/api/cinema-rooms/{id}` |
| Description | Permanently deletes only an unused Cinema Room draft that has never entered an operational workflow |
| Auth Required | Yes — ADMIN or the EMPLOYEE who created the draft |
| Request Body | None |

**Response — 204 No Content**

No response body.

**Response — 403 Forbidden**

```json
{
  "code": 2083,
  "message": "Only an ADMIN or the employee who created this draft cinema room can permanently delete it."
}
```

**Response — 409 Conflict: lifecycle/history gate**

```json
{
  "code": 2082,
  "message": "Only an unused DRAFT cinema room that has never entered an operational workflow can be permanently deleted."
}
```

**Response — 409 Conflict: showtime history**

```json
{
  "code": 2028,
  "message": "Cannot delete cinema room that still has showtimes."
}
```

---

## Key Architectural Decisions

- **Hard delete is a draft-cleanup operation, not an operational lifecycle command.** Once a room has entered approval or operations, suspension, maintenance, and retirement must preserve its seats, layouts, showtimes, and audit history.
- **Authorization is enforced twice.** Method-level security rejects unsupported roles at the controller boundary, while the service verifies ADMIN/draft-creator ownership as defense in depth.
- **Existence checks replace destructive cleanup.** Operational seats are blockers; they are not deleted merely to make the parent room deletable.
- **A rejected layout does not reset history.** A layout returned to `DRAFT` still has `submittedAt` history and therefore makes the room ineligible for hard deletion.
- **Room-level pessimistic locking is shared across destructive and lifecycle commands.** This avoids delete/submit races that could otherwise leave a submitted layout without its room or allow a delete after an operational transition.
- **Draft layout positions may be cascaded, operational history may not.** Only data owned exclusively by the never-submitted draft is removed.
- **Server policy is authoritative.** Frontend action visibility improves usability, but every precondition is revalidated transactionally by the backend.

---

## How to Test

### 1. Automated backend verification

Ensure Docker Desktop is running so the Testcontainers concurrency test is executed, then run from `server/`:

```powershell
.\mvnw.cmd -pl movie-service -am test
```

Current local verification:

- 186 tests passed.
- 0 tests failed.
- 10 Testcontainers tests were skipped when the Docker engine was unavailable.

The MR must not be considered concurrency-verified until the Docker-backed deletion race test runs successfully.

### 2. Automated frontend verification

From `client/`:

```powershell
npm test
npm run build
```

Current local verification:

- 160 frontend tests passed.
- Production build completed successfully.

### 3. Manual happy path — ADMIN

1. Create or select an `ACTIVE` Cinema Cluster.
2. Create a new Cinema Room; confirm the room is `DRAFT` and has no submitted layout, operational seats, showtimes, or maintenance records.
3. Call:

```http
DELETE /api/cinema-rooms/{roomId}
Authorization: Bearer {{adminToken}}
```

4. Confirm HTTP `204` with an empty body.
5. Call `GET /api/cinema-rooms/{roomId}` and confirm HTTP `404`, code `2003`.
6. Confirm the deletion audit contains the authenticated ADMIN username.

### 4. Manual happy path — creator EMPLOYEE

1. Create a room with `employeeToken`.
2. Delete it with the same token; expect HTTP `204`.
3. Create another room with `employeeToken` and attempt deletion with `otherEmployeeToken`; expect HTTP `403`, code `2083`.
4. Confirm the denied room remains unchanged.

### 5. Manual lifecycle/dependency gates

Create separate test rooms and verify:

| Scenario | Expected result |
|---|---|
| Room status is `PENDING_APPROVAL`, `APPROVED`, or `ACTIVE` | HTTP `409`, code `2082` |
| Layout was submitted then rejected back to `DRAFT` | HTTP `409`, code `2082` |
| Operational seats have been materialized | HTTP `409`, code `2082` |
| Maintenance history exists | HTTP `409`, code `2082` |
| Any showtime history exists, including cancelled/completed | HTTP `409`, code `2028` |
| Unknown or already-deleted room ID | HTTP `404`, code `2003` |

### 6. Manual UI verification

1. Open `/admin/clusters/{clusterId}`.
2. Confirm a DRAFT room shows the delete action only for ADMIN or the matching creator EMPLOYEE.
3. Confirm operational rooms do not expose hard delete.
4. Click delete and verify the custom modal explains that only unused drafts can be removed.
5. Confirm Cancel/Escape closes the dialog without issuing DELETE.
6. Confirm the action buttons are disabled while deletion is running, preventing duplicate requests.
7. Confirm success displays a toast and refreshes the room list plus cluster room/seat totals.
8. Trigger a backend `409`; confirm the domain error is shown through a toast and the room remains visible.
9. Verify no native `window.confirm()` or `alert()` appears in the affected cluster/room flow.

Full manual dataset and flow: `docs/testing/cinema-cluster-room-flow-test-guide.md`.

---

## Checklist

**General**

- [x] Code compiles without errors
- [x] No debug / console.log code added
- [x] Follows project coding conventions
- [x] Scope uses the existing canonical DELETE endpoint

**Backend**

- [x] Hard delete restricted to unused, never-operated DRAFT rooms
- [x] ADMIN/draft-creator authorization enforced using verified security context
- [x] Historical showtime, workflow, seat, and maintenance dependencies protected
- [x] Successful delete returns `204 No Content`
- [x] Stable domain errors used for forbidden/conflict/not-found outcomes
- [x] Pessimistic locking added for delete and layout transitions
- [x] Unit/controller tests added
- [ ] Docker-backed concurrency test executed in reviewer environment
- [ ] Endpoint manually verified via Postman against migrated Docker database
- [x] Manual test guide added

**Frontend**

- [x] Delete action visibility follows DRAFT and actor-ownership policy
- [x] Shared confirmation dialog replaces native browser confirmation
- [x] Busy state prevents duplicate delete requests
- [x] Success/error toast feedback implemented
- [x] Room list and cluster statistics refresh after success
- [x] Affected native alert replaced with toast
- [x] Frontend test suite passes
- [x] Production build succeeds
- [ ] Manually verified in both dark and light mode

---

## Reviewer Notes

- Pay particular attention to the ordering of checks inside the transaction: authorization and status are validated before dependency inspection, and no dependent operational data is deleted to force eligibility.
- Verify the employee ownership comparison uses the verified JWT username and the persisted `room.createdBy`; client-provided headers must not authorize deletion.
- Run the Testcontainers concurrency test with Docker enabled. The expected invariant is exactly one successful command when delete races layout submit.
- Confirm rejected layouts remain protected because `submittedAt` survives the transition back to `DRAFT`.
- `2028` remains the specific conflict for showtime history; `2082` represents all other lifecycle/dependency conflicts.
- Cinema Cluster hard-delete policy belongs to issue #202 and should be reviewed/staged separately from this room-focused MR.
