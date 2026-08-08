# Analytics Service

Analytics is a read-only projection of booking outcomes. It consumes the
canonical `BOOKING_CONFIRMED` and `BOOKING_REFUNDED` events from
`booking.events.v1`, stores a dedicated revenue fact model, and exposes the
branch-scoped Admin analytics APIs. The P1 read model includes previous-period
comparison, average order value, refund rate, branch ranking and projection
freshness.

The service does not query the Booking Service database. Event IDs are stored
in `processed_event`, so Kafka retries do not double-count a booking.

## Local API

```text
GET http://localhost:8089/api/analytics/admin/summary?clusterId=43&from=2026-08-01&to=2026-08-07
GET http://localhost:8089/api/analytics/admin/daily?clusterId=43&from=2026-08-01&to=2026-08-07
GET http://localhost:8089/api/analytics/admin/branch-ranking?from=2026-08-01&to=2026-08-07
```

The API requires an ADMIN, SUPER_ADMIN or BRANCH_MANAGER JWT. Branch managers
can only query cluster IDs present in their signed token scope.

## Local dependencies

```text
PostgreSQL: localhost:5433/analytics_db
Kafka:      localhost:9092
Eureka:     localhost:8761
```

If the PostgreSQL Docker volume was created before Analytics was added, run
`powershell -ExecutionPolicy Bypass -File .\scripts\create-analytics-database.ps1`
once before starting the service. Flyway creates the projection tables on the
first Analytics startup. The repeatable migration
`db/seed/R__demo_analytics.sql` inserts 30 deterministic facts for
2026-07-25..2026-08-07, including confirmed and refunded bookings, so the
dashboard can demonstrate trends and previous-period comparisons. The demo
facts use real movie-service branch IDs: `43` (Landmark 81), `25` (Thủ Đức),
and `3` (Hoàn Kiếm). They are idempotent on `source_event_id`.

The summary response exposes `averageOrderValue`, `refundRate`, `dataThrough`,
`dataFreshnessSeconds`, `dataFreshnessStatus` and a `previousPeriod` object.
Branch ranking is sorted by gross revenue and is filtered by the caller's
signed JWT branch scope. Occupancy, top-movie, promotion and loyalty
projections are separate read models and are not inferred from incomplete
operational tables.
