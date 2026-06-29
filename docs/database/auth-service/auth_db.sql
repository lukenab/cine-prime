CREATE TABLE account (
    account_id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status INT DEFAULT 1,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    role_name VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255)
);

CREATE TABLE permission (
    name VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255)
);

CREATE TABLE account_role (
    account_id VARCHAR(36) NOT NULL REFERENCES account(account_id),
    role_name VARCHAR(50) NOT NULL REFERENCES roles(role_name),
    PRIMARY KEY (account_id, role_name)
);

CREATE TABLE role_permissions (
    role_name VARCHAR(50) NOT NULL REFERENCES roles(role_name),
    permission_name VARCHAR(50) NOT NULL REFERENCES permission(name),
    PRIMARY KEY (role_name, permission_name)
);

CREATE TABLE auth_token (
    token_id BIGSERIAL PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL REFERENCES account(account_id),
    token_type VARCHAR(20) DEFAULT 'BEARER',
    jwt_id VARCHAR(100) NOT NULL UNIQUE,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_ip INET,
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_reset (
    reset_id BIGSERIAL PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL REFERENCES account(account_id),
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    is_used BOOLEAN DEFAULT FALSE,
    created_ip INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE auth_audit_log (
    audit_id VARCHAR(36) PRIMARY KEY,
    actor_account_id VARCHAR(36),
    target_account_id VARCHAR(36),
    action VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
