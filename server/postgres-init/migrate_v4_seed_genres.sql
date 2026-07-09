-- =============================================================================
-- migrate_v4_seed_genres.sql
-- Seed remaining TMDB standard genres not present in the initial movie_db.sql seed.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
-- =============================================================================

INSERT INTO genre (genre_name, genre_code) VALUES
    ('History',  'history'),
    ('Music',    'music'),
    ('Mystery',  'mystery'),
    ('TV Movie', 'tv-movie'),
    ('Western',  'western')
ON CONFLICT (genre_code) DO NOTHING;
