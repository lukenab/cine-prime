package promotionservice.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import promotionservice.entity.Promotion;
import promotionservice.enums.PromotionStatus;

import java.util.UUID;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.List;

public interface PromotionRepository extends JpaRepository<Promotion, UUID> {
    boolean existsByCodeIgnoreCase(String code);

    Optional<Promotion> findByCodeIgnoreCase(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Promotion p where p.promotionId = :id")
    Optional<Promotion> findByIdForUpdate(UUID id);

    Page<Promotion> findByStatus(PromotionStatus status, Pageable pageable);

    @EntityGraph(attributePaths = "priceRule")
    @Query(value = """
            select p from Promotion p
            where (:status is null or p.status = :status)
              and (lower(p.name) like lower(concat('%', :query, '%'))
                   or lower(p.code) like lower(concat('%', :query, '%')))
            """,
            countQuery = """
            select count(p) from Promotion p
            where (:status is null or p.status = :status)
              and (lower(p.name) like lower(concat('%', :query, '%'))
                   or lower(p.code) like lower(concat('%', :query, '%')))
            """)
    Page<Promotion> searchAdmin(@Param("status") PromotionStatus status,
                                @Param("query") String query,
                                Pageable pageable);

    interface StatusCount {
        PromotionStatus getStatus();
        long getTotal();
    }

    @Query("select p.status as status, count(p) as total from Promotion p group by p.status")
    List<StatusCount> countByStatus();

    @EntityGraph(attributePaths = "priceRule")
    List<Promotion> findByStatusOrderByValidUntilAsc(PromotionStatus status);
}
