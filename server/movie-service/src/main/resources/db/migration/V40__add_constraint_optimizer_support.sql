-- Constraint-optimizer P1: solver configuration lives on the policy (one row per named
-- allocation policy, same place every other tunable weight already lives); the per-run
-- optimizer/scenario selection and solver output live on the generation run itself so the API
-- can expose them without recomputation. Additive only - nothing here changes existing columns.
-- Uses ADD COLUMN IF NOT EXISTS / DROP CONSTRAINT IF EXISTS + re-add, matching this project's
-- established idempotent-migration idiom (see V39) so a hand-baselined database can safely
-- replay this script. objective_breakdown/solver_diagnostics/shadow_comparison are plain TEXT
-- (Jackson-serialized JSON written/read only by the application, never queried by SQL predicate)
-- rather than JSONB - this project has no existing Hibernate JSONB-column mapping precedent, and
-- introducing one is unwarranted extra risk for data that's purely audit/API-exposure output.

ALTER TABLE showtime_allocation_policy
    ADD COLUMN IF NOT EXISTS max_solve_time_seconds INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS solver_random_seed INTEGER NOT NULL DEFAULT 42,
    ADD COLUMN IF NOT EXISTS solver_search_workers INTEGER NOT NULL DEFAULT 8,
    ADD COLUMN IF NOT EXISTS solver_relative_gap NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS solver_log_search_progress BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS max_candidates_per_movie_per_day INTEGER,
    ADD COLUMN IF NOT EXISTS optimizer_fallback_to_legacy_on_error BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS default_optimizer_mode VARCHAR(20) NOT NULL DEFAULT 'LEGACY';

ALTER TABLE showtime_allocation_policy
    DROP CONSTRAINT IF EXISTS chk_policy_solver_solve_time;
ALTER TABLE showtime_allocation_policy
    ADD CONSTRAINT chk_policy_solver_solve_time CHECK (max_solve_time_seconds > 0);

ALTER TABLE showtime_allocation_policy
    DROP CONSTRAINT IF EXISTS chk_policy_solver_workers;
ALTER TABLE showtime_allocation_policy
    ADD CONSTRAINT chk_policy_solver_workers CHECK (solver_search_workers > 0);

ALTER TABLE showtime_allocation_policy
    DROP CONSTRAINT IF EXISTS chk_policy_max_candidates;
ALTER TABLE showtime_allocation_policy
    ADD CONSTRAINT chk_policy_max_candidates
        CHECK (max_candidates_per_movie_per_day IS NULL OR max_candidates_per_movie_per_day > 0);

ALTER TABLE showtime_allocation_policy
    DROP CONSTRAINT IF EXISTS chk_policy_default_optimizer_mode;
ALTER TABLE showtime_allocation_policy
    ADD CONSTRAINT chk_policy_default_optimizer_mode
        CHECK (default_optimizer_mode IN ('LEGACY', 'CP_SAT', 'SHADOW_COMPARE'));

ALTER TABLE showtime_generation_run
    ADD COLUMN IF NOT EXISTS optimizer_mode VARCHAR(20) NOT NULL DEFAULT 'LEGACY',
    ADD COLUMN IF NOT EXISTS scenario VARCHAR(20) NOT NULL DEFAULT 'BALANCED',
    ADD COLUMN IF NOT EXISTS solver_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS solve_duration_millis BIGINT,
    ADD COLUMN IF NOT EXISTS objective_score NUMERIC(16,4),
    ADD COLUMN IF NOT EXISTS objective_breakdown TEXT,
    ADD COLUMN IF NOT EXISTS solver_diagnostics TEXT,
    ADD COLUMN IF NOT EXISTS shadow_comparison TEXT;

ALTER TABLE showtime_generation_run
    DROP CONSTRAINT IF EXISTS chk_generation_run_optimizer_mode;
ALTER TABLE showtime_generation_run
    ADD CONSTRAINT chk_generation_run_optimizer_mode
        CHECK (optimizer_mode IN ('LEGACY', 'CP_SAT', 'SHADOW_COMPARE'));

ALTER TABLE showtime_generation_run
    DROP CONSTRAINT IF EXISTS chk_generation_run_scenario;
ALTER TABLE showtime_generation_run
    ADD CONSTRAINT chk_generation_run_scenario
        CHECK (scenario IN ('CONSERVATIVE', 'BALANCED', 'REVENUE_FOCUSED'));

ALTER TABLE showtime_generation_run
    DROP CONSTRAINT IF EXISTS chk_generation_run_solver_status;
ALTER TABLE showtime_generation_run
    ADD CONSTRAINT chk_generation_run_solver_status
        CHECK (solver_status IS NULL OR solver_status IN ('OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'MODEL_INVALID', 'UNKNOWN'));
