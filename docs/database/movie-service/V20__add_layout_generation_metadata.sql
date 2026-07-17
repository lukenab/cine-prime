-- P0/P1 rule-based Cinema Room Layout Assistant metadata.
-- Generated positions remain authoritative; this metadata only restores the
-- authoring rules and preserves explicit operator exceptions on regeneration.

ALTER TABLE room_layout
    ADD COLUMN IF NOT EXISTS numbering_policy VARCHAR(30) NOT NULL DEFAULT 'CONTIGUOUS_SEATS',
    ADD COLUMN IF NOT EXISTS generator_template_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS generator_template_version INTEGER,
    ADD COLUMN IF NOT EXISTS generation_config TEXT;

ALTER TABLE room_layout
    DROP CONSTRAINT IF EXISTS chk_numbering_policy;

ALTER TABLE room_layout
    ADD CONSTRAINT chk_numbering_policy
        CHECK (numbering_policy IN ('CONTIGUOUS_SEATS', 'PHYSICAL_POSITION'));

ALTER TABLE room_layout_position
    ADD COLUMN IF NOT EXISTS manual_override BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN room_layout.numbering_policy IS
    'CONTIGUOUS_SEATS skips non-seat positions; PHYSICAL_POSITION preserves physical column numbers.';
COMMENT ON COLUMN room_layout.generation_config IS
    'Versioned JSON authoring metadata for row zones and aisles; positions remain authoritative.';
COMMENT ON COLUMN room_layout_position.manual_override IS
    'True when an operator changed this coordinate after rule-based generation.';
