# Extended-demo authorization and branch-scope matrix

Status: implemented baseline for issue #287

Roles: `SUPER_ADMIN`, `ADMIN`, `BRANCH_MANAGER`, `EMPLOYEE`, `MEMBER`

## Security invariants

- Missing/invalid authentication returns `401`; an authenticated principal that
  lacks permission or branch ownership returns `403`.
- `ADMIN`/`SUPER_ADMIN` have global branch scope.
- `BRANCH_MANAGER` and `EMPLOYEE` may operate only cluster IDs in the signed JWT
  claims `cinemaClusterIds` (preferred), `clusterIds`, `cinemaClusterId` or
  `clusterId`. A cluster ID in a URL/query/body never grants access by itself.
- `MEMBER` accesses only resources whose stored `accountId`/`customerId` equals
  the signed JWT `accountId`.
- Internal service APIs use `X-Internal-Service-Key` backed by
  `INTERNAL_SERVICE_KEY`, or an independently verified provider signature. They
  are not routed publicly by API Gateway.
- Frontend visibility is convenience only; every rule is enforced server-side.

## Implemented endpoint matrix

| Resource/API | ADMIN | BRANCH_MANAGER | EMPLOYEE | MEMBER | Anonymous | Server enforcement |
|---|---:|---:|---:|---:|---:|---|
| Customer booking create/history/detail/cancel/ticket/concession attach | Own/all only through admin APIs | Own | Own | Own | Deny | signed `accountId` and persisted booking owner |
| `/api/booking-operations/clusters/{clusterId}/**` | All branches | Assigned only | Assigned only | Deny | Deny | method role + `JwtBranchScope` |
| Concession product/SKU draft workflow | All | Allowed workflow | Deny | Deny | Deny | method role; approval remains ADMIN-only |
| `/api/admin/cinemas/{clusterId}/concession-*` | All branches | Assigned only | Deny | Deny | Deny | URL role + `JwtBranchScope` on every handler |
| `/api/employee/concession-orders` | All branches | Assigned only | Assigned only | Deny | Deny | URL role + `JwtBranchScope` |
| Customer concession reservation read/release | Own | Own | Own | Own | Deny | stored `customer_id` equals JWT `accountId` |
| Payment session/detail | Own | Own | Own | Own | Deny | stored payment owner |
| Payment admin attempts/reconciliation | All | Deny (no cluster projection yet) | Deny | Deny | Deny | ADMIN/SUPER_ADMIN method role |
| Booking payment webhook | Provider only | Provider only | Provider only | Provider only | Signature required | HMAC `X-Webhook-Signature` |
| Payment refund/concession internal reservation | Service only | Service only | Service only | Service only | Key required | constant-time `X-Internal-Service-Key` validation |

## Planned extended-demo APIs

The modules below are not all implemented yet. Their controllers must apply this
matrix when introduced; a missing endpoint is not treated as completed security.

| API | ADMIN | BRANCH_MANAGER | MEMBER | Required resource check |
|---|---:|---:|---:|---|
| `/api/refunds/admin/**`, `/api/reconciliation/admin/**` | All | Assigned branch | Deny | stored booking/payment cluster |
| `/api/refunds/customer/**` | All | Deny | Own | stored booking account |
| `/api/promotions/admin/**` | All | Assigned branch only if promotion is branch-scoped | Deny | promotion scope/cluster assignment |
| `/api/promotions/validate|reserve|commit|release` | Internal service | Internal service | Deny | internal credential + booking context |
| `/api/reviews/**` customer command | Moderate | Moderate assigned branch | Own | completed booking account and movie eligibility |
| `/api/analytics/admin/summary` | All | Assigned branch | Deny | force/filter requested cluster against signed assignment |

## JWT and gateway contract

`auth-service` emits roles/permissions in the signed `scope` claim and resolves
active employee assignments from the internal user-service scope endpoint when
issuing an EMPLOYEE/BRANCH_MANAGER token. Assignments are stored in
`cinemaClusterIds`; a missing/disabled assignment fails closed. API Gateway does
not route `/api/internal/employees/**`, and must continue to strip externally
supplied identity/branch headers.

## Verification checklist for each new endpoint

1. unauthenticated request -> `401`;
2. authenticated wrong role -> `403`;
3. Branch Manager assigned to cluster A can access A;
4. the same token cannot access cluster B even if B is supplied by the client;
5. MEMBER can access own resource and cannot access another account's resource;
6. missing/wrong internal key or signature is rejected;
7. repository query includes owner/cluster predicate rather than filtering after
   an unrestricted list query.
