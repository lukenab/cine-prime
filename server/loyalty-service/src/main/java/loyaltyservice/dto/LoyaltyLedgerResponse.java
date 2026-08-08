package loyaltyservice.dto;

import loyaltyservice.entity.LedgerEntryStatus;
import loyaltyservice.entity.LedgerEntryType;

import java.time.OffsetDateTime;
import java.util.UUID;

public record LoyaltyLedgerResponse(
        UUID entryId,
        LedgerEntryType entryType,
        LedgerEntryStatus status,
        int points,
        String sourceType,
        String sourceId,
        Long clusterId,
        String description,
        OffsetDateTime createdAt) {
}
