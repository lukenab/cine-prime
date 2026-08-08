package loyaltyservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import loyaltyservice.dto.AdminMembershipResponse;
import loyaltyservice.dto.AdjustPointsRequest;
import loyaltyservice.dto.LoyaltyLedgerResponse;
import loyaltyservice.dto.MembershipSummaryResponse;
import loyaltyservice.entity.LedgerEntryStatus;
import loyaltyservice.entity.LedgerEntryType;
import loyaltyservice.entity.LoyaltyLedgerEntry;
import loyaltyservice.entity.MembershipAccount;
import loyaltyservice.entity.MembershipLevel;
import loyaltyservice.entity.MembershipStatus;
import loyaltyservice.entity.ProcessedLoyaltyEvent;
import loyaltyservice.repository.LoyaltyLedgerEntryRepository;
import loyaltyservice.repository.MembershipAccountRepository;
import loyaltyservice.repository.ProcessedLoyaltyEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.event.CanonicalEventEnvelope;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoyaltyService {
    private static final String BOOKING_CONFIRMED = "BOOKING_CONFIRMED";
    private static final String BOOKING_REFUNDED = "BOOKING_REFUNDED";
    private static final String BOOKING_CANCELLED = "BOOKING_CANCELLED";
    private static final String SHOWTIME_COMPLETED = "SHOWTIME_COMPLETED";
    private static final String TICKET_CHECKED_IN = "TICKET_CHECKED_IN";

    private final ObjectMapper objectMapper;
    private final MembershipAccountRepository membershipRepository;
    private final LoyaltyLedgerEntryRepository ledgerRepository;
    private final ProcessedLoyaltyEventRepository processedEventRepository;

    @Value("${loyalty.points.earn-per-vnd:10000}")
    private int earnPerVnd;

    @Transactional
    public MembershipAccount getOrCreate(String accountId) {
        if (accountId == null || accountId.isBlank()) {
            throw new IllegalArgumentException("accountId is required");
        }
        return membershipRepository.findByAccountId(accountId).orElseGet(() -> membershipRepository.save(
                MembershipAccount.builder().membershipId(UUID.randomUUID()).accountId(accountId.trim()).build()));
    }

    @Transactional
    public MembershipSummaryResponse summary(String accountId) {
        MembershipAccount account = getOrCreate(accountId);
        long available = ledgerRepository.sumPointsByStatus(account.getMembershipId(), LedgerEntryStatus.POSTED);
        long pending = ledgerRepository.sumPendingPoints(account.getMembershipId());
        TierProgress progress = tierProgress(account.getLifetimeSpend());
        return new MembershipSummaryResponse(account.getMembershipId(), account.getAccountId(),
                account.getMembershipLevel(), account.getStatus(), available, pending,
                account.getLifetimeSpend(), account.getJoinedAt(), progress.nextLevel(),
                progress.threshold(), progress.percent());
    }

    @Transactional
    public Page<LoyaltyLedgerResponse> ledger(String accountId, Pageable pageable) {
        MembershipAccount account = getOrCreate(accountId);
        return ledgerRepository.findByMembershipMembershipIdOrderByCreatedAtDesc(account.getMembershipId(), pageable)
                .map(entry -> new LoyaltyLedgerResponse(entry.getEntryId(), entry.getEntryType(),
                        entry.getEntryStatus(), entry.getPoints(), entry.getSourceType(), entry.getSourceId(),
                        entry.getClusterId(), entry.getDescription(), entry.getCreatedAt()));
    }

    @Transactional(readOnly = true)
    public Page<AdminMembershipResponse> members(Pageable pageable) {
        return membershipRepository.findAll(pageable).map(account -> {
            long available = ledgerRepository.sumPointsByStatus(account.getMembershipId(), LedgerEntryStatus.POSTED);
            long pending = ledgerRepository.sumPendingPoints(account.getMembershipId());
            return new AdminMembershipResponse(account.getMembershipId(), account.getAccountId(),
                    account.getMembershipLevel(), account.getStatus(), available, pending,
                    account.getLifetimeSpend(), account.getJoinedAt());
        });
    }

    @Transactional(readOnly = true)
    public Page<LoyaltyLedgerResponse> adminLedger(String accountId, Pageable pageable) {
        return ledger(accountId, pageable);
    }

    @Transactional
    public LoyaltyLedgerResponse adjust(String accountId, AdjustPointsRequest request) {
        MembershipAccount account = getOrCreate(accountId);
        String eventId = "ADMIN_ADJUST:" + request.idempotencyKey().trim();
        if (ledgerRepository.findByEventId(eventId).isPresent()) {
            return toResponse(ledgerRepository.findByEventId(eventId)
                    .orElseThrow(() -> new IllegalStateException("Adjustment already exists")));
        }
        LoyaltyLedgerEntry entry = ledgerRepository.save(LoyaltyLedgerEntry.builder()
                .membership(account).eventId(eventId).entryType(LedgerEntryType.ADJUST)
                .entryStatus(LedgerEntryStatus.POSTED).points(request.points())
                .sourceType("ADMIN").sourceId(request.idempotencyKey()).description(request.reason().trim()).build());
        return toResponse(entry);
    }

    @Transactional
    public void settleBooking(String accountId, String bookingId) {
        MembershipAccount account = getOrCreate(accountId);
        ledgerRepository.findFirstByMembershipMembershipIdAndSourceTypeAndSourceIdOrderByCreatedAtDesc(
                account.getMembershipId(), "BOOKING", bookingId).ifPresent(entry -> {
            if (entry.getEntryStatus() == LedgerEntryStatus.PENDING) {
                entry.setEntryStatus(LedgerEntryStatus.POSTED);
                ledgerRepository.save(entry);
            }
        });
    }

    @Transactional
    public void consume(String message) {
        CanonicalEventEnvelope<JsonNode> envelope = parseEnvelope(message);
        if (processedEventRepository.existsById(envelope.eventId())) {
            return;
        }
        JsonNode payload = envelope.payload();
        String accountId = text(payload, "accountId");
        if (accountId == null || accountId.isBlank()) {
            log.debug("Ignoring loyalty event {} because accountId is missing", envelope.eventId());
            markProcessed(envelope);
            return;
        }
        MembershipAccount account = getOrCreate(accountId);
        switch (envelope.eventType()) {
            case BOOKING_CONFIRMED -> confirmBooking(account, envelope, payload);
            case SHOWTIME_COMPLETED, TICKET_CHECKED_IN -> settleBooking(accountId, text(payload, "bookingId"));
            case BOOKING_REFUNDED -> refundBooking(account, envelope, payload);
            case BOOKING_CANCELLED -> cancelBooking(account, text(payload, "bookingId"));
            default -> { }
        }
        markProcessed(envelope);
    }

    private void confirmBooking(MembershipAccount account, CanonicalEventEnvelope<JsonNode> envelope, JsonNode payload) {
        String bookingId = required(payload, "bookingId");
        BigDecimal eligible = decimal(payload, "ticketAmount").add(decimal(payload, "concessionAmount"))
                .subtract(decimal(payload, "discountAmount")).max(BigDecimal.ZERO);
        int points = eligible.divide(BigDecimal.valueOf(Math.max(1, earnPerVnd)), 0, RoundingMode.DOWN).intValue();
        if (ledgerRepository.findFirstByMembershipMembershipIdAndSourceTypeAndSourceIdOrderByCreatedAtDesc(
                account.getMembershipId(), "BOOKING", bookingId).isEmpty() && points > 0) {
            ledgerRepository.save(LoyaltyLedgerEntry.builder().membership(account)
                    .eventId(envelope.eventId() + ":EARN").entryType(LedgerEntryType.EARN)
                    .entryStatus(LedgerEntryStatus.PENDING).points(points).sourceType("BOOKING")
                    .sourceId(bookingId).clusterId(longValue(payload, "clusterId"))
                    .description("Points earned from booking " + bookingId).build());
        }
        account.setLifetimeSpend(account.getLifetimeSpend().add(decimal(payload, "finalAmount")));
        account.setMembershipLevel(levelFor(account.getLifetimeSpend()));
        membershipRepository.save(account);
    }

    private void refundBooking(MembershipAccount account, CanonicalEventEnvelope<JsonNode> envelope, JsonNode payload) {
        String bookingId = required(payload, "bookingId");
        ledgerRepository.findFirstByMembershipMembershipIdAndSourceTypeAndSourceIdOrderByCreatedAtDesc(
                account.getMembershipId(), "BOOKING", bookingId).ifPresent(original -> {
            if (original.getEntryStatus() == LedgerEntryStatus.PENDING) {
                original.setEntryStatus(LedgerEntryStatus.REVERSED);
                ledgerRepository.save(original);
            } else if (original.getPoints() != 0 && ledgerRepository.findByEventId(envelope.eventId() + ":REVERSE").isEmpty()) {
                ledgerRepository.save(LoyaltyLedgerEntry.builder().membership(account)
                        .eventId(envelope.eventId() + ":REVERSE").entryType(LedgerEntryType.REVERSE)
                        .entryStatus(LedgerEntryStatus.POSTED).points(-original.getPoints()).sourceType("REFUND")
                        .sourceId(bookingId).clusterId(original.getClusterId())
                        .description("Points reversed for refunded booking " + bookingId).build());
            }
        });
        account.setLifetimeSpend(account.getLifetimeSpend().subtract(decimal(payload, "refundAmount")).max(BigDecimal.ZERO));
        account.setMembershipLevel(levelFor(account.getLifetimeSpend()));
        membershipRepository.save(account);
    }

    private void cancelBooking(MembershipAccount account, String bookingId) {
        if (bookingId == null) return;
        ledgerRepository.findFirstByMembershipMembershipIdAndSourceTypeAndSourceIdOrderByCreatedAtDesc(
                account.getMembershipId(), "BOOKING", bookingId).ifPresent(entry -> {
            if (entry.getEntryStatus() == LedgerEntryStatus.PENDING) {
                entry.setEntryStatus(LedgerEntryStatus.REVERSED);
                ledgerRepository.save(entry);
            }
        });
    }

    private void markProcessed(CanonicalEventEnvelope<JsonNode> envelope) {
        processedEventRepository.save(ProcessedLoyaltyEvent.builder()
                .eventId(envelope.eventId()).eventType(envelope.eventType()).build());
    }

    private CanonicalEventEnvelope<JsonNode> parseEnvelope(String message) {
        try {
            return objectMapper.readValue(message, new TypeReference<CanonicalEventEnvelope<JsonNode>>() { });
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Invalid canonical loyalty event", exception);
        }
    }

    private static String required(JsonNode payload, String field) {
        String value = text(payload, field);
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static BigDecimal decimal(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? BigDecimal.ZERO : value.decimalValue();
    }

    private static Long longValue(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asLong();
    }

    private static MembershipLevel levelFor(BigDecimal spend) {
        if (spend.compareTo(new BigDecimal("15000000")) >= 0) return MembershipLevel.PLATINUM;
        if (spend.compareTo(new BigDecimal("5000000")) >= 0) return MembershipLevel.GOLD;
        if (spend.compareTo(new BigDecimal("1000000")) >= 0) return MembershipLevel.SILVER;
        return MembershipLevel.MEMBER;
    }

    private static TierProgress tierProgress(BigDecimal spend) {
        MembershipLevel next = switch (levelFor(spend)) {
            case MEMBER -> MembershipLevel.SILVER;
            case SILVER -> MembershipLevel.GOLD;
            case GOLD -> MembershipLevel.PLATINUM;
            case PLATINUM -> null;
        };
        BigDecimal threshold = switch (levelFor(spend)) {
            case MEMBER -> new BigDecimal("1000000");
            case SILVER -> new BigDecimal("5000000");
            case GOLD -> new BigDecimal("15000000");
            case PLATINUM -> new BigDecimal("15000000");
        };
        BigDecimal lower = switch (levelFor(spend)) {
            case MEMBER -> BigDecimal.ZERO;
            case SILVER -> new BigDecimal("1000000");
            case GOLD -> new BigDecimal("5000000");
            case PLATINUM -> new BigDecimal("15000000");
        };
        BigDecimal percent = next == null ? BigDecimal.valueOf(100) : spend.subtract(lower)
                .divide(threshold.subtract(lower), 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                .max(BigDecimal.ZERO).min(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
        return new TierProgress(next, threshold, percent);
    }

    private static LoyaltyLedgerResponse toResponse(LoyaltyLedgerEntry entry) {
        return new LoyaltyLedgerResponse(entry.getEntryId(), entry.getEntryType(), entry.getEntryStatus(),
                entry.getPoints(), entry.getSourceType(), entry.getSourceId(), entry.getClusterId(),
                entry.getDescription(), entry.getCreatedAt());
    }

    private record TierProgress(MembershipLevel nextLevel, BigDecimal threshold, BigDecimal percent) { }
}
