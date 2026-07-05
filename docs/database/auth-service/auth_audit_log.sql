CREATE TABLE auth_audit_log
(
    audit_id          VARCHAR(36)                 NOT NULL,
    actor_account_id  VARCHAR(36),
    target_account_id VARCHAR(36),
    action            VARCHAR(100)                NOT NULL,
    status            VARCHAR(20)                 NOT NULL,
    message           TEXT,
    user_agent        TEXT,
    metadata          TEXT,
    created_at        TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT pk_auth_audit_log PRIMARY KEY (audit_id)
);