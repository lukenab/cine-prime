-- Removes the Vietnamese Film Share (programming quota) feature (V29).
-- The 20% requirement was an unconfirmed internal placeholder (see V29's own
-- comment: "Compliance must replace/source-control this row after legal
-- approval"), enforced per single 7-day generation run per cluster rather
-- than aggregated over the policy's actual year-long window, with no admin
-- UI to manage the policy or flag which movies count as domestic. Out of
-- scope for now - drop cleanly rather than leave an unenforced/half-wired
-- table behind. Re-add properly (with legal-confirmed share, real UI, and
-- cumulative measurement) if this scope comes back later.
DROP TABLE IF EXISTS programming_share_policy;

ALTER TABLE movie
    DROP COLUMN IF EXISTS domestic_production_verified;
