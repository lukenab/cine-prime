# Definition of Ready (DoR)

**Team:** HCM26_CPL_JAVA_05 — Group 1 · **Last Updated:** 2026-07-04

A backlog item (issue / user story) may only be pulled into a Sprint when **every** box below is
checked. If an item is not Ready, it stays in the backlog and is refined first. This prevents
mid-sprint blockers and rework (see Sprint 2 retro action item #3).

## A story is Ready when…

- [ ] **Clear value statement** — written as *"As a `<role>`, I want `<goal>` so that `<benefit>`."*
- [ ] **Acceptance criteria defined** — specific and verifiable (Given/When/Then or a checklist). Not "works correctly".
- [ ] **Scoped to one layer where possible** and labeled: `Type::*`, `Layer::*`, `Priority::*` (see [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)).
- [ ] **Estimated** with an effort point (1, 2, 3, 5, 8, 13). Items > 8 must be split.
- [ ] **Dependencies identified** — blocking issues linked; required APIs/contracts exist or are stubbed.
- [ ] **API contract agreed** (for backend/frontend work) — request/response schema defined in [`../api-specs/`](../api-specs/) *before* coding starts.
- [ ] **Design available** (for UI work) — mockup, wireframe, or reference screen linked.
- [ ] **Test approach noted** — how will this be verified (manual steps, unit/integration test, Postman)?
- [ ] **No open questions** — anything ambiguous is resolved with the Team Leader before pulling in.

## Refinement cadence
- Backlog refinement happens **once per sprint** (mid-sprint), led by the Team Leader.
- The Product Backlog and Sprint Backlog are managed on the **GitLab Issues Board**; this file
  defines the *quality bar* an issue must meet to enter a sprint.

## Related
- [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md) — the exit criteria (mirror of this entry gate).
- [`ISSUE_TEMPLATE.md`](../issues/ISSUE_TEMPLATE.md) — issue structure that satisfies this DoR.
