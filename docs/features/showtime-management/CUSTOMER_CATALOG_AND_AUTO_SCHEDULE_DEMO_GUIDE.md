# Customer movie catalogue and automatic showtime demo guide

## 1. Customer journey

The customer-facing catalogue follows this navigation model:

1. `Now Showing` and `Coming Soon` render movie posters.
2. Hovering a poster exposes:
   - **Buy tickets**: opens `/showtime/{movieId}`.
   - **Watch trailer**: opens the trailer player only.
3. The showtime page is the canonical movie detail and booking-entry page. It contains:
   - title, synopsis and poster;
   - age classification, runtime, release date, country and original language;
   - genres, director, cast and production companies;
   - available presentation formats;
   - city, cinema and date filters;
   - only customer-saleable showtimes.
4. Selecting a showtime opens the seat-selection journey.

Do not open a second movie-detail modal before this page. A trailer modal is acceptable because
it performs one focused task and does not duplicate the booking page.

## 2. Catalogue status rules

`Movie.status` represents the content workflow, not the exhibition/sales workflow.

### Visible in the public catalogue

A movie is publicly discoverable only when:

- content status is `APPROVED`;
- it has at least one `MovieAvailability` with status `PLANNED` or `OPEN`;
- the availability window has not ended.

### Coming Soon

A visible movie is `COMING_SOON` when it does not currently have a future saleable session at
any eligible cinema. Typical cases:

- availability is `PLANNED`;
- availability is `OPEN`, but the generated plan has not been published/opened for sale;
- its saleable sessions begin at a later date.

### Now Showing

A visible movie is `NOW_SHOWING` only when at least one cinema has:

- an `OPEN` availability window; and
- a future showtime whose sale lifecycle is `ON_SALE`.

`APPROVED`, `releaseDate <= today`, or a `SCHEDULED` showtime alone is not enough.

## 3. Prerequisites for a seven-day, ten-movie demo

Prepare these resources before creating the generation run.

### Cinema resources

- At least one `ACTIVE` cinema cluster.
- Operating hours for every day in the seven-day scope.
- Prefer four or more `ACTIVE` rooms for ten films.
- Every room has an `ACTIVE`, sellable seat layout.
- Room format capabilities match the movie screening versions.
- Room audio capability is compatible with the selected versions.
- No unresolved maintenance overlaps in the planning window.

### Movie resources

For each of the ten movies:

- content is `APPROVED`;
- duration is present and realistic;
- at least one `ACTIVE` screening version is effective during the planning window;
- the version contains presentation format and language/audio metadata;
- a scheduling profile exists;
- a `MovieAvailability` covers the target cluster and dates.

Use a practical demo mix:

- 6 movies intended to become `NOW_SHOWING`;
- 4 movies retained as `COMING_SOON`;
- 2–3 demand tiers instead of assigning the same popularity to every movie;
- primarily 2D versions, with a small number of 3D/IMAX versions only where rooms support them.

## 4. Recommended demo sequence

### Step 1 — Prepare catalogue content

1. Import ten movies from TMDB.
2. Review imported metadata, official trailer, poster, age rating and screening versions.
3. Save and submit each movie.
4. Approve the ten movies.

Expected result: approved content is not automatically treated as now showing.

### Step 2 — Create cluster release plans

1. Create availability windows for all ten movies and the demo cluster.
2. Cover the same seven-day interval used by auto-generation.
3. Keep the six sale-ready movies `OPEN`.
4. Keep the four preview titles `PLANNED`, or schedule their first sale date later in the week.

Expected result: the movies can appear in the catalogue, but only saleable movies become
`NOW_SHOWING`.

### Step 3 — Validate physical and version compatibility

For every movie selected in the run, verify at least one valid tuple:

`movie screening version × active room × room format × room audio × active layout`

If one selected movie has no valid candidate, remove it from the run or fix its prerequisite
instead of weakening the constraints.

### Step 4 — Run the optimizer

Submit:

```json
{
  "startDate": "2026-07-27",
  "endDate": "2026-08-02",
  "cinemaClusterIds": [43],
  "movieIds": [41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
  "optimizer": "CP_SAT",
  "scenario": "BALANCED",
  "replanMode": false
}
```

