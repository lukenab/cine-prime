-- =============================================================================
-- Migration V8: Unify cinema_cluster.phone_number to one chain-wide hotline
-- Run on: movie_db
-- =============================================================================
-- phone_number was previously entered per-cluster (V6 seeded 6 different test
-- numbers), but real chains (CGV/Lotte/Galaxy/BHD) share a single hotline for
-- the whole chain, not one per location. The app now hardcodes this value on
-- create and never lets it be edited per-cluster (see CinemaClusterController),
-- so existing rows are normalized here to match.

UPDATE cinema_cluster SET phone_number = '19001000';
