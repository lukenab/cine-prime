package authservice.repository;

import authservice.entity.AuthAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthAuditLogRepository extends JpaRepository<AuthAuditLog, String> {
}