For a safe live demo:

1. Run `SHADOW_COMPARE` beforehand to compare CP-SAT with Legacy without changing the official
   Legacy result.
2. Use `CP_SAT` only after a full service restart and one successful rehearsal.
3. Keep a previously generated reviewable plan as a fallback.

### Step 5 — Review and publish

1. Inspect per-cinema and per-room schedule cards.
2. Resolve blockers, operating-hour violations, incompatible formats and overlaps.
3. Submit the plan for review.
4. Publish the approved plan.

Publishing materializes `SCHEDULED` showtimes. It does not silently make every session public.
Open only the intended sessions for sale by transitioning them to `ON_SALE`.

### Step 6 — Verify the customer journey

1. Open the movie catalogue.
2. Confirm the six movies with future `ON_SALE` sessions appear under `Now Showing`.
3. Confirm preview-only movies remain under `Coming Soon`.
4. Select **Buy tickets** and verify city → cinema → date → format → showtime.
5. Select a showtime and verify the active room layout and current seat inventory are loaded.

## 5. Legacy Greedy and CP-SAT

Assume two rooms and three movies:

| Movie | Demand | Valid slots |
|---|---:|---|
| A | 95 | R1 18:00, R1 20:30, R2 18:00 |
| B | 75 | R1 18:00, R2 18:00, R2 20:30 |
| C | 55 | R1 20:30, R2 20:30 |

### Legacy Greedy

Legacy scores individual candidates, sorts them, satisfies minimum coverage in a round-robin pass,
then fills remaining capacity using the next highest score.

```text
rank candidates → choose best currently-valid candidate → block conflicts → repeat
```

It may choose `A/R1/18:00` first because that candidate has the highest local score. That decision
can block a combination such as `B/R1/18:00 + A/R1/20:30` that produces a higher total weekly
objective.

Advantages:

- fast, deterministic and easy to explain;
- safe fallback with low operational overhead;
- good enough for small, lightly constrained scopes.

Limitations:

- early choices cannot be reconsidered;
- optimizes local candidates rather than proving a global weekly optimum;
- solution quality falls as formats, rooms, quotas and cross-day constraints increase.

### CP-SAT

CP-SAT creates a binary variable for every eligible candidate:

```text
x[movie, version, room, date, startSlot] ∈ {0,1}
```

It evaluates combinations together and enforces constraints such as room non-overlap, concurrency,
minimum weekly coverage, staggering and maximum daily allocations. It then maximizes the total
objective instead of accepting the first locally attractive slot.

Advantages:

- jointly optimizes the whole requested week;
- models hard constraints and soft shortfall penalties explicitly;
- can report feasible, optimal or infeasible solver states.

Limitations:

- more complex to operate and explain;
- solve time and memory grow with candidate count;
- native OR-Tools deployment and timeout/fallback behavior require rehearsal and monitoring.

## 6. Current gaps

### P0 before relying on production behavior

- CP-SAT has not yet been proven by a repeatable real-data full-pipeline run in the target runtime.
- A full integration test is still needed for generation → review → publish → `ON_SALE` →
  customer lookup.
- Public aggregate catalogue status currently requires per-availability next-showtime lookups;
  replace this N+1 access pattern with a bulk query before operating at large catalogue scale.

### P1 planning quality

- Candidate demand uses heuristic weights; it is not yet trained from ticket sales, occupancy,
  booking pace or cluster-specific history.
- Weekly CP-SAT does not yet model every commercial objective such as revenue, prime-time fairness,
  distributor commitments or stable schedule-change cost.
- Gap and stability policy terms are not fully represented in the objective.
- Manual bulk showtime behavior must use the same cluster operating-hours source as automatic
  generation.

### P2 multi-cluster optimization

- `replanMode=true` is deliberately rejected; rolling replanning is not implemented.
- No `MarketArea` coordination or staggering across nearby clusters.
- No cluster-specific demand forecast or booking-pace feedback loop.
- No protected replan boundary for sessions with bookings or operational locks.
