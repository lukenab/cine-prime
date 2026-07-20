-- `type` / `movie_movie_types` are leftovers from the original MovieType
-- entity, predating the rename to genre/movie_genre (see postgres-init/
-- movie_db.sql's "movie_movie_types -> rename to movie_genre" note). No
-- Java entity, repository, or service references them anymore, and the
-- junction table has zero rows (no movie is linked to any type). Fresh
-- installs never create these tables at all; this only affects databases
-- that predate the genre rename.

DROP TABLE IF EXISTS movie_movie_types;
DROP TABLE IF EXISTS type;
