# movie-service migration rollback policy

Flyway is configured with no automatic destructive "down" migration — there is no
`flyway undo` command wired into this project, and none should be added. Rolling back a
bad deploy is done the same way most teams using Flyway/versioned migrations in
production do it: **forward-fix, never automatically reverse.**

## Why not automatic down-migrations

- A `DROP COLUMN`/`DROP TABLE` "undo" script re-run against a database that already has
  new rows in that column is itself a destructive, data-losing operation — the fix would
  be as risky as the original bug.
- Flyway Community Edition (what this project uses — no `flyway-teams` / undo-migration
  feature) doesn't support undo migrations without the paid tier anyway.

## What to do instead when a migration needs to be rolled back

1. **If the application hasn't been deployed with the new migration yet**: just delete/fix
   the new `V{n}__*.sql` file before it ships. Nothing has run against a shared database,
   so there's nothing to roll back.

2. **If the migration already ran against a shared/production-like database**: never edit
   or delete that migration file (Flyway will refuse to run — checksum mismatch — the
   moment anyone else's local `flyway_schema_history` disagrees, which is the intended
   safety net). Instead:
   - Write a **new** forward migration (`V{n+1}__revert_x.sql`) that undoes the effect
     (re-add the dropped column, restore the previous constraint, etc.).
   - If data needs to be restored and can't be recomputed, restore it from the most recent
     `pg_dump` backup taken before the bad migration ran (this project's convention:
     `pg_dump --data-only --column-inserts` before any manual/production-affecting
     migration — see the working notes in `docs/database/movie-service/` history for
     examples).

3. **Application code must be backward-compatible with the schema for at least one
   deploy on each side of a migration.** Concretely:
   - Don't ship application code that requires a new column/table in the *same* deploy as
     the migration that creates it, if you might need to roll back the application without
     also rolling back the schema — write the code to tolerate the column being NULL /
     absent for at least one release, then tighten it in a later release once the
     migration is confirmed stable.
   - Conversely, don't have a migration `DROP COLUMN` something the *currently deployed*
     application version still reads/writes. Additive changes first, application code
     migrated off the old column next, drop the column only in a third, later migration —
     this project's `V28`→`V29`→`V30` sequence (add columns, backfill/tighten constraint,
     drop the old column) and `V18`→`V19`→`V31`→`V32` sequence (add `PLF`/`MOTION` rows,
     deactivate them, fix their text, delete them once nothing referenced them) are the
     precedent to follow for any future multi-step schema change.

4. **Rolling back the application version alone (no schema change) is always safe** as
   long as rule 3 was followed — the previous application version was already tested
   against the current (or an even older, backward-compatible) schema.
