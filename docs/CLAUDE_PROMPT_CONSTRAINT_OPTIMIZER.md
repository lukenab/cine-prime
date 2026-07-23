## Role

You are a senior Java/Spring Boot engineer, operations-research engineer and cinema scheduling domain architect.

You are working on the CinePrime movie theater management project.

Repository:

```text
hcm26_cpl_java_05_group1
```

Primary backend module:

```text
server/movie-service
```

Primary frontend:

```text
client
```

## Required reading

Before modifying code, read these documents completely:

- `docs/features/showtime-management/BUSINESS_RULES.md`
- `docs/features/showtime-management/FEATURE_BRIEF.md`
- `docs/features/showtime-management/API_LIST.md`
- `docs/features/showtime-management/DEMO_SCRIPT.md`
- `docs/AUTO_SHOWTIME_IMPLEMENTATION_PLAN.txt`

Then inspect the existing automatic-showtime implementation, especially:

- `service/autoshowtime`
- candidate generation
- eligibility validation
- scoring and slot selection
- generation-run worker
- schedule-plan draft/publish workflow
- showtime overlap protection
- room capabilities
- movie availability/release plans
- forecast or demand-related models
- database migrations
- Auto Schedule frontend

Do not assume the documentation is fully synchronized with the code. Treat the running code, database schema, tests and API contracts as evidence and report any mismatch.

---

# Objective

Replace the current greedy/day-by-day automatic-showtime selection with a production-oriented constraint optimization architecture.

Implementation has two phases:

1. **P1 — Weekly constraint optimizer using Google OR-Tools CP-SAT.**
2. **P2 — Multi-cluster coordination using MarketArea, scenario planning and rolling replanning.**

Do not remove the current algorithm immediately. Preserve it as a controlled fallback until the CP-SAT implementation passes regression, invariant and performance tests.

---

# Working rules

- Do not stop after writing an implementation plan. Implement the code.
- Reuse the existing generation-run and schedule-plan workflow.
- Preserve the rule that generation creates an internal draft; only publishing materializes customer-facing showtimes.
- Do not write directly to published showtimes while the solver is running.
- Use versioned database migrations. Do not rely on Hibernate `ddl-auto`.
- Do not silently relax hard constraints to make a solution feasible.
- Do not create fake forecast accuracy.
- If historical data is insufficient, introduce a forecast interface and an explicitly named baseline implementation.
- Do not rewrite unrelated modules.
- Preserve existing user changes in the working tree.
- Do not expose raw OR-Tools objects through controllers or API DTOs.
- Ignore legal/regulatory concerns for this task.
- All timestamps must respect the CinemaCluster business timezone.
- Use integer objective coefficients because CP-SAT operates on integer expressions.
- Add comments explaining the mathematical model and non-obvious constraints.
- Avoid long-running database transactions while solving.
- Do not claim production readiness without performance measurements and concurrency tests.

---

# Phase 0 — Architecture audit

Before implementation, produce a concise audit covering:

1. Current scheduling pipeline from request to published showtimes.
2. Existing candidate, scoring and selection algorithm.
3. Existing hard constraints and soft preferences.
4. Rules currently applied per date that must move to weekly scope.
5. Existing database entities and migrations involved.
6. Existing retry, transaction, locking and idempotency behavior.
7. Gaps between code and `BUSINESS_RULES.md`.
8. Components that can be reused.
9. Components that must be replaced or adapted.
10. Estimated candidate-space size for a representative cluster/week.

Save the audit to:

```text
docs/features/showtime-management/CONSTRAINT_OPTIMIZER_AUDIT.md
```

After the audit, continue implementing without waiting for confirmation unless a destructive schema decision is unavoidable.

---

# P1 — Weekly CP-SAT constraint optimizer

## 1. Planning scope

Optimize one:

```text
CinemaCluster × PlanningWeek
```

A planning week can be a configured date range of up to seven business dates.

Generation-run processing and persistence retries may still be partitioned by:

```text
CinemaCluster × BusinessDate
```

However, all partitions must come from one weekly solver result. Do not optimize each date independently.

