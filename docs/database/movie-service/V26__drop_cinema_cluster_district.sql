-- Vietnam abolished the district (quận/huyện) administrative tier nationwide from
-- 01/07/2025, moving to a 2-tier province -> ward model. The column has no valid
-- values to hold for any address created since, so it's dropped rather than kept
-- as always-empty legacy data.

ALTER TABLE cinema_cluster
    DROP COLUMN IF EXISTS district;
