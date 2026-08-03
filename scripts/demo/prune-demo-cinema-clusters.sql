-- Reduce a historical local demo database to a manageable 10-branch network.
--
-- Fresh databases already receive only eight branches from
-- R__seed_reference_data.sql. This script is intentionally NOT a Flyway
-- migration because it removes local demo data and must never run
-- automatically against a deployed environment.
--
-- Retained demo coverage:
--   Hanoi: Hoan Kiem, Cau Giay, Vincom Ba Trieu
--   HCMC: Crescent Mall, Thu Duc, Landmark 81, Vincom Grand Park
--   Central/South: Hai Chau, Vincom Da Nang, Long An

BEGIN;

CREATE TEMP TABLE demo_cluster_prune_candidates ON COMMIT DROP AS
SELECT cluster_id, cluster_code, cluster_name
FROM cinema_cluster
WHERE cluster_code IN ('CP-007', 'CP-009', 'CP-011', 'CP-014');

-- Fail closed if any candidate has operational or historical scheduling data.
-- It is safe to delete only unused sample branches.
DO $$
DECLARE
    blocked_clusters TEXT;
BEGIN
    SELECT STRING_AGG(candidate.cluster_name, ', ' ORDER BY candidate.cluster_name)
    INTO blocked_clusters
    FROM demo_cluster_prune_candidates candidate
    WHERE EXISTS (
              SELECT 1
              FROM cinema_room room
              JOIN show_time showtime ON showtime.cinema_room_id = room.cinema_room_id
              WHERE room.cluster_id = candidate.cluster_id
          )
       OR EXISTS (
              SELECT 1
              FROM cinema_room room
              JOIN schedule_plan_slot slot ON slot.cinema_room_id = room.cinema_room_id
              WHERE room.cluster_id = candidate.cluster_id
          )
       OR EXISTS (
              SELECT 1 FROM price_book book
              WHERE book.cluster_id = candidate.cluster_id
          )
       OR EXISTS (
              SELECT 1 FROM showtime_generation_partition partition
              WHERE partition.cluster_id = candidate.cluster_id
          )
       OR EXISTS (
              SELECT 1 FROM showtime_generation_run_cluster run_cluster
              WHERE run_cluster.cluster_id = candidate.cluster_id
          );

    IF blocked_clusters IS NOT NULL THEN
        RAISE EXCEPTION
            'Refusing to prune clusters with operational data: %',
            blocked_clusters;
    END IF;
END $$;

-- Availability history cascades with its parent availability record.
DELETE FROM movie_availability
WHERE cluster_id IN (SELECT cluster_id FROM demo_cluster_prune_candidates);

-- These tables do not cascade from cinema_room in the baseline schema.
DELETE FROM cinema_room_maintenance
WHERE cinema_room_id IN (
    SELECT room.cinema_room_id
    FROM cinema_room room
    JOIN demo_cluster_prune_candidates candidate
      ON candidate.cluster_id = room.cluster_id
);

-- Seats, layouts and room formats cascade from cinema_room.
DELETE FROM cinema_room
WHERE cluster_id IN (SELECT cluster_id FROM demo_cluster_prune_candidates);

-- Operating hours and demand profiles cascade from cinema_cluster.
DELETE FROM cinema_cluster
WHERE cluster_id IN (SELECT cluster_id FROM demo_cluster_prune_candidates);

COMMIT;

SELECT cluster_id, cluster_code, cluster_name, province, status
FROM cinema_cluster
ORDER BY cluster_name;
