-- ============================================================
-- user_db schema
-- Kết nối: psql -U postgres -d user_db
-- ============================================================

-- ── 1. USERS ──────────────────────────────────────────────
-- account_id là FK sang auth_db.account (cross-DB, không có FK constraint)
CREATE TABLE IF NOT EXISTS users (
    account_id      VARCHAR(36)  PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NULL,          -- sync từ auth_db qua Kafka
    phone_number    VARCHAR(15)  NULL UNIQUE,   -- [FIX] thêm UNIQUE
    date_of_birth   DATE         NULL,
    -- [FIX] CHECK constraint thay vì string tự do
    gender          VARCHAR(20)  NULL CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    address         VARCHAR(255) NULL,
    identity_card   VARCHAR(20)  NULL UNIQUE,   -- [FIX] thêm UNIQUE
    avatar_url      VARCHAR(255) NULL,
    -- [FIX] columnDefinition DEFAULT TRUE ở cả DB level
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email         ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone_number  ON users (phone_number);

-- ── 2. MEMBER ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member (
    -- [FIX] UUID thay vì varchar(10) không rõ format
    member_id        VARCHAR(36)     PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id       VARCHAR(36)     NOT NULL UNIQUE REFERENCES users(account_id) ON DELETE CASCADE,
    loyalty_points   INT             NOT NULL DEFAULT 0,
    -- [FIX] CHECK constraint cho membership_level
    membership_level VARCHAR(20)     NOT NULL DEFAULT 'BRONZE'
                                     CHECK (membership_level IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
    total_spent      DECIMAL(12, 2)  NOT NULL DEFAULT 0,
    -- [FIX] Thêm DEFAULT NOW() — entity thiếu @CreationTimestamp/@UpdateTimestamp
    created_at       TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP       NULL
);

-- ── 3. EMPLOYEE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee (
    employee_id     VARCHAR(36) PRIMARY KEY,
    employee_code   VARCHAR(20) NOT NULL UNIQUE,
    account_id      VARCHAR(36) NOT NULL UNIQUE REFERENCES users(account_id) ON DELETE CASCADE,
    cinema_id       VARCHAR(36) NULL,
    position        VARCHAR(50) NULL CHECK (position IN (
                        'STAFF', 'SUPERVISOR', 'MANAGER'
                    )),
    department      VARCHAR(30) NULL CHECK (department IN (
                        'BOX_OFFICE', 'CONCESSION', 'FLOOR',
                        'PROJECTION', 'CUSTOMER_SERVICE', 'MANAGEMENT'
                    )),
    employment_type VARCHAR(30) NULL CHECK (employment_type IN (
                        'FULL_TIME', 'PART_TIME', 'PROBATION', 'INTERN', 'CONTRACT'
                    )),
    hire_date       DATE        NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                                CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP   NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_cinema_id ON employee (cinema_id);

-- ── 4. AUDIT_LOGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    entity_name VARCHAR(100) NULL,
    entity_id   VARCHAR(36)  NULL,
    action      VARCHAR(50)  NULL,
    old_value   TEXT         NULL,
    new_value   TEXT         NULL,
    perform_by  VARCHAR(36)  NULL,
    perform_at  TIMESTAMP    NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity    ON audit_logs (entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_perform_by ON audit_logs (perform_by);
