# Definition of Done (DoD)

**Team:** HCM26_CPL_JAVA_05 — Group 1 · **Last Updated:** 2026-07-04

A backlog item is **Done** only when every applicable box is checked. "Done" means shippable —
not "code written". This is the canonical DoD; the MR template in
[`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) embeds a short copy for convenience — keep them in sync.

## Universal (every item)
- [ ] Acceptance criteria on the issue are all met.
- [ ] Code follows [`../CODING_CONVENTION.md`](../CODING_CONVENTION.md) and is lint-free.
- [ ] No hardcoded secrets, credentials, or sensitive data.
- [ ] No leftover debug code, commented-out blocks, or `console.log` / stray logs.
- [ ] Git history clean; commits follow Conventional Commits (`<type>(<layer>): …`).
- [ ] Merge Request opened to `develop`, reviewed, and **approved** by a Reviewer/Leader (self-merge to protected branches is forbidden).
- [ ] Related issue linked (`Closes #<id>`).

## Backend
- [ ] Endpoint matches the agreed contract in [`../api-specs/`](../api-specs/) (request/response schema, status codes).
- [ ] Response uses the shared `ApiResponse<T>` envelope.
- [ ] Input validation + standardized error codes ([`../ERROR_CODE_CONVENTION.md`](../ERROR_CODE_CONVENTION.md)).
- [ ] Contract doc (`API_CONTRACT.md` + OpenAPI YAML) updated to match the implementation.
- [ ] Unit/integration tests for business rules and edge cases (concurrency tests where seat/lock logic is touched).

## Frontend
- [ ] UI integrated with the real backend API (not mock data) and handles all documented error codes.
- [ ] Loading, empty, and error states handled.
- [ ] Responsive and consistent with the existing design system (shadcn/ui).

## Database / Infra
- [ ] Schema changes reflected in `postgres-init/` and the ERD ([`../architecture/database-erd/`](../architecture/database-erd/)).
- [ ] Config is environment-driven (no hardcoded values that belong in `application.yml`).

## Evidence (attached to the MR)
- [ ] Test evidence attached — Postman screenshots for APIs, UI screenshots/recording for frontend.
- [ ] Manual test steps documented in the MR description.

## Sprint-level Done
- [ ] Feature demoed at the Sprint Review and validated against acceptance criteria (Sprint 2 retro action item #5).

## Related
- [`DEFINITION_OF_READY.md`](DEFINITION_OF_READY.md) · [`TEST_PLAN.md`](TEST_PLAN.md)
