CREATE TABLE account (
    account_id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT REFERENCES roles(role_id),
    status INT DEFAULT 1,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
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