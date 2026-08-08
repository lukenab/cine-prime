package loyaltyservice.repository;

import loyaltyservice.entity.LedgerEntryStatus;
import loyaltyservice.entity.LoyaltyLedgerEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface LoyaltyLedgerEntryRepository extends JpaRepository<LoyaltyLedgerEntry, UUID> {
    Page<LoyaltyLedgerEntry> findByMembershipMembershipIdOrderByCreatedAtDesc(UUID membershipId, Pageable pageable);

    Optional<LoyaltyLedgerEntry> findByEventId(String eventId);

    Optional<LoyaltyLedgerEntry> findFirstByMembershipMembershipIdAndSourceTypeAndSourceIdOrderByCreatedAtDesc(
            UUID membershipId, String sourceType, String sourceId);

    @Query("select coalesce(sum(e.points), 0) from LoyaltyLedgerEntry e "
            + "where e.membership.membershipId = :membershipId and e.entryStatus = :status")
    long sumPointsByStatus(@Param("membershipId") UUID membershipId, @Param("status") LedgerEntryStatus status);

    @Query("select coalesce(sum(e.points), 0) from LoyaltyLedgerEntry e "
            + "where e.membership.membershipId = :membershipId and e.entryStatus = 'PENDING' and e.points > 0")
    long sumPendingPoints(@Param("membershipId") UUID membershipId);
}
