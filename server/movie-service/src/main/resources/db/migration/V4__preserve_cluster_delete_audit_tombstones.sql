-- A hard delete is allowed only for an unused DRAFT, but its DELETE audit event
-- must survive the parent row. Keep cluster_id as the immutable resource ID
-- rather than cascading the audit trail away with cinema_cluster.
ALTER TABLE cluster_audit_log
    DROP CONSTRAINT IF EXISTS cluster_audit_log_cluster_id_fkey;

COMMENT ON COLUMN cluster_audit_log.cluster_id IS
    'Immutable cluster resource ID. Deliberately not a foreign key so deletion tombstones are retained.';
