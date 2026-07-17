package movieservice.repository;

import movieservice.entity.RoomLayoutAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomLayoutAuditLogRepository extends JpaRepository<RoomLayoutAuditLog, String> {

    List<RoomLayoutAuditLog> findByRoomLayoutIdOrderByTimestampDesc(Long roomLayoutId);
}
