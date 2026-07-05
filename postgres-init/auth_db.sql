-- ============================================================
-- auth_db schema
-- Kết nối: psql -U postgres -d auth_db
-- ============================================================

-- ── 1. PERMISSION ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permission (
    name        VARCHAR(100) PRIMARY KEY,
    description VARCHAR(255)
);

-- ── 2. ROLES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    role_name   VARCHAR(50)  PRIMARY KEY,
    description VARCHAR(255)
);

-- ── 3. ROLE_PERMISSIONS (join table) ──────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
    role_name       VARCHAR(50)  NOT NULL REFERENCES roles(role_name)      ON DELETE CASCADE,
    permission_name VARCHAR(100) NOT NULL REFERENCES permission(name)       ON DELETE CASCADE,
    PRIMARY KEY (role_name, permission_name)
);

-- ── 4. ACCOUNT ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account (
    account_id              VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    username                VARCHAR(50)  NOT NULL UNIQUE,
    email                   VARCHAR(100) NOT NULL UNIQUE,
    password_hash           VARCHAR(255) NOT NULL,

    -- [FIX] varchar(30) thay vì varchar(10) để chứa được PENDING_VERIFICATION
    status                  VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',

    -- [BEST PRACTICE] Brute-force protection
    failed_login_attempts   INT          NOT NULL DEFAULT 0,
    locked_until            TIMESTAMP    NULL,

    -- [BEST PRACTICE] Email verification tracking
    email_verified_at       TIMESTAMP    NULL,

    last_login_at           TIMESTAMP    NULL,
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP    NULL
);

-- ── 5. ACCOUNT_ROLE (join table) ──────────────────────────
CREATE TABLE IF NOT EXISTS account_role (
    account_id VARCHAR(36) NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
    role_name  VARCHAR(50) NOT NULL REFERENCES roles(role_name)    ON DELETE CASCADE,
    PRIMARY KEY (account_id, role_name)
);

-- ── 6. AUTH_TOKEN ─────────────────────────────────────────
-- Dùng để blacklist JWT khi logout
-- [FIX] Không lưu full token string — chỉ cần jwt_id để revoke
CREATE TABLE IF NOT EXISTS auth_token (
    token_id    BIGSERIAL    PRIMARY KEY,
    account_id  VARCHAR(36)  NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
    token_type  VARCHAR(20)  NOT NULL DEFAULT 'BEARER',
    jwt_id      VARCHAR(100) NOT NULL UNIQUE,       -- jti claim trong JWT
    expires_at  TIMESTAMPTZ  NOT NULL,
    issued_at   TIMESTAMPTZ  NOT NULL,
    revoked_at  TIMESTAMPTZ  NULL,
    is_revoked  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_ip  INET         NULL,
    user_agent  VARCHAR(255) NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_token_account_id   ON auth_token (account_id);
CREATE INDEX IF NOT EXISTS idx_auth_token_is_revoked   ON auth_token (is_revoked);
CREATE INDEX IF NOT EXISTS idx_auth_token_expires_at   ON auth_token (expires_at); -- cleanup job

-- ── 7. AUTH_AUDIT_LOG ─────────────────────────────────────
-- [FIX] action và status dùng ENUM thay vì varchar tự do
CREATE TYPE auth_action_type AS ENUM (
    'LOGIN',
    'LOGOUT',
    'REGISTER',
    'OTP_SENT',
    'OTP_VERIFIED',
    'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED',
    'ACCOUNT_LOCKED',
    'ADMIN_CREATE_ACCOUNT'
);

CREATE TYPE auth_status_type AS ENUM (
    'SUCCESS',
    'FAILED'
);

CREATE TABLE IF NOT EXISTS auth_audit_log (
    audit_id            VARCHAR(36)         PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    actor_account_id    VARCHAR(36)         NULL,   -- ai thực hiện (null = anonymous)
    target_account_id   VARCHAR(36)         NULL,   -- tác động lên ai
    action              auth_action_type    NOT NULL,
    status              auth_status_type    NOT NULL,
    message             TEXT                NULL,
    ip_address          VARCHAR(45)         NULL,   -- VARCHAR(45) để chứa được IPv6
    user_agent          TEXT                NULL,
    -- [FIX] JSONB thay vì TEXT để query được
    metadata            JSONB               NULL,
    created_at          TIMESTAMP           NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor    ON auth_audit_log (actor_account_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target   ON auth_audit_log (target_account_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action   ON auth_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created  ON auth_audit_log (created_at DESC);

-- ── 8. PASSWORD_RESET ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset (
    reset_id    BIGSERIAL    PRIMARY KEY,
    account_id  VARCHAR(36)  NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used_at     TIMESTAMPTZ  NULL,
    is_used     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_ip  INET         NULL,
    -- [FIX] Thêm DEFAULT NOW() — entity thiếu @CreationTimestamp
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset (expires_at); -- cleanup job

-- ── SEED DATA ─────────────────────────────────────────────
INSERT INTO permission (name, description) VALUES
    ('READ_MOVIE',       'Xem danh sách phim'),
    ('MANAGE_MOVIE',     'Tạo/sửa/xóa phim'),
    ('MANAGE_SHOWTIME',  'Quản lý lịch chiếu'),
    ('MANAGE_ACCOUNT',   'Quản lý tài khoản'),
    ('READ_BOOKING',     'Xem đơn đặt vé'),
    ('MANAGE_BOOKING',   'Quản lý đơn đặt vé'),
    ('MANAGE_EMPLOYEE',  'Quản lý nhân viên')
ON CONFLICT DO NOTHING;

INSERT INTO roles (role_name, description) VALUES
    ('ADMIN',    'Quản trị viên hệ thống'),
    ('USER',     'Khách hàng'),
    ('EMPLOYEE', 'Nhân viên rạp')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_name, permission_name) VALUES
    ('ADMIN', 'READ_MOVIE'),
    ('ADMIN', 'MANAGE_MOVIE'),
    ('ADMIN', 'MANAGE_SHOWTIME'),
    ('ADMIN', 'MANAGE_ACCOUNT'),
    ('ADMIN', 'READ_BOOKING'),
    ('ADMIN', 'MANAGE_BOOKING'),
    ('ADMIN', 'MANAGE_EMPLOYEE'),
    ('USER',  'READ_MOVIE'),
    ('USER',  'READ_BOOKING'),
    ('EMPLOYEE', 'READ_MOVIE'),
    ('EMPLOYEE', 'MANAGE_BOOKING'),
    ('EMPLOYEE', 'READ_BOOKING')
ON CONFLICT DO NOTHING;
