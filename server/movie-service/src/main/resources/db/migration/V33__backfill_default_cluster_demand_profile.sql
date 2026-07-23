-- Same class of gap as V31 (cinema_room_format): cinema_cluster_demand_profile
-- was only ever seeded for the two demo clusters (CP-Q9 HIGH, CP-LA LOW) that
-- ship with the auto-showtime-generation feature. Every other active cluster
-- has no row at all, so AutoShowtimeCandidateSelector rejects every one of its
-- candidates with MISSING_DEMAND_PROFILE regardless of movie/date - the run
-- always ends in NO_USABLE_PARTITION for any real (non-demo) cluster.
--
-- This assigns a neutral NORMAL-tier default to every active cluster that
-- doesn't have a profile yet, so scheduling isn't structurally blocked. It is
-- a stopgap, not real analytics: min/max daily shows and demand_score should
-- be revisited once real booking/revenue data is available to derive them,
-- ideally via an admin-facing screen rather than another migration.
INSERT INTO cinema_cluster_demand_profile (
    cluster_id, demand_tier, demand_score, min_daily_shows, max_daily_shows_per_movie,
    created_by, updated_by
)
SELECT cc.cluster_id, 'NORMAL', 50.00, 1, 4, 'system-backfill', 'system-backfill'
FROM cinema_cluster cc
WHERE cc.status = 'ACTIVE'
  AND NOT EXISTS (
      SELECT 1 FROM cinema_cluster_demand_profile cdp WHERE cdp.cluster_id = cc.cluster_id
  );
