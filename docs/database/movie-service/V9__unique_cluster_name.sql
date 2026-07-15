-- =============================================================================
-- Migration V9: Enforce unique cinema_cluster.cluster_name (case-insensitive)
-- Run on: movie_db
-- =============================================================================
-- cinema_cluster never had a uniqueness guard on cluster_name (unlike genre/
-- company, which already had uq_genre_name / uq_company_name). Two clusters
-- with the same physical-location name is a real data-entry mistake, not a
-- legitimate case like the per-cluster room-name reuse handled in V7 — so
-- this is a straight case-insensitive unique index, matching the app-layer
-- existsByClusterNameIgnoreCase check in CinemaClusterController.

CREATE UNIQUE INDEX IF NOT EXISTS uq_cluster_name_ci ON cinema_cluster (LOWER(cluster_name));
