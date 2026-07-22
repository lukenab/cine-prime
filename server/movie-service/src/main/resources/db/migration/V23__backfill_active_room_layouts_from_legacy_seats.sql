-- Backfill versioned ACTIVE room layouts for legacy rooms whose seat map lives
-- only in the seat table. The migration is intentionally conservative:
--   * rooms without seats are ignored;
--   * rooms with any existing layout are ignored so an authoring/review flow is
--     never overwritten;
--   * existing ACTIVE layouts are therefore never changed;
--   * legacy COUPLE rows are expanded to two physical positions sharing one
--     atomic sellable group.

CREATE TEMP TABLE legacy_room_layout_backfill (
    cinema_room_id BIGINT PRIMARY KEY,
    room_layout_id BIGINT
);

INSERT INTO legacy_room_layout_backfill (cinema_room_id)
SELECT room.cinema_room_id
FROM cinema_room room
WHERE EXISTS (
    SELECT 1
    FROM seat seat_row
    WHERE seat_row.cinema_room_id = room.cinema_room_id
)
AND NOT EXISTS (
    SELECT 1
    FROM room_layout existing_layout
    WHERE existing_layout.cinema_room_id = room.cinema_room_id
);

-- Expanding a legacy Couple unit is only unambiguous when its row contains
-- Couple units exclusively. Abort instead of guessing if inconsistent source
-- data is encountered in another environment.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM seat seat_row
        JOIN legacy_room_layout_backfill candidate
          ON candidate.cinema_room_id = seat_row.cinema_room_id
        GROUP BY seat_row.cinema_room_id, seat_row.row_label
        HAVING COUNT(*) FILTER (
                   WHERE seat_row.seat_type = 'COUPLE'
                     AND NULLIF(BTRIM(seat_row.seat_group_id), '') IS NULL
               ) > 0
           AND COUNT(*) FILTER (WHERE seat_row.seat_type <> 'COUPLE') > 0
    ) THEN
        RAISE EXCEPTION 'V23 cannot safely expand a legacy row containing both ungrouped COUPLE and non-COUPLE seats';
    END IF;
END $$;

WITH row_widths AS (
    SELECT
        seat_row.cinema_room_id,
        seat_row.row_label,
        SUM(
            CASE
                WHEN seat_row.seat_type = 'COUPLE'
                 AND NULLIF(BTRIM(seat_row.seat_group_id), '') IS NULL
                    THEN 2
                ELSE 1
            END
        )::INTEGER AS physical_positions
    FROM seat seat_row
    JOIN legacy_room_layout_backfill candidate
      ON candidate.cinema_room_id = seat_row.cinema_room_id
    GROUP BY seat_row.cinema_room_id, seat_row.row_label
), room_statistics AS (
    SELECT
        seat_row.cinema_room_id,
        COUNT(DISTINCT seat_row.row_label)::INTEGER AS number_of_rows,
        MAX(row_widths.physical_positions)::INTEGER AS max_positions_per_row,
        (
            SELECT first_row.row_label
            FROM seat first_row
            WHERE first_row.cinema_room_id = seat_row.cinema_room_id
            GROUP BY first_row.row_label
            ORDER BY LENGTH(first_row.row_label), first_row.row_label
            LIMIT 1
        ) AS first_row_label,
        SUM(
            CASE
                WHEN seat_row.seat_type = 'COUPLE'
                 AND NULLIF(BTRIM(seat_row.seat_group_id), '') IS NULL
                    THEN 2
                ELSE 1
            END
        )::INTEGER AS person_capacity,
        (
            COUNT(*) FILTER (WHERE seat_row.seat_type <> 'COUPLE')
            + COUNT(*) FILTER (
                WHERE seat_row.seat_type = 'COUPLE'
                  AND NULLIF(BTRIM(seat_row.seat_group_id), '') IS NULL
              )
            + COUNT(DISTINCT NULLIF(BTRIM(seat_row.seat_group_id), '')) FILTER (
                WHERE seat_row.seat_type = 'COUPLE'
                  AND NULLIF(BTRIM(seat_row.seat_group_id), '') IS NOT NULL
              )
        )::INTEGER AS sellable_unit_count
    FROM seat seat_row
    JOIN legacy_room_layout_backfill candidate
      ON candidate.cinema_room_id = seat_row.cinema_room_id
    JOIN row_widths
      ON row_widths.cinema_room_id = seat_row.cinema_room_id
     AND row_widths.row_label = seat_row.row_label
    GROUP BY seat_row.cinema_room_id
), inserted_layouts AS (
    INSERT INTO room_layout (
        cinema_room_id,
        version,
        status,
        number_of_rows,
        max_positions_per_row,
        first_row_label,
        numbering_direction,
        numbering_policy,
        generator_template_code,
        generator_template_version,
        generation_config,
        person_capacity,
        sellable_unit_count,
        submitted_at,
        submitted_by,
        approved_at,
        approved_by,
        created_at,
        created_by,
        updated_at,
        updated_by
    )
    SELECT
        stats.cinema_room_id,
        1,
        'ACTIVE',
        stats.number_of_rows,
        stats.max_positions_per_row,
        stats.first_row_label,
        'LEFT_TO_RIGHT',
        'CONTIGUOUS_SEATS',
        'LEGACY_SEAT_BACKFILL',
        1,
        jsonb_build_object(
            'source', 'seat',
            'migration', 'V23',
            'coupleModel', 'TWO_PHYSICAL_POSITIONS_ONE_SELLABLE_UNIT'
        )::TEXT,
        stats.person_capacity,
        stats.sellable_unit_count,
        NOW(),
        'SYSTEM:MIGRATION_V23',
        NOW(),
        'SYSTEM:MIGRATION_V23',
        NOW(),
        'SYSTEM:MIGRATION_V23',
        NOW(),
        'SYSTEM:MIGRATION_V23'
    FROM room_statistics stats
    RETURNING cinema_room_id, room_layout_id
)
UPDATE legacy_room_layout_backfill candidate
SET room_layout_id = inserted.room_layout_id
FROM inserted_layouts inserted
WHERE inserted.cinema_room_id = candidate.cinema_room_id;

