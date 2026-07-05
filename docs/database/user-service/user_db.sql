CREATE TABLE users (
    account_id    VARCHAR(36)  PRIMARY KEY,
    full_name     VARCHAR(100) NULL,
    email         VARCHAR(100) NULL,
    phone_number  VARCHAR(15)  UNIQUE,
    date_of_birth DATE         NULL,
    gender        VARCHAR(20)  NULL,
    address       VARCHAR(255) NULL,
    identity_card VARCHAR(20)  UNIQUE,
    avatar_url    VARCHAR(255) NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NULL
);

CREATE TABLE member (
    member_id        VARCHAR(36)    PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    account_id       VARCHAR(36)    NOT NULL UNIQUE REFERENCES users(account_id),
    loyalty_points   INT            NOT NULL DEFAULT 0,
    membership_level VARCHAR(20)    NOT NULL DEFAULT 'BRONZE',
    total_spent      DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP      NULL
);

CREATE TABLE employee (
    employee_id     VARCHAR(36) PRIMARY KEY,
    employee_code   VARCHAR(20) NOT NULL UNIQUE,
    account_id      VARCHAR(36) NOT NULL UNIQUE REFERENCES users(account_id),
    cinema_id       VARCHAR(36) NULL,
    position        VARCHAR(50) NULL,
    department      VARCHAR(30) NULL,
    employment_type VARCHAR(30) NULL,
    hire_date       DATE        NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP   NULL
);

CREATE TABLE audit_logs (
    id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    entity_name VARCHAR(255) NULL,
    entity_id   VARCHAR(255) NULL,
    action      VARCHAR(255) NULL,
    old_value   TEXT         NULL,
    new_value   TEXT         NULL,
    perform_by  VARCHAR(255) NULL,
    perform_at  TIMESTAMP    NULL
);