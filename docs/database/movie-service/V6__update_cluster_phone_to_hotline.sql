-- =============================================================================
-- Migration V6: Update seeded cinema_cluster phone numbers to hotline format
-- Run on: movie_db
-- Hotline format: 1900xxxx / 1800xxxx (matches CinemaClusterRequest @Pattern)
-- =============================================================================

UPDATE cinema_cluster SET phone_number = '19002001' WHERE cluster_id = 1;
UPDATE cinema_cluster SET phone_number = '19002002' WHERE cluster_id = 2;
UPDATE cinema_cluster SET phone_number = '19002003' WHERE cluster_id = 3;
UPDATE cinema_cluster SET phone_number = '19002004' WHERE cluster_id = 4;
UPDATE cinema_cluster SET phone_number = '19002005' WHERE cluster_id = 5;
UPDATE cinema_cluster SET phone_number = '19002006' WHERE cluster_id = 6;
