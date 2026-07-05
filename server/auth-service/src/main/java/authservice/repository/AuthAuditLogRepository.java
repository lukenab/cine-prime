package authservice.repository;

import authservice.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AuthAuditLogRepository extends JpaRepository<AuditLog, String> {

    // Tra cứu lịch sử bảo mật theo account (dùng cho admin audit)
    List<AuditLog> findByActorAccountIdOrderByCreatedAtDesc(String actorAccountId);
}
