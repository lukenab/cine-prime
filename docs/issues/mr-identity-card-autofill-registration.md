# MR: [Frontend] Implement citizen ID autofill for registration

**Branch:** `feat/identity-card-autofill-registration` -> `develop`
**Related Issue:** Closes #<issue-number>

---

## Overview / Objective

Implement citizen ID (CCCD) autofill on the registration form to reduce manual input while keeping backend validation as the source of truth. The frontend parses the citizen ID locally for UX, pre-fills gender and birth year, and shows a non-blocking warning when the selected birth year differs from the citizen ID. The backend validates citizen ID structure during user profile creation/update without exposing a public parse endpoint.

Related Issue: Closes #<issue-number>

---

## Changes Introduced

**Controllers / Routes:**
- No new public endpoint added.
- `UserController` keeps existing `/api/users/check-existence` behavior focused on duplicate checks.

**Services / Logic:**
- Added `IdentityCardService` in `user-service` for backend citizen ID validation.
- Backend validates citizen ID structure in:
  - `UserService.createUserProfile(...)`
  - `UserService.updateUser(...)`
- Removed citizen ID validation from `checkUserExistence(...)` so the endpoint does not fail on partial/empty values outside its responsibility.
- `IdentityCardService.parse(...)` returns parsed internal data (`provinceCode`, `provinceName`, `gender`, `birthYear`) for future backend usage.
- `IdentityCardService.validate(...)` delegates to `parse(...)` and throws `AppException(ErrorCode.INVALID_INPUT)` on invalid citizen ID.

**DTOs / Mappers / Components:**
- Added `ParsedIdentityCard.java` for backend internal parsed citizen ID data.
- Added frontend parser utility:
  - `client/src/utils/identityCard.ts`
- Added frontend autofill hook:
  - `client/src/hooks/useIdentityCardAutofill.ts`
- Updated `RegisterPage.tsx`:
  - Citizen ID field shows green check icon when parsed successfully.
  - Date of Birth is split into `Day`, `Month`, and `Year` dropdowns.
  - Birth year is pre-filled from citizen ID.
  - Gender is pre-filled from citizen ID when empty.
  - User can still edit gender and full date of birth.
  - Birth year mismatch shows an English non-blocking warning.
- Updated `useRegister.ts`:
  - Stores `dobDay`, `dobMonth`, `dobYear`.
  - Builds `dateOfBirth` as `YYYY-MM-DD` before submit.
  - Validates complete and valid date before initiating registration.

**Database / JPA / Migration:**
- No database migration required.

**Exception Handling / Error Codes:**
- Reuses existing `ErrorCode.INVALID_INPUT` for invalid citizen ID structure.

---

## Key Architectural Decisions

- **Frontend local parsing instead of parse API:** Autofill is a UX concern, so parsing runs locally and avoids an extra network call on every citizen ID input.
- **Backend remains the gatekeeper:** User input can be manipulated outside the UI, so user-service validates citizen ID structure before profile creation/update.
- **No cross-validation for gender or birth year:** For the current cinema-booking scope, gender is self-identification and birth year mismatch should warn only. The backend does not block these cases.
- **Do not autofill address from province code:** The citizen ID province code is not the user's current address. The `address` field remains user-entered.
- **No success hint text:** A valid citizen ID only shows a green check icon to keep the form compact.

---

## How to Test

1. Start frontend:
   ```bash
   cd client
   npm run dev
   ```
2. Open registration page and enter a valid citizen ID, for example:
   ```text
   092206000442
   ```
3. Verify:
   - Green check icon appears beside Identity Card.
   - Gender is auto-filled.
   - Date of Birth year is auto-filled.
   - Day and Month remain empty.
   - No success hint text is shown.
4. Change the Date of Birth year to a different year.
5. Verify warning appears:
   ```text
   Birth year does not match the citizen ID. You can continue if your date of birth is correct.
   ```
6. Enter an invalid 12-digit citizen ID with an unknown province code.
7. Verify error appears:
   ```text
   Unable to read this citizen ID. Please check the 12 digits.
   ```
8. Submit registration with complete valid fields and verify the payload sends `dateOfBirth` as `YYYY-MM-DD`.
9. Build frontend:
   ```bash
   npm run build
   ```
10. Build backend user-service:
   ```bash
   cd server
   .\mvnw.cmd -pl user-service -am test -DskipTests
   ```

---

## Checklist

**General**
- [x] Code compiles, no errors
- [x] No debug / console.log code left
- [x] Follows project coding conventions

**Backend**
- [x] Exception handling uses correct error codes
- [x] No new public endpoint added for citizen ID parsing
- [x] Backend validates citizen ID before profile creation/update
- [ ] Endpoints tested via Postman / API client
- [ ] API contract / Postman collection updated

**Frontend**
- [x] Loading and error states handled
- [x] axiosClient attaches Bearer token correctly (no "null"/"undefined")
- [x] Registration form tested through `npm run build`
- [ ] Tested on both dark and light mode

---

## Reviewer Notes

- Pay attention to policy decisions:
  - Gender mismatch is allowed.
  - Birth year mismatch is warning-only.
  - Day/month must never be inferred from citizen ID.
- Citizen ID province code is not the same as current address, so it must not populate the `address` field.
- Frontend parsing is not a security boundary. Backend validation in `IdentityCardService` must remain in place.