-- Ordinary seats and already-grouped Couple positions retain their physical
-- coordinate and seat code exactly.
WITH ranked_seats AS (
    SELECT
        seat_row.*,
        DENSE_RANK() OVER (
            PARTITION BY seat_row.cinema_room_id
            ORDER BY LENGTH(seat_row.row_label), seat_row.row_label
        ) - 1 AS row_index
    FROM seat seat_row
    JOIN legacy_room_layout_backfill candidate
      ON candidate.cinema_room_id = seat_row.cinema_room_id
)
INSERT INTO room_layout_position (
    room_layout_id,
    row_index,
    column_index,
    row_label,
    position_type,
    seat_number,
    seat_code,
    seat_type,
    seat_group_id,
    seat_status,
    manual_override
)
SELECT
    candidate.room_layout_id,
    ranked.row_index::INTEGER,
    ranked.col_number - 1,
    ranked.row_label,
    'SEAT',
    ranked.col_number,
    ranked.seat_code,
    ranked.seat_type,
    NULLIF(BTRIM(ranked.seat_group_id), ''),
    ranked.status,
    FALSE
FROM ranked_seats ranked
JOIN legacy_room_layout_backfill candidate
  ON candidate.cinema_room_id = ranked.cinema_room_id
WHERE NOT (
    ranked.seat_type = 'COUPLE'
    AND NULLIF(BTRIM(ranked.seat_group_id), '') IS NULL
);

-- In the legacy model one ungrouped COUPLE seat row represented one two-person
-- sellable unit. Materialize it as two adjacent positions with a deterministic
-- group ID so locking/pricing can remain atomic in the current model.
WITH ranked_seats AS (
    SELECT
        seat_row.*,
        DENSE_RANK() OVER (
            PARTITION BY seat_row.cinema_room_id
            ORDER BY LENGTH(seat_row.row_label), seat_row.row_label
        ) - 1 AS row_index
    FROM seat seat_row
    JOIN legacy_room_layout_backfill candidate
      ON candidate.cinema_room_id = seat_row.cinema_room_id
)
INSERT INTO room_layout_position (
    room_layout_id,
    row_index,
    column_index,
    row_label,
    position_type,
    seat_number,
    seat_code,
    seat_type,
    seat_group_id,
    seat_status,
    manual_override
)
SELECT
    candidate.room_layout_id,
    couple.row_index::INTEGER,
    ((couple.col_number - 1) * 2) + side.side_index,
    couple.row_label,
    'SEAT',
    ((couple.col_number - 1) * 2) + side.side_index + 1,
    couple.row_label || (((couple.col_number - 1) * 2) + side.side_index + 1),
    'COUPLE',
    'legacy-' || couple.cinema_room_id || '-' || couple.seat_id,
    couple.status,
    FALSE
FROM ranked_seats couple
JOIN legacy_room_layout_backfill candidate
  ON candidate.cinema_room_id = couple.cinema_room_id
CROSS JOIN (VALUES (0), (1)) AS side(side_index)
WHERE couple.seat_type = 'COUPLE'
  AND NULLIF(BTRIM(couple.seat_group_id), '') IS NULL;

-- Keep the room-level summary fields aligned with the newly authoritative
-- layout. total_seat_capacity is person capacity; Couple contributes two.
UPDATE cinema_room room
SET
    number_of_rows = layout.number_of_rows,
    seats_per_row = layout.max_positions_per_row,
    total_seat_capacity = layout.person_capacity,
    updated_at = NOW(),
    updated_by = 'SYSTEM:MIGRATION_V23'
FROM room_layout layout
JOIN legacy_room_layout_backfill candidate
  ON candidate.room_layout_id = layout.room_layout_id
WHERE room.cinema_room_id = candidate.cinema_room_id;

INSERT INTO room_layout_audit_log (
    log_id,
    room_layout_id,
    action,
    performed_by,
    old_status,
    new_status,
    note,
    timestamp
)
SELECT
    gen_random_uuid()::TEXT,
    candidate.room_layout_id,
    'ACTIVATE',
    'SYSTEM:MIGRATION_V23',
    NULL,
    'ACTIVE',
    'Backfilled from the legacy seat map; no existing room layout was overwritten.',
    NOW()
FROM legacy_room_layout_backfill candidate;

DROP TABLE legacy_room_layout_backfill;
