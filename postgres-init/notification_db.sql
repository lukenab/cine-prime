\c notification_db;

CREATE TABLE IF NOT EXISTS email_template (
    email_template_id BIGSERIAL PRIMARY KEY,
    code              VARCHAR(100) NOT NULL UNIQUE,
    subject           VARCHAR(255) NOT NULL,
    html_content      TEXT NOT NULL,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP
);