The solver must account for all selected movies, versions, rooms and valid start slots across the planning window.

---

## 2. Mathematical decision model

Use a binary decision variable equivalent to:

```text
x[movie, version, room, businessDate, startSlot] ∈ {0, 1}
```

Each variable means:

> The selected movie version starts in the selected room at the selected business date and start slot.

Do not instantiate variables for impossible assignments.

Generate variables only after filtering by:

- movie scheduling eligibility;
- movie approval/content readiness;
- release-plan and cluster availability;
- movie version/format availability;
- room capability;
- operating hours;
- room maintenance or suspension;
- locked/published showtimes;
- minimum time required for runtime and cleanup;
- planning-window boundaries.

Create optional interval variables where appropriate and connect each interval presence to its binary selection variable.

Use `NoOverlap` or an equivalent interval constraint for room occupation.

---

## 3. Required hard constraints

### HC-01 — Room overlap

A screening room cannot contain overlapping showtimes.

Room occupation must include:

```text
movie runtime
+ advertisements/trailer allowance, if modeled
+ cleanup/turnover buffer
```

### HC-02 — Operating window

The entire occupied interval must fit within the CinemaCluster operating schedule for that business date.

Support operating windows crossing midnight.

Use the cluster timezone, not the server or browser timezone.

### HC-03 — Room capability

A room may only schedule versions/formats supported by that room.

Examples:

- 2D
- 3D
- IMAX
- ScreenX
- supported audio/presentation capability when present in the current domain

### HC-04 — Movie availability

A movie/version must be available at the selected CinemaCluster and date.

Do not infer cluster availability only from global movie approval.

### HC-05 — Locked schedule protection

Existing locked, published or otherwise immutable showtimes must become fixed intervals in the solver.

The solver may schedule around them but must never move, replace or overlap them.

### HC-06 — Booking protection

A showtime with existing bookings or sold inventory must not be moved, deleted or replaced by replanning.

### HC-07 — Exhibition window

A movie cannot be scheduled outside its configured cluster exhibition/release window.

### HC-08 — Version consistency

The selected movie version must match:

- room capabilities;
- approved screening format;
- language/audio/subtitle version;
- cluster availability.

### HC-09 — Maximum concurrent room share

Respect the configured maximum number or percentage of rooms that can screen the same movie concurrently within a cluster.

### HC-10 — Scheduling bounds

Generated showtimes must remain inside the requested weekly planning range.

Do not let timezone conversion move a slot into another unintended business date.

### HC-11 — Stable identifiers and idempotency

Retrying the same generation request must not create duplicate draft slots or showtimes.

---

## 4. Soft constraints and objective function

Introduce a configurable weighted objective.

Suggested components:

```text
maximize:
  demand satisfaction
  + forecast occupied seats
  + expected revenue contribution
  + prime-time placement
  + room-capacity fit
  + format/capability fit
  + weekly coverage
  + schedule diversity
  + desirable staggering
  - idle-room gaps
  - excessive movie switching in the same room
  - underfilled large-room assignments
  - over-allocation to low-demand movies
  - schedule instability compared with the previous plan
```

Do not combine unrelated metrics without normalization.

Create an objective-breakdown value object so the result can explain:

- demand score;
- utilization score;
- revenue score;
- prime-time score;
- diversity score;
- stability penalty;
- gap penalty;
- final weighted score.

Weights must come from a policy/configuration object, not be hard-coded throughout solver code.

---

## 5. Solver configuration

Add a dedicated solver configuration containing at least:

- maximum solve time;
- random seed;
- number of search workers;
- relative/absolute gap if supported;
- log-search-progress flag;
- maximum candidates per movie/day if candidate pruning is required;
- fallback behavior;
- optimizer enabled flag.

Provide safe defaults.

Handle solver statuses explicitly:

- `OPTIMAL`
- `FEASIBLE`
- `INFEASIBLE`
- `MODEL_INVALID`
- `UNKNOWN`

Never treat `UNKNOWN` as an optimal result.

