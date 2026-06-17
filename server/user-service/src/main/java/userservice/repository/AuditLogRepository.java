package userservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import userservice.entity.AuditLog;

public interface AuditLogRepository extends JpaRepository<AuditLog, String> {
}
