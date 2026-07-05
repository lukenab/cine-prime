# CinePrime — Documentation Index

Central map of all project documentation. See the repo root [`../README.md`](../README.md) for
setup and the tech stack.

##  Agile & Process ([`agile/`](agile/))
| Doc | Purpose |
|-----|---------|
| [SRS.md](agile/SRS.md) | Software Requirements Specification — *what* the system must do |
| [DEFINITION_OF_READY.md](agile/DEFINITION_OF_READY.md) | Entry gate for a story to enter a sprint |
| [DEFINITION_OF_DONE.md](agile/DEFINITION_OF_DONE.md) | Exit criteria for a story to be "Done" |
| [TEST_PLAN.md](agile/TEST_PLAN.md) | Test levels, priority scenarios, entry/exit criteria |
| [TEAM_WORKING_AGREEMENT.md](agile/TEAM_WORKING_AGREEMENT.md) | Scrum cadence & collaboration norms |
| [retrospectives/](agile/retrospectives/) | Sprint 0 / 1 / 2 retrospectives |

##  Conventions & Contribution (repo root + `docs/`)
| Doc | Purpose |
|-----|---------|
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Branching, commits, MR process, MR templates (with embedded DoD) |
| [CODING_CONVENTION.md](CODING_CONVENTION.md) | Backend code conventions |
| [ERROR_CODE_CONVENTION.md](ERROR_CODE_CONVENTION.md) | Standardized error codes |
| [GIT_FLOW.md](GIT_FLOW.md) | Branch model & git workflow |
| [REVIEW_FLOW.md](REVIEW_FLOW.md) | How to check out a teammate's branch to review |
| [MR_REVIEW_PROCESS.md](MR_REVIEW_PROCESS.md) | MR review & approval process |
| [issues/ISSUE_TEMPLATE.md](issues/ISSUE_TEMPLATE.md) | GitLab issue template |

##  API Specifications ([`api-specs/`](api-specs/))
Each service has an `API_CONTRACT.md` (human-readable) + an OpenAPI `.yaml` (source of truth):
- [auth-service](api-specs/auth-service/) · [movie-service](api-specs/movie-service/) · [user-service](api-specs/user-service/) · [booking-service](api-specs/booking-service/)

##  Architecture ([`architecture/`](architecture/))
| Area | Location |
|------|----------|
| System design | [system-level/SYSTEM_DESIGN_SPRINT_1.md](architecture/system-level/SYSTEM_DESIGN_SPRINT_1.md) |
| Database ERDs | [database-erd/](architecture/database-erd/) |
| Kafka contract | [kafka/kafka-user-service-contract.md](architecture/kafka/kafka-user-service-contract.md) |
| Sequence diagrams | [sequence-diagram/](architecture/sequence-diagram/) |
| Architecture diagram | [architecture-diagram/](architecture/architecture-diagram/) |

##  Database ([`database/`](database/))
Per-service SQL schema snapshots: auth / movie / user / booking.

---

### Documentation rules
1. **Contract-first:** update the SRS / API contract *before* the code.
2. **Keep contracts in sync:** a backend MR that changes an endpoint must update its `API_CONTRACT.md` + YAML.
3. **Reviewable format:** prefer Markdown so changes are diff-able in MRs.
