-- CLASSIFICATION_NOT_APPROVED was removed from SchedulingEligibilityService: the table's
-- only 29 rows were all migration-generated placeholders (approval_reference =
-- 'MIGRATED-MOVIE-{id}'), never a real censorship-board decision, and no application code
-- ever wrote a real one - same "no authority to fabricate this" reasoning as the
-- theatrical_license removal (V35). Nothing references this table anymore.
DROP TABLE IF EXISTS movie_classification_approval;
