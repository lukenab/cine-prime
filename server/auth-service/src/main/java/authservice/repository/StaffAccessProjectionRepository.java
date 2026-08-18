package authservice.repository;

import authservice.entity.StaffAccessProjection;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface StaffAccessProjectionRepository extends JpaRepository<StaffAccessProjection, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select projection from StaffAccessProjection projection where projection.accountId = :accountId")
    Optional<StaffAccessProjection> findByAccountIdForUpdate(@Param("accountId") String accountId);
}
