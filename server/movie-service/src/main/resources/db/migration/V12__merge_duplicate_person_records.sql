-- The `person` table has 25 rows hand-seeded by an older script (all `tmdb_id IS NULL`,
-- same creation timestamp) - the same root pattern that caused the genre_name mix-up fixed by
-- V11__standardize_genre_names_to_english.sql on the sibling `fix/standardize-genre-names-english`
-- branch. 5 of those 25 real people were later re-added through the TMDB import path, which only
-- dedupes by `tmdb_id` and so had no way of knowing these already existed - splitting each
-- person's cast credits across two `person_id` rows (e.g. Christopher Nolan had 3 DIRECTOR
-- credits under the legacy row and 1 more under the TMDB-linked row).
--
-- This repoints movie_cast credits from the legacy (tmdb_id IS NULL) row onto the TMDB-verified
-- row, matched by `tmdb_id` - the only identifier here that is genuinely stable across
-- environments (never by `person_id`, which is auto-generated and can differ per environment).
-- Idempotent: once a legacy row is deleted, the matching subqueries return no rows and every
-- statement below becomes a no-op on a re-run.

-- Christopher Nolan (TMDB person id 525)
UPDATE movie_cast
SET person_id = (SELECT person_id FROM person WHERE tmdb_id = 525)
WHERE person_id = (SELECT person_id FROM person WHERE tmdb_id IS NULL AND full_name = 'Christopher Nolan')
  AND NOT EXISTS (
      SELECT 1 FROM movie_cast mc2
      WHERE mc2.person_id = (SELECT person_id FROM person WHERE tmdb_id = 525)
        AND mc2.movie_id = movie_cast.movie_id
        AND mc2.role_type = movie_cast.role_type
  );
DELETE FROM movie_cast
WHERE person_id = (SELECT person_id FROM person WHERE tmdb_id IS NULL AND full_name = 'Christopher Nolan');
DELETE FROM person WHERE tmdb_id IS NULL AND full_name = 'Christopher Nolan';

-- Zendaya (TMDB person id 505710)
UPDATE movie_cast
SET person_id = (SELECT person_id FROM person WHERE tmdb_id = 505710)
WHERE person_id = (SELECT person_id FROM person WHERE tmdb_id IS NULL AND full_name = 'Zendaya')
  AND NOT EXISTS (
      SELECT 1 FROM movie_cast mc2
      WHERE mc2.person_id = (SELECT person_id FROM person WHERE tmdb_id = 505710)
        AND mc2.movie_id = movie_cast.movie_id
        AND mc2.role_type = movie_cast.role_type
  );
DELETE FROM movie_cast
WHERE person_id = (SELECT person_id FROM person WHERE tmdb_id IS NULL AND full_name = 'Zendaya');
DELETE FROM person WHERE tmdb_id IS NULL AND full_name = 'Zendaya';

-- Anne Hathaway (TMDB person id 1813)
UPDATE movie_cast
SET person_id = (SELECT person_id FROM person WHERE tmdb_id = 1813)
WHERE person_id = (SELECT person_id FROM person WHERE tmdb_id IS NULL AND full_name = 'Anne Hathaway')
  AND NOT EXISTS (
      SELECT 1 FROM movie_cast mc2
      WHERE mc2.person_id = (SELECT person_id FROM person WHERE tmdb_id = 1813)
        AND mc2.movie_id = movie_cast.movie_id
        AND mc2.role_type = movie_cast.role_type
  );
DELETE FROM movie_cast
WHERE person_id = (SELECT person_id FROM person WHERE tmdb_id IS NULL AND full_name = 'Anne Hathaway');
DELETE FROM person WHERE tmdb_id IS NULL AND full_name = 'Anne Hathaway';

-- Cillian Murphy (TMDB person id 2037)
UPDATE movie_cast
SET person_id = (SELECT person_id FROM person WHERE tmdb_id = 2037)
WHERE person_id = (SELECT person_id FROM person WHERE tmdb_id IS NULL AND full_name = 'Cillian Murphy')
  AND NOT EXISTS (
      SELECT 1 FROM movie_cast mc2
      WHERE mc2.person_id = (SELECT person_id FROM person WHERE tmdb_id = 2037)
        AND mc2.movie_id = movie_cast.movie_id
        AND mc2.role_type = movie_cast.role_type
  );
DELETE FROM movie_cast
WHERE person_id = (SELECT person_id FROM person WHERE tmdb_id IS NULL AND full_name = 'Cillian Murphy');
DELETE FROM person WHERE tmdb_id IS NULL AND full_name = 'Cillian Murphy';

-- Robert Pattinson (TMDB person id 11288)
UPDATE movie_cast
SET person_id = (SELECT person_id FROM person WHERE tmdb_id = 11288)
WHERE person_id = (SELECT person_id FROM person WHERE tmdb_id IS NULL AND full_name = 'Robert Pattinson')
  AND NOT EXISTS (
      SELECT 1 FROM movie_cast mc2
      WHERE mc2.person_id = (SELECT person_id FROM person WHERE tmdb_id = 11288)
        AND mc2.movie_id = movie_cast.movie_id
        AND mc2.role_type = movie_cast.role_type
  );
DELETE FROM movie_cast
WHERE person_id = (SELECT person_id FROM person WHERE tmdb_id IS NULL AND full_name = 'Robert Pattinson');
DELETE FROM person WHERE tmdb_id IS NULL AND full_name = 'Robert Pattinson';