A `FEASIBLE` result may create a draft if all hard constraints pass, but it must expose that optimality was not proven.

An `INFEASIBLE` result must not create an empty schedule and pretend generation succeeded.

---

## 6. Java architecture

Use interfaces so OR-Tools does not leak into business services.

Recommended structure:

```text
autoshowtime/
  application/
    WeeklyScheduleOptimizationService
    ScheduleGenerationOrchestrator
  domain/
    WeeklyPlanningProblem
    PlanningCandidate
    FixedRoomInterval
    OptimizedSchedule
    OptimizedSlot
    ObjectiveBreakdown
    SolverDiagnostics
    OptimizationScenario
  optimizer/
    ScheduleOptimizer
    CpSatScheduleOptimizer
    LegacyGreedyScheduleOptimizer
    CpSatModelBuilder
    CpSatConstraintFactory
    CpSatObjectiveBuilder
    CpSatSolutionMapper
  forecast/
    DemandForecastProvider
    BaselineDemandForecastProvider
  validation/
    OptimizedScheduleInvariantValidator
```

Names may be adjusted to match existing conventions, but preserve these boundaries:

- candidate construction;
- optimization model;
- objective construction;
- result mapping;
- invariant validation;
- persistence/materialization.

Add the OR-Tools Java dependency using a version compatible with the current Java and Spring Boot setup.

Document native-library requirements.

---

## 7. Candidate-space control

Do not create the complete Cartesian product blindly.

Implement candidate pruning before building CP-SAT variables:

- remove ineligible movie versions;
- remove incompatible rooms;
- remove starts outside operating hours;
- remove candidates conflicting with fixed intervals;
- use configurable slot granularity;
- optionally cap very low-value candidates;
- preserve enough candidates to avoid biasing the solver incorrectly.

Record diagnostics:

- raw candidate count;
- eligible candidate count;
- pruned by reason;
- variables created;
- interval variables created;
- constraint count;
- solve duration.

---

## 8. Fallback and rollout strategy

Keep the current algorithm behind an interface.

Support these modes:

```text
LEGACY
CP_SAT
SHADOW_COMPARE
```

### LEGACY

Uses the existing algorithm.

### CP_SAT

Uses the new optimizer.

### SHADOW_COMPARE

Runs the legacy and CP-SAT algorithms on the same immutable input, persists only the configured primary result, and records comparison diagnostics.

Comparison must include:

- number of sessions;
- total objective score;
- forecast occupancy;
- room utilization;
- hard-constraint violations;
- solve duration;
- unscheduled demand;
- schedule stability.

Do not publish both results.

---

## 9. Persistence and transactions

The solver must run outside a long database transaction.

Required pipeline:

```text
Load immutable planning snapshot
→ Build candidates
→ Solve weekly model
→ Validate solver output
→ Persist schedule-plan draft
→ Review
→ Publish
→ Materialize showtimes
```

Before persisting, revalidate critical data or verify snapshot/version tokens.

Persistence and retry may be partitioned by:

```text
CinemaCluster × BusinessDate
```

Each partition must be atomic.

If one date fails to persist:

- do not silently report the complete weekly plan as successful;
- report partial failure clearly;
- preserve retryability;
- do not duplicate already persisted partitions.

---

# P2 — Multi-cluster coordination

Only begin P2 after P1 tests pass.

## 10. MarketArea domain

Add a `MarketArea` aggregate representing nearby or commercially related CinemaClusters.

Suggested data:

```text
marketAreaId
code
name
timezone
status
planningPolicyId
createdAt
updatedAt
```

Create a membership model rather than putting one mutable free-text field on CinemaCluster:

```text
MarketAreaCinemaCluster
- marketAreaId
- cinemaClusterId
- priority/order
- activeFrom
- activeTo
```

Use versioned migrations and proper foreign keys/indexes.

Do not infer membership dynamically from names.

Coordinates may support recommendations, but configured membership remains authoritative.

---

## 11. Multi-cluster staggering

Within one MarketArea, discourage nearby clusters from starting the same high-demand movie at exactly the same time.

