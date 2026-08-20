CREATE TABLE workforce_employee_projection (
    account_id              VARCHAR(36) PRIMARY KEY,
    account_role            VARCHAR(40) NOT NULL,
    assignment_active       BOOLEAN NOT NULL,
    cinema_cluster_ids      VARCHAR(2000) NOT NULL DEFAULT '',
    last_event_id           VARCHAR(100) NOT NULL,
    last_event_version      VARCHAR(20) NOT NULL,
    last_assignment_version BIGINT NOT NULL,
    last_event_occurred_at  TIMESTAMPTZ NOT NULL,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shift_template (
    template_id       VARCHAR(36) PRIMARY KEY,
    cluster_id        VARCHAR(36),
    name              VARCHAR(100) NOT NULL,
    start_time        TIME NOT NULL,
    end_time          TIME NOT NULL,
    break_minutes     INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 240),
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_by        VARCHAR(36) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shift_template_name UNIQUE NULLS NOT DISTINCT (cluster_id, name)
);

CREATE TABLE roster_period (
    roster_id         VARCHAR(36) PRIMARY KEY,
    cluster_id        VARCHAR(36) NOT NULL,
    period_start      DATE NOT NULL,
    period_end        DATE NOT NULL,
    status            VARCHAR(20) NOT NULL,
    created_by        VARCHAR(36) NOT NULL,
    published_by      VARCHAR(36),
    published_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version           BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_roster_period CHECK (period_end >= period_start),
    CONSTRAINT uq_roster_period UNIQUE (cluster_id, period_start, period_end)
);

CREATE TABLE employee_shift (
    shift_id          VARCHAR(36) PRIMARY KEY,
    roster_id         VARCHAR(36) NOT NULL REFERENCES roster_period(roster_id) ON DELETE CASCADE,
    account_id        VARCHAR(36) NOT NULL,
    cluster_id        VARCHAR(36) NOT NULL,
    role_code         VARCHAR(50) NOT NULL,
    starts_at         TIMESTAMPTZ NOT NULL,
    ends_at           TIMESTAMPTZ NOT NULL,
    break_minutes     INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 240),
    status            VARCHAR(20) NOT NULL,
    note              VARCHAR(500),
    created_by        VARCHAR(36) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version           BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_employee_shift_time CHECK (ends_at > starts_at)
);
CREATE INDEX idx_employee_shift_account_time ON employee_shift(account_id, starts_at, ends_at);
CREATE INDEX idx_employee_shift_cluster_time ON employee_shift(cluster_id, starts_at);

CREATE TABLE time_punch (
    punch_id          VARCHAR(36) PRIMARY KEY,
    shift_id          VARCHAR(36) NOT NULL REFERENCES employee_shift(shift_id),
    account_id        VARCHAR(36) NOT NULL,
    punch_type        VARCHAR(20) NOT NULL,
    occurred_at       TIMESTAMPTZ NOT NULL,
    recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idempotency_key   VARCHAR(100) NOT NULL UNIQUE,
    source            VARCHAR(30) NOT NULL DEFAULT 'WEB'
);
CREATE INDEX idx_time_punch_shift ON time_punch(shift_id, occurred_at);

CREATE TABLE timesheet (
    timesheet_id       VARCHAR(36) PRIMARY KEY,
    account_id         VARCHAR(36) NOT NULL,
    cluster_id         VARCHAR(36) NOT NULL,
    period_start       DATE NOT NULL,
    period_end         DATE NOT NULL,
    status             VARCHAR(20) NOT NULL,
    regular_minutes    INTEGER NOT NULL DEFAULT 0,
    overtime_minutes   INTEGER NOT NULL DEFAULT 0,
    exception_count    INTEGER NOT NULL DEFAULT 0,
    submitted_at       TIMESTAMPTZ,
    reviewed_by        VARCHAR(36),
    reviewed_at        TIMESTAMPTZ,
    review_note        VARCHAR(1000),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version            BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_timesheet_period CHECK (period_end >= period_start),
    CONSTRAINT uq_timesheet_period UNIQUE (account_id, cluster_id, period_start, period_end)
);

CREATE TABLE timesheet_entry (
    entry_id           VARCHAR(36) PRIMARY KEY,
    timesheet_id       VARCHAR(36) NOT NULL REFERENCES timesheet(timesheet_id) ON DELETE CASCADE,
    shift_id           VARCHAR(36) NOT NULL UNIQUE REFERENCES employee_shift(shift_id),
    actual_start       TIMESTAMPTZ NOT NULL,
    actual_end         TIMESTAMPTZ NOT NULL,
    regular_minutes    INTEGER NOT NULL,
    overtime_minutes   INTEGER NOT NULL DEFAULT 0,
    payable_minutes    INTEGER NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_timesheet_entry_time CHECK (actual_end > actual_start)
);

CREATE TABLE attendance_exception (
    exception_id       VARCHAR(36) PRIMARY KEY,
    entry_id           VARCHAR(36) NOT NULL REFERENCES timesheet_entry(entry_id) ON DELETE CASCADE,
    exception_code     VARCHAR(30) NOT NULL,
    variance_minutes   INTEGER NOT NULL DEFAULT 0,
    status             VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    resolution_note    VARCHAR(1000),
    resolved_by        VARCHAR(36),
    resolved_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_attendance_exception UNIQUE (entry_id, exception_code)
);

CREATE TABLE shift_swap_request (
    request_id         VARCHAR(36) PRIMARY KEY,
    source_shift_id    VARCHAR(36) NOT NULL REFERENCES employee_shift(shift_id),
    requested_by       VARCHAR(36) NOT NULL,
    target_account_id  VARCHAR(36) NOT NULL,
    reason             VARCHAR(500),
    status             VARCHAR(20) NOT NULL,
    reviewed_by        VARCHAR(36),
    reviewed_at        TIMESTAMPTZ,
    review_note        VARCHAR(1000),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE leave_request (
    request_id         VARCHAR(36) PRIMARY KEY,
    account_id         VARCHAR(36) NOT NULL,
    cluster_id         VARCHAR(36) NOT NULL,
    leave_type         VARCHAR(30) NOT NULL,
    starts_at          TIMESTAMPTZ NOT NULL,
    ends_at            TIMESTAMPTZ NOT NULL,
    reason             VARCHAR(500),
    status             VARCHAR(20) NOT NULL,
    reviewed_by        VARCHAR(36),
    reviewed_at        TIMESTAMPTZ,
    review_note        VARCHAR(1000),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_leave_request_time CHECK (ends_at > starts_at)
);

CREATE TABLE workforce_audit_log (
    audit_id           VARCHAR(36) PRIMARY KEY,
    action             VARCHAR(60) NOT NULL,
    aggregate_type     VARCHAR(40) NOT NULL,
    aggregate_id       VARCHAR(36) NOT NULL,
    actor_account_id   VARCHAR(36) NOT NULL,
    details            TEXT,
    occurred_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workforce_audit_aggregate ON workforce_audit_log(aggregate_type, aggregate_id, occurred_at DESC);
