# CinePrime documentation

This directory contains durable project documentation. GitLab issues and merge requests are the source of truth for task status, implementation notes, and review history.

## Start here

- [Software Requirements Specification](agile/SRS.md)
- [Database design](DB_DESIGN.md)
- [Coding convention](CODING_CONVENTION.md)
- [Git flow](GIT_FLOW.md)
- [Test plan](agile/TEST_PLAN.md)

## Architecture and contracts

- `api-specs/` — human-readable API contracts and OpenAPI specifications.
- [Canonical domain events](architecture/kafka/CANONICAL_DOMAIN_EVENT_CONTRACT.md) — cross-service event envelope and idempotency rules.
- [Auth and user Kafka contract](architecture/kafka/kafka-user-service-contract.md).
- [Extended-demo authorization matrix](security/EXTENDED_DEMO_AUTHORIZATION_MATRIX.md).
- [Error-code convention](ERROR_CODE_CONVENTION.md) and [error-code reference](ERROR_CODES.md).

## Core feature documentation

Each core module uses the same durable document set: feature brief, business rules, API list, technical specification when needed, and demo script.

- `features/cinema-movie-management/` — movie import, content approval, cinema and room management.
- `features/showtime-management/` — release planning, screening versions, automatic scheduling, price-book demo data, and scheduling algorithm notes.
- `features/booking-service/` — seat holds, booking, concessions, promotion, payment, confirmation, refund, and customer flow.
- [Promotion manual testing guide](promotion-testing-guide.md).

## Database documentation

- `database/` contains schema references and historical database artifacts.
- Runtime Flyway migrations normally live under each service's `src/main/resources/db/migration` directory.
- Promotion-service is a current exception: its Maven build packages migrations from `database/promotion-service/`, so those files must not be moved or deleted without updating the build.
- Movie-service runtime migration details are documented in [database/movie-service/README.md](database/movie-service/README.md).

## Operations and quality

- `testing/` — durable manual and flow-level test guides.
- [Movie-service secret rotation](operations/MOVIE_SERVICE_SECRET_ROTATION.md).
- [Definition of Ready](agile/DEFINITION_OF_READY.md) and [Definition of Done](agile/DEFINITION_OF_DONE.md).
- [Merge request review process](MR_REVIEW_PROCESS.md).

## Documentation retention rules

1. Do not add per-issue or per-merge-request implementation notes here; keep them in GitLab.
2. Do not duplicate a feature under both `feature/` and `features/`; use `features/` only.
3. Update the API contract and OpenAPI file together when an endpoint changes.
4. Keep business rules independent from UI implementation details.
5. Remove deadline plans, gap snapshots, and implementation-status reports when their work is complete.
6. Never store secrets, real credentials, or local `.env` values in documentation.
