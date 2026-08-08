CREATE TABLE membership_account (
    membership_id UUID PRIMARY KEY,
    account_id VARCHAR(100) NOT NULL UNIQUE,
    membership_level VARCHAR(30) NOT NULL DEFAULT 'MEMBER',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    lifetime_spend NUMERIC(19,2) NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loyalty_ledger_entry (
    entry_id UUID PRIMARY KEY,
    membership_id UUID NOT NULL REFERENCES membership_account(membership_id),
    event_id VARCHAR(150) NOT NULL UNIQUE,
    entry_type VARCHAR(30) NOT NULL,
    entry_status VARCHAR(30) NOT NULL,
    points INTEGER NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_id VARCHAR(150),
    cluster_id BIGINT,
    description VARCHAR(300) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loyalty_processed_event (
    event_id VARCHAR(150) PRIMARY KEY,
    event_type VARCHAR(80) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loyalty_ledger_membership_created
    ON loyalty_ledger_entry (membership_id, created_at DESC);
CREATE INDEX idx_loyalty_ledger_source
    ON loyalty_ledger_entry (source_type, source_id);
