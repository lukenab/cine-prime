package loyaltyservice.dto;

import loyaltyservice.entity.MembershipLevel;
import loyaltyservice.entity.MembershipStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminMembershipResponse(
        UUID membershipId,
        String accountId,
        MembershipLevel membershipLevel,
        MembershipStatus status,
        long availablePoints,
        long pendingPoints,
        BigDecimal lifetimeSpend,
        OffsetDateTime joinedAt) {
}
