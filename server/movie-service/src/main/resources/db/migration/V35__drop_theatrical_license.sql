-- Follows V34 (drop programming_share_policy): theatrical_license was the
-- other half of the eligibility gate removed from SchedulingEligibilityService
-- (distributor-license checking dropped - see that class for the rationale).
-- No Java code references TheatricalLicense/TheatricalLicenseRepository
-- anymore, and only 6 rows existed in the whole dataset (all effectively
-- placeholder/test data) - drop cleanly rather than leave an orphaned table.
DROP TABLE IF EXISTS theatrical_license_screening_version;
DROP TABLE IF EXISTS theatrical_license;
