# Team Working Agreement — HCM26_CPL_JAVA_05 Group 1

**Last Updated:** 2026-07-04 · A shared commitment on *how* we work together. Reviewed and adjusted at each retrospective.

---

## 1. Team & Roles
| Name | Role |
|------|------|
| Nguyễn An Bình | Team Leader / Developer |
| Diệp Đăng Khoa | Developer |
| Nguyễn Mạnh Khải | Developer |
| Lê Tấn Lộc | Developer |
| Trần Nhật Duy | Developer |

The Team Leader also acts as primary Reviewer and Scrum facilitator.

## 2. Scrum Cadence
| Ceremony | When | Purpose |
|----------|------|---------|
| Sprint Planning | Day 1 of a 2-week sprint | Commit to sprint goal & backlog; estimate stories |
| Daily Stand-up | Daily (async or sync) | Yesterday / today / blockers |
| Backlog Refinement | Mid-sprint | Keep the next sprint's items to [`DEFINITION_OF_READY.md`](DEFINITION_OF_READY.md) |
| Sprint Review / Demo | Last day | Demo the increment; validate against acceptance criteria — **mandatory** (Sprint 2 gap) |
| Retrospective | Last day | Inspect & adapt; output → [`retrospectives/`](retrospectives/) |

> Sprints run 2 weeks (see Sprint 2: 2026-06-18 → 2026-07-02).

## 3. Definition of Workflow
1. Pull a **Ready** issue from the GitLab board (must meet the DoR).
2. Branch off `develop` using the naming convention in [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).
3. Commit small, single-purpose commits (Conventional Commits).
4. Open a Merge Request to `develop`, attach test evidence, request review.
5. Address review comments; merge only after **Approve** (never self-merge to protected branches).
6. Item is Done only when it meets [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md).

## 4. Collaboration Norms
- **Contract-first:** agree the API schema in [`../api-specs/`](../api-specs/) before FE/BE start, so both sides work in parallel (Sprint 2 retro #2 — avoid response-envelope rework).
- **No blocking silently:** raise blockers within the same day, not at stand-up two days later.
- **Balanced workload:** no single member should own more than **35%** of a sprint's issues (Sprint 2 retro action #2 — one member carried 62.5%).
- **Knowledge sharing:** the author of a complex feature writes a short note in the relevant doc so others can maintain it.
- **Respectful review:** review the code, not the person; comment on the exact line; explain the "why".

## 5. Communication
- **Primary channel:** _<TODO: team chat link>_
- **Code & tasks:** GitLab (Issues Board, Merge Requests).
- **Docs:** everything reviewable lives as Markdown in [`../`](../) so changes are diff-able and comment-able.
- **Response expectation:** acknowledge review requests / @-mentions within _<TODO: e.g. 1 working day>_.

## 6. Quality Bar
- Follow [`../CODING_CONVENTION.md`](../CODING_CONVENTION.md) and [`../ERROR_CODE_CONVENTION.md`](../ERROR_CODE_CONVENTION.md).
- Every backend change keeps its contract doc + OpenAPI YAML in sync with the code.
- Test evidence is mandatory on every MR (see [`TEST_PLAN.md`](TEST_PLAN.md)).

## 7. Decision Making
- Technical decisions: propose in the MR or an issue; Team Leader breaks ties.
- Scope/priority changes mid-sprint: only with Team Leader agreement; record the change in the retro.

## 8. Amendments
This agreement is revisited every retrospective. Proposed changes are discussed and, if agreed,
committed via MR like any other doc.
