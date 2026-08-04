-- V3's seed used placeholder quota values (1000 / 5). The actual demo script
-- needs a low, easy-to-exhaust per-account limit so "reuse the same account"
-- visibly hits the cap within the live walkthrough.
UPDATE promotion
SET global_usage_limit = 100,
    per_account_usage_limit = 1
WHERE code = 'CINEPRIME20';
