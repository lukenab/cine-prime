package movieservice.repository;

import movieservice.entity.ClusterAuditLog;
import movieservice.enums.ClusterAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClusterAuditLogRepository extends JpaRepository<ClusterAuditLog, String> {

    List<ClusterAuditLog> findByClusterIdOrderByTimestampDesc(Long clusterId);

    boolean existsByClusterIdAndActionIn(Long clusterId, List<ClusterAction> actions);
}