This is normally a soft constraint, not an unconditional hard constraint.

Support configurable staggering windows, for example:

```text
15, 20 or 30 minutes
```

The penalty may depend on:

- distance or configured cluster relationship;
- demand class;
- number of nearby clusters;
- premium format scarcity;
- scenario.

Do not prevent simultaneous starts when capacity requirements justify them.

---

## 12. Cluster-specific forecasts

Forecast demand independently for:

```text
Movie × Version × CinemaCluster × BusinessDate × TimeBucket
```

Provide a forecast interface.

Possible features, when data is available:

- historical occupancy;
- booking pace;
- weekday/weekend;
- time of day;
- movie lifecycle age;
- format;
- room capacity;
- cluster;
- holidays/events if already available.

If insufficient data exists, implement:

```text
BaselineDemandForecastProvider
```

It must be deterministic and clearly documented as a baseline—not machine learning.

---

## 13. Planning scenarios

Support three scenarios:

### CONSERVATIVE

Priorities:

- high schedule stability;
- lower room-share concentration;
- fewer risky additional sessions;
- higher occupancy threshold.

### BALANCED

Priorities:

- balanced utilization;
- demand satisfaction;
- diversity;
- moderate stability.

### REVENUE_FOCUSED

Priorities:

- expected occupied seats;
- expected revenue;
- prime-time and premium-room allocation;
- allows more aggressive changes only in unlocked areas.

Scenarios must map to objective weights and policy parameters.

Do not duplicate solver code for each scenario.

---

## 14. Rolling replanning

Implement rolling replanning using a frozen-horizon model.

Only replan showtimes that are:

- not locked;
- not published as immutable;
- without bookings/sold inventory;
- outside the configured freeze window.

Existing protected sessions become fixed intervals.

Introduce a stability penalty for moving or replacing previously proposed slots.

The replan result must report:

- retained sessions;
- moved sessions;
- added sessions;
- removed sessions;
- protected sessions;
- reason for each change.

Do not mutate the active schedule automatically. Produce a new draft/revision requiring review.

---

## 15. Booking-pace integration

Add a provider abstraction for booking pace.

Example output:

```text
BookingPaceSnapshot
- showtimeId
- soldSeats
- capacity
- hoursUntilStart
- salesVelocity
- expectedFinalOccupancy
- capturedAt
```

Rolling replanning may respond to booking pace by proposing additional or reduced future sessions, but it must never change sessions containing bookings.

---

# API requirements

Extend APIs without breaking existing clients.

At minimum support:

```http
POST /api/showtime-generation/runs
```

Additional request fields:

```json
{
  "clusterIds": [43],
  "startDate": "2026-07-27",
  "endDate": "2026-08-02",
  "scenario": "BALANCED",
  "optimizer": "CP_SAT",
  "replanMode": false
}
```

Provide endpoints or extend existing responses to expose:

- solver status;
- scenario;
- objective score;
- objective breakdown;
- solve duration;
- variable and constraint counts;
- candidate-pruning diagnostics;
- retained/moved/added/removed counts;
- legacy comparison when using shadow mode.

Do not expose sensitive implementation logs.

---

# Frontend requirements

Update the Auto Schedule UI minimally and consistently with the current design.

Add:

1. Scenario selection:
   - Conservative
   - Balanced
   - Revenue-focused
2. Optimizer status:
   - Optimal
   - Feasible
   - Infeasible
   - Timed out/unknown
3. A concise result summary:
   - sessions created;
   - forecast occupancy;
   - objective score;
   - solve duration;
   - protected sessions;
   - changes from previous plan.
4. An expandable `Optimization details` section for diagnostics.
5. In rolling-replan mode, visually distinguish:
   - retained;
   - moved;
   - added;
   - removed;
   - locked/protected.

Keep technical solver metrics collapsed by default.

Do not overload the primary schedule board with raw constraint details.

---

# Database requirements

Use Flyway/versioned migrations consistent with the current project.

Likely persistence additions include:

