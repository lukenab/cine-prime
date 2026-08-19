# P0/P1 staff access and approval operations

## Ownership boundaries

- `auth-service` owns credentials, sessions, token issuance, roles and permissions.
- `user-service` owns staff profiles, work assignments and the command that changes an assignment.
- Public `POST /api/accounts` provisions `MEMBER` only.
- Staff invitations use `POST /api/employees/invitations`; user-service calls the internal Auth provisioning contract.
- Staff role changes use `PUT /api/employees/{employeeId}/access-assignment`. Direct staff-role changes through `PUT /api/accounts/{accountId}` are rejected.
- An assignment change updates the Auth role, revokes existing sessions, commits the user-service assignment and publishes a versioned `STAFF_ACCESS_UPDATED` event. Auth continues issuing tokens from its local projection.

## Refund maker-checker workflow

1. A Finance Officer creates a draft with `POST /api/payments/admin/refunds/{refundId}/approval-requests`.
2. The same requester submits it with `POST /api/payments/admin/refund-approval-requests/{requestId}/submit`.
3. A different Finance Approver uses `/approve` or `/reject`.
4. After approval, a Finance Officer uses `/execute`; only this transition calls the provider retry.

States are `DRAFT -> SUBMITTED -> APPROVED|REJECTED`, with `APPROVED -> EXECUTED`. The requester cannot approve their own request. The legacy direct retry endpoint remains available only to `ADMIN`/`SUPER_ADMIN` during migration.

## Security administration

- Audit query: `GET /api/audit-events` with `action`, `status`, `actorAccountId`, `targetAccountId`, `from` and `to` filters.
- Audit detail: `GET /api/audit-events/{auditId}`.
- Audit CSV: `GET /api/audit-events/export` with the same filters.
- Role matrix: `PUT /api/roles/{roleName}/permissions` with `{ "permissions": ["..."] }`.
- `SUPER_ADMIN`, `ADMIN`, `SYSTEM_ADMIN` and `MEMBER` are protected matrices. A caller also cannot modify a role they currently hold.
- Staff cannot self-elevate through account update because staff roles are assignment-owned and the public account API rejects them.

## UI routes

- Finance workflow: `/admin/refunds-reconciliation`
- Security audit: `/admin/audit`
- Role-permission matrix: `/admin/access-matrix`

Business routes use JWT permissions for feature access. Legacy `ADMIN` and `SUPER_ADMIN` retain a temporary compatibility bypass.

## Deployment

Apply payment Flyway migration `V6__add_refund_approval_workflow.sql`, restart Auth, User, Payment and API Gateway, then sign in again so the token contains the current permission set.
