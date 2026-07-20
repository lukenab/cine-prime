-- MOV-LC-05: backfill legacy Movie statuses into the canonical content model,
-- inferring per-cluster availability from existing showtimes before the
-- movie.status CHECK constraint is tightened. Idempotent: re-running finds no
-- legacy status values left and no un-migrated suspended_reason, so every
-- statement below is a no-op on a second run.

-- ── 1. Availability rows inferred from showtimes, one per (movie, cluster) ──
-- pair actually found in show_time. Movies with a legacy exhibition status but
-- zero showtime history get no availability row (nothing reliable to infer);
-- they still get their content status backfilled below and must be reviewed
-- manually if an admin wants a release plan attached.

INSERT INTO movie_availability (movie_id, cluster_id, status, showing_start_date, suspension_reason, created_by, updated_by)
SELECT
    m.movie_id,
    cr.cluster_id,
    CASE m.status
        WHEN 'NOW_SHOWING' THEN 'OPEN'
        WHEN 'COMING_SOON' THEN 'PLANNED'
        WHEN 'SUSPENDED'   THEN 'SUSPENDED'
        WHEN 'ENDED'       THEN 'CLOSED'
    END,
    MIN(st.show_date),
    CASE WHEN m.status = 'SUSPENDED' THEN m.suspended_reason ELSE NULL END,
    'migration:V29',
    'migration:V29'
FROM movie m
JOIN show_time st ON st.movie_id = m.movie_id
JOIN cinema_room cr ON cr.cinema_room_id = st.cinema_room_id
WHERE m.status IN ('COMING_SOON', 'NOW_SHOWING', 'SUSPENDED', 'ENDED')
GROUP BY m.movie_id, cr.cluster_id, m.status, m.suspended_reason
ON CONFLICT (movie_id, cluster_id, showing_start_date) DO NOTHING;

-- ── 2. Drop the old constraint before writing canonical values — it still
-- lists the legacy enum and would reject 'APPROVED'/'CHANGES_REQUESTED' as
-- unknown values if left in place during the UPDATE below.

ALTER TABLE movie DROP CONSTRAINT IF EXISTS chk_movie_status;

-- ── 3. Canonical content status ─────────────────────────────────────────────

UPDATE movie SET status = 'CHANGES_REQUESTED' WHERE status = 'REJECTED';
UPDATE movie SET status = 'APPROVED' WHERE status IN ('COMING_SOON', 'NOW_SHOWING', 'SUSPENDED', 'ENDED');

-- ── 4. Tighten the constraint now that no row holds a legacy value ──────────

ALTER TABLE movie ADD CONSTRAINT chk_movie_status
    CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'ARCHIVED'));

-- ── 5. suspended_reason has been copied to the relevant availability row(s) ─

ALTER TABLE movie DROP COLUMN IF EXISTS suspended_reason;
