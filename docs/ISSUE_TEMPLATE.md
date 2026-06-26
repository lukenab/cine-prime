# GitLab Issue Template — HCM26_CPL_JAVA_05_Group1

## Title Format

```
[Layer] Short imperative description of the task
```

**Layer options:**
- `[Frontend]` — UI/UX, React components, pages, API integration
- `[Backend]` — Spring Boot services, REST API, business logic
- `[Database]` — Schema design, migrations, seed data
- `[Infra]` — Docker, Kafka, Redis, API Gateway, CI/CD
- `[Docs]` — API specs, diagrams, SRS, README

**Examples:**
```
[Frontend] Implement Booking & Ticket Management UI
[Frontend] Build Edit Movie UI and Integrate PUT API
[Backend] Implement POST /api/bookings endpoint with seat locking
[Database] Add showtime_seat table and seed data for Sprint 2
[Docs] Write API contract for booking-service
```

---

## Labels

Always pick **one from each group** that applies:

| Group | Labels | When to use |
|---|---|---|
| **Layer** | `Layer::Frontend` / `Layer::Backend` / `Layer::Database` / `Layer::Infrastructure` | Which part of the system |
| **Type** | `Type::Feature` / `Type::Bug` / `Type::Chore` / `Type::Docs` | Nature of the work |
| **Priority** | `Priority::High` / `Priority::Medium` / `Priority::Low` | Impact and urgency |
| **Status** | `In Progress` / `Review/ QA` | Current state (update as work progresses) |

**Example label set for a new feature:**
```
Layer::Frontend, Type::Feature, Priority::Medium, In Progress
```

**Example label set for a bug fix:**
```
Layer::Backend, Type::Bug, Priority::High, In Progress
```

---

## Issue Body Template

Copy and fill in the sections below when creating a new issue.

```markdown
## Summary / Objective

<!-- Describe what needs to be done and why. 2–4 sentences. -->

---

## Estimate

- [ ] S (< 2h) / M (2–4h) / L (4–8h) / XL (> 1 day)

---

## Acceptance Criteria (Definition of Done)

- [ ] <!-- Specific, testable requirement 1 -->
- [ ] <!-- Specific, testable requirement 2 -->
- [ ] <!-- ... -->

---

## UI Reference / Mockup

<!-- Attach Figma link or screenshot of expected UI. Remove this section for Backend/Database issues. -->

---

## API Specifications (if applicable)

### API 1 — <Name>

| Field | Details |
|---|---|
| Method | `GET` / `POST` / `PUT` / `PATCH` / `DELETE` |
| Endpoint | `/api/...` |
| Description | ... |
| Auth Required | Yes / No |

**Request Body:**
```json
{}
```

**Response 200 OK:**
```json
{}
```

**Response (Error):**
```json
{}
```

---

## Technical Notes / Constraints

<!-- Anything the developer must know: patterns to follow, edge cases, dependencies. -->

---

## Related

- Branch: `feat/...` or `docs/...`
- Depends on: <!-- issue # or service name -->
- Docs: <!-- link to relevant spec file in /docs -->
```

---

## Branch Naming Convention

| Type | Format | Example |
|---|---|---|
| Feature | `feat/<short-description>` | `feat/admin-booking-management-ui` |
| Bug fix | `fix/<short-description>` | `fix/jwt-null-token-interceptor` |
| Docs | `docs/<short-description>` | `docs/booking-service-api-contract` |
| Chore | `chore/<short-description>` | `chore/seed-data-auth-service` |

---

## MR Description Template

When creating a Merge Request, use this structure:

```markdown
## Overview / Objective

<!-- What does this MR do and why? 2–3 sentences. -->

Related Issue: Closes #<issue-number>

---

## Changes Introduced

<!-- Break down by layer. Remove sections that don't apply. -->

**Controllers / Routes:**
- 

**Services / Logic:**
- 

**DTOs / Mappers / Components:**
- 

**Database / JPA / Migration:**
- 

**Exception Handling / Error Codes:**
- 

---

## Key Architectural Decisions

<!-- Explain non-obvious choices made. Why Set vs List? Why this pattern? -->
<!-- Remove this section if no significant decisions were made. -->

- 

---

## How to Test

<!-- Step-by-step for reviewer to manually verify. -->

1. 
2. 
3. 

---

## Checklist

**General**
- [ ] Code compiles, no errors
- [ ] No debug / console.log code left
- [ ] Follows project coding conventions

**Backend (if applicable)**
- [ ] No N+1 query issues (check Hibernate console output)
- [ ] Exception handling uses correct error codes
- [ ] Endpoints tested via Postman / API client
- [ ] API contract / Postman collection updated

**Frontend (if applicable)**
- [ ] Loading and error states handled
- [ ] axiosClient attaches Bearer token correctly (no "null"/"undefined")
- [ ] Tested on both dark and light mode

---

## Reviewer Notes

<!-- Anything specific the reviewer should pay close attention to. -->
<!-- E.g., JPA mappings, token expiry behavior, edge cases. -->

- 
```
