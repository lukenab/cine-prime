CREATE TABLE processed_event (
    source_event_id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE booking_revenue_fact (
    fact_id VARCHAR(100) PRIMARY KEY,
    source_event_id VARCHAR(100) NOT NULL UNIQUE,
    event_version VARCHAR(30) NOT NULL,
    booking_id VARCHAR(100) NOT NULL,
    cluster_id BIGINT NOT NULL,
    showtime_id BIGINT NOT NULL,
    business_date DATE NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    projected_at TIMESTAMPTZ NOT NULL,
    ticket_count INTEGER NOT NULL,
    ticket_amount NUMERIC(19,2) NOT NULL,
    concession_amount NUMERIC(19,2) NOT NULL,
    discount_amount NUMERIC(19,2) NOT NULL,
    final_amount NUMERIC(19,2) NOT NULL,
    refund_amount NUMERIC(19,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    outcome_status VARCHAR(30) NOT NULL
);

CREATE INDEX idx_booking_revenue_cluster_date
    ON booking_revenue_fact (cluster_id, business_date);
CREATE INDEX idx_booking_revenue_booking
    ON booking_revenue_fact (booking_id);
