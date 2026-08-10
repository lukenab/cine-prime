# movie-service database migrations

**Source of truth for runtime migrations is:**

```
server/movie-service/src/main/resources/db/migration/
├── V1__baseline_schema.sql        (pure DDL — tables, indexes, constraints, triggers, function)
└── R__seed_reference_data.sql     (idempotent reference/seed data, re-run whenever it changes)
```

Flyway runs these automatically when movie-service starts (`spring.flyway.enabled: true`
in `application.yml`). `spring.jpa.hibernate.ddl-auto` stays `none` — Hibernate never
creates or alters schema; only Flyway does.

## The `V*.sql` files in this folder are historical and superseded

Every `V3__*.sql` through `V34__*.sql` file in this directory was a hand-authored
migration applied by hand (`docker exec ... psql`) before Flyway existed. They're kept
here for audit/history — to see *why* a column or table exists — but **do not apply them
manually anymore** and **do not add new ones here**. New schema or seed-data changes go
into a new `V{n}__description.sql` (schema) or into `R__seed_reference_data.sql`
(reference data) under `server/movie-service/src/main/resources/db/migration/`, following
normal Flyway rules: never edit a migration that has already run anywhere shared.

## Why V1 is one consolidated baseline instead of 30+ replayed versions

The natural-looking approach — turning each `V3..V34` file here into its own Flyway
version — turned out to be unsafe to do faithfully. Two problems:

1. **There's no real "V1/V2" migration file to build on.** `V3` onward assumes tables like
   `movie`, `cinema_room`, `seat`, `genre`, and the `set_updated_at()` function already
   exist, but those were never captured as their own numbered migration in this folder —
   they only exist fully-formed in `postgres-init/movie_db.sql`.
2. **`postgres-init/movie_db.sql` (the file that *does* have that base schema) is a
   hand-maintained CURRENT-STATE snapshot, not a preserved stack of historical diffs.**
   Over time it was directly edited to match the latest shape of things (e.g. `movie.status`
   and `movie.version` already reflect the *end state* after `V28`-`V30`, not what those
   columns looked like before those migrations ran). Reconstructing what the schema
   genuinely looked like immediately before `V3` from this file would mean manually
   reverse-engineering later changes back out — a good way to introduce a subtle,
   hard-to-notice mismatch between the "historical" migration and what was actually
   deployed.

Given that the live database itself was never migrated by Flyway (no
`flyway_schema_history` row existed before this change — see the app's own
`spring.flyway.baseline-on-migrate`/`baseline-version` config), there was no existing
Flyway history to preserve or stay compatible with. So `V1__baseline_schema.sql` is a
direct, verified port of `postgres-init/movie_db.sql` (the file that was already
confirmed to match the live, hand-migrated database exactly) — DDL only, with all seed
data moved to the repeatable `R__seed_reference_data.sql`. This is lower-risk and just as
correct as trying to replay history that the source file itself didn't preserve.

## Fresh vs. existing database

- **Fresh database** (no tables at all): Flyway finds no schema and no
  `flyway_schema_history` table, so it just runs `V1` then `R__seed_reference_data`
  from scratch, in order — like this project always used to, just via Flyway instead of a
  manually mounted `postgres-init/movie_db.sql` script.
- **Existing hand-migrated database** (already has the full V1-equivalent schema, e.g. the
  shared dev database this project has used all along): Flyway detects a non-empty schema
  with no history table and, because `baseline-on-migrate: true` /
  `baseline-version: 1` is set, inserts a single baseline row marking "V1 already applied"
  instead of re-running `CREATE TABLE` on tables that already exist. Any future `V2+`
  migration then applies normally on top.

## Rollback policy

Flyway has no destructive automatic "down" migration here — see
`docs/database/movie-service/ROLLBACK.md` for how a bad deploy is rolled back instead
(new forward-fixing migration + backward-compatible application code).
