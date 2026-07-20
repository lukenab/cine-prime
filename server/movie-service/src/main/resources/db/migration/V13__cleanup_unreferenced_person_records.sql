-- Removes person rows that are not referenced by any movie_cast credit. These accumulate as
-- movies get created and deleted during normal use: movie_cast.movie_id is ON DELETE CASCADE
-- (deleting a movie removes its cast credits), but person is shared reference data and is
-- deliberately kept when a movie is deleted, since the same real person may be cast again
-- later. Nothing then reclaims a person who ends up with zero remaining credits, so this
-- table grows unbounded over time unless swept.
--
-- Generic predicate, not tied to specific rows - safe on any environment and safe to re-run:
-- once the current orphans are gone, NOT EXISTS matches nothing and this becomes a no-op.
DELETE FROM person
WHERE NOT EXISTS (
    SELECT 1 FROM movie_cast mc WHERE mc.person_id = person.person_id
);
