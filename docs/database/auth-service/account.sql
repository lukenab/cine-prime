CREATE TABLE account
(
    account_id            VARCHAR(36)                 NOT NULL,
    username              VARCHAR(50)                 NOT NULL,
    email                 VARCHAR(100)                NOT NULL,
    password_hash         VARCHAR(255)                NOT NULL,
    status                VARCHAR(30)                 NOT NULL DEFAULT 'PENDING',
    failed_login_attempts INTEGER                     NOT NULL DEFAULT 0,
    locked_until          TIMESTAMP WITHOUT TIME ZONE,
    email_verified_at     TIMESTAMP WITHOUT TIME ZONE,
    last_login_at         TIMESTAMP WITHOUT TIME ZONE,
    created_at            TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_at            TIMESTAMP WITHOUT TIME ZONE,
    CONSTRAINT pk_account PRIMARY KEY (account_id)
);

CREATE TABLE account_role
(
    account_id VARCHAR(36) NOT NULL,
    role_name  VARCHAR(50) NOT NULL,
    CONSTRAINT pk_account_role PRIMARY KEY (account_id, role_name)
);

ALTER TABLE account
    ADD CONSTRAINT uc_account_email UNIQUE (email);

ALTER TABLE account
    ADD CONSTRAINT uc_account_username UNIQUE (username);

ALTER TABLE account_role
    ADD CONSTRAINT fk_accrol_on_account FOREIGN KEY (account_id) REFERENCES account (account_id);

ALTER TABLE account_role
    ADD CONSTRAINT fk_accrol_on_role FOREIGN KEY (role_name) REFERENCES roles (role_name);