- optimizer/scenario on generation run;
- solver status and solve duration;
- objective score and breakdown;
- input snapshot/version;
- MarketArea and membership;
- plan revision/replan metadata;
- optional solver diagnostics JSON if the project already accepts JSONB.

Before adding new tables or columns, inspect the existing schema and reuse existing concepts.

Add indexes for actual query paths.

Do not edit old applied migrations.

---

# Testing requirements

## Unit tests

Test:

- candidate pruning;
- variable creation;
- room compatibility;
- operating-hour boundaries;
- overnight operation;
- cleanup buffers;
- fixed intervals;
- maximum concurrent room share;
- objective components;
- scenario weight mapping;
- solution mapping;
- solver-status mapping.

## Known-solution tests

Create small deterministic planning problems where the expected optimum is known.

Examples:

1. One room, two overlapping candidate screenings.
2. Two rooms with different format capabilities.
3. Prime-time demand competing for one premium room.
4. Existing locked showtime splitting room availability.
5. Weekly allocation where day-by-day greedy selection is suboptimal.
6. Multi-cluster staggering.
7. Replan where one showtime has bookings and cannot move.

## Invariant tests

Every generated plan must satisfy:

- no room overlap;
- operating hours;
- cleanup buffer;
- room capability;
- movie availability;
- planning bounds;
- locked-session protection;
- booked-session protection;
- stable business-date/timezone semantics.

## Integration tests

Cover:

- generation run → worker → weekly plan;
- retry/idempotency;
- partial persistence failure;
- review and publish;
- fallback to legacy;
- shadow comparison;
- rolling replan.

## Performance test

Create a realistic synthetic cluster/week dataset and record:

- candidates;
- variables;
- constraints;
- solve duration;
- status;
- memory usage if practical.

Set a documented solve-time limit.

A timeout returning a valid `FEASIBLE` solution is acceptable. A timeout must never be reported as `OPTIMAL`.

---

# Documentation deliverables

Update:

- `BUSINESS_RULES.md`
- `FEATURE_BRIEF.md`
- `API_LIST.md`
- `DEMO_SCRIPT.md`
- `AUTO_SHOWTIME_IMPLEMENTATION_PLAN.txt`

Create:

- `CONSTRAINT_OPTIMIZER_DESIGN.md`
- `CONSTRAINT_OPTIMIZER_TEST_PLAN.md`
- `MULTI_CLUSTER_REPLANNING.md`
- migration/rollback notes
- a Mermaid architecture diagram
- a Mermaid generation/replan sequence diagram

Document the mathematical model using sets, variables, constraints and objective terms.

Reference the official OR-Tools CP-SAT documentation:

<https://developers.google.com/optimization/cp>

---

# Acceptance criteria

The task is complete only when:

- [ ] CP-SAT can generate a weekly schedule for one CinemaCluster.
- [ ] The result satisfies every hard constraint.
- [ ] Existing locked/booked showtimes are preserved.
- [ ] Weekly optimization replaces independent daily selection in CP-SAT mode.
- [ ] Legacy mode remains available.
- [ ] Shadow comparison works without double publishing.
- [ ] Solver status and diagnostics are persisted.
- [ ] Scenario configuration changes objective weights without duplicating solver code.
- [ ] MarketArea supports multiple CinemaClusters.
- [ ] Multi-cluster staggering is modeled.
- [ ] Rolling replan changes only eligible unlocked regions.
- [ ] Replanning produces a reviewable draft, not an automatic active-schedule mutation.
- [ ] Unit, integration, invariant and known-solution tests pass.
- [ ] Existing unrelated tests remain passing.
- [ ] Production build succeeds.
- [ ] Documentation and API samples are updated.

---

# Required final response

After implementation, report:

1. Architecture audit findings.
2. Mathematical model implemented.
3. Files changed.
4. Database migrations added.
5. APIs added or changed.
6. Frontend changes.
7. Tests executed and results.
8. Solver benchmark result.
9. Known limitations.
10. Remaining follow-up work separated into P1 and P2.

Do not claim production readiness if forecasts are still baseline heuristics or performance has not been measured.

