package promotionservice.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Service;
import promotionservice.dto.request.*;
import promotionservice.dto.response.*;
import promotionservice.entity.*;
import promotionservice.enums.*;
import promotionservice.exception.PromotionErrorCode;
import promotionservice.repository.*;

import java.math.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PromotionEligibilityService {
    private static final List<PromotionReservationStatus> QUOTA_STATUSES = List.of(PromotionReservationStatus.RESERVED, PromotionReservationStatus.COMMITTED);
    private final PromotionRepository promotions;
    private final PromotionReservationRepository reservations;
    private final PromotionUsageLedgerRepository ledgers;

    @Transactional
    public PromotionQuoteResponse quote(PromotionQuoteRequest request) {
        // Quote chỉ tính eligibility/discount từ snapshot Booking Service gửi; chưa giữ quota.
        Promotion p = promotions.findByCodeIgnoreCase(request.promotionCode().trim()).orElse(null);
        return p == null ? ineligible("PROMOTION_NOT_FOUND", request) : evaluate(p, request);
    }

    @Transactional
    public PromotionReservationResponse reserve(PromotionReserveRequest request) {
        // Retry cùng idempotency key trả reservation cũ, tránh giữ quota hai lần.
        var existing = reservations.findByIdempotencyKey(request.idempotencyKey().trim());
        if (existing.isPresent()) {
            PromotionReservation r = existing.get();
            if (!r.getBookingId().equals(request.snapshot().bookingId()) || !r.getAccountId().equals(request.snapshot().accountId()))
                throw new AppException(PromotionErrorCode.PROMOTION_IDEMPOTENCY_CONFLICT);
            if (r.getStatus() != PromotionReservationStatus.RESERVED) {
                throw new AppException(PromotionErrorCode.PROMOTION_IDEMPOTENCY_CONFLICT);
            }
            return response(r);
        }
        // Lock promotion để serialize concurrent checkout và kiểm tra quota atomically.
        Promotion found = promotions.findByCodeIgnoreCase(request.snapshot().promotionCode().trim()).orElseThrow(() -> new AppException(PromotionErrorCode.PROMOTION_NOT_APPLICABLE));
        Promotion p = promotions.findByIdForUpdate(found.getPromotionId()).orElseThrow(() -> new AppException(PromotionErrorCode.PROMOTION_NOT_APPLICABLE));
        PromotionQuoteResponse quote = evaluate(p, request.snapshot());
        if (!quote.eligible()) throw new AppException(PromotionErrorCode.PROMOTION_NOT_APPLICABLE);
        if (p.getGlobalUsageLimit() != null && p.getActiveReservationCount() + p.getCommittedUsageCount() >= p.getGlobalUsageLimit())
            throw new AppException(PromotionErrorCode.PROMOTION_QUOTA_EXHAUSTED);
        if (p.getPerAccountUsageLimit() != null && reservations.countByPromotionPromotionIdAndAccountIdAndStatusIn(p.getPromotionId(), request.snapshot().accountId(), QUOTA_STATUSES) >= p.getPerAccountUsageLimit())
            throw new AppException(PromotionErrorCode.PROMOTION_QUOTA_EXHAUSTED);
        // Amount snapshot là immutable; TTL 15 phút để abandoned checkout tự giải phóng quota.
        PromotionReservation r = new PromotionReservation();
        r.setPromotion(p);
        r.setBookingId(request.snapshot().bookingId());
        r.setAccountId(request.snapshot().accountId());
        r.setIdempotencyKey(request.idempotencyKey().trim());
        r.setStatus(PromotionReservationStatus.RESERVED);
        r.setBenefitScope(quote.benefitScope());
        r.setSubtotalAmount(quote.subtotalAmount());
        r.setDiscountAmount(quote.discountAmount());
        r.setFinalAmount(quote.finalAmount());
        r.setCurrency(quote.currency());
        r.setReservedAt(OffsetDateTime.now());
        r.setExpiresAt(OffsetDateTime.now().plusMinutes(15));
        reservations.save(r);
        p.setActiveReservationCount(p.getActiveReservationCount() + 1);
        ledger(r, PromotionUsageEventType.RESERVED, (short) 1);
        return response(r);
    }

    @Transactional(dontRollbackOn = AppException.class)
    public PromotionReservationResponse commit(UUID id) {
        // Commit idempotent: retry sau booking confirmation vẫn trả COMMITTED.
        PromotionReservation r = locked(id);
        expireIfNeeded(r);
        if (r.getStatus() == PromotionReservationStatus.COMMITTED) return response(r);
        if (r.getStatus() != PromotionReservationStatus.RESERVED)
            throw new AppException(PromotionErrorCode.PROMOTION_RESERVATION_INVALID_STATE);
        r.setStatus(PromotionReservationStatus.COMMITTED);
        r.setCommittedAt(OffsetDateTime.now());
        Promotion p = r.getPromotion();
        p.setActiveReservationCount(p.getActiveReservationCount() - 1);
        p.setCommittedUsageCount(p.getCommittedUsageCount() + 1);
        ledger(r, PromotionUsageEventType.COMMITTED, (short) 0);
        return response(r);
    }

    @Transactional(dontRollbackOn = AppException.class)
    public PromotionReservationResponse release(UUID id) {
        // Payment fail/cancel chỉ trả quota của reservation đang RESERVED.
        PromotionReservation r = locked(id);
        expireIfNeeded(r);
        if (r.getStatus() == PromotionReservationStatus.RELEASED) return response(r);
        if (r.getStatus() != PromotionReservationStatus.RESERVED)
            throw new AppException(PromotionErrorCode.PROMOTION_RESERVATION_INVALID_STATE);
        r.setStatus(PromotionReservationStatus.RELEASED);
        r.setReleasedAt(OffsetDateTime.now());
        r.getPromotion().setActiveReservationCount(r.getPromotion().getActiveReservationCount() - 1);
        ledger(r, PromotionUsageEventType.RELEASED, (short) -1);
        return response(r);
    }

    private PromotionQuoteResponse evaluate(Promotion p, PromotionQuoteRequest q) {
        // Target rỗng là global; nhiều target dùng OR (khớp movie hoặc showtime là đủ).
        OffsetDateTime now = OffsetDateTime.now();
        if (p.getStatus() != PromotionStatus.ACTIVE || p.getValidFrom() != null && now.isBefore(p.getValidFrom()) || p.getValidUntil() != null && !now.isBefore(p.getValidUntil()))
            return ineligible("PROMOTION_INACTIVE", q);
        boolean target = p.getTargets().isEmpty() || p.getTargets().stream().anyMatch(t -> t.getMovieId() != null && t.getMovieId().equals(q.movieId()) || t.getShowtimeId() != null && t.getShowtimeId().equals(q.showtimeId()));
        BigDecimal eligibleSubtotal = eligibleSubtotal(p.getBenefitScope(), q);
        if (!target || eligibleSubtotal.compareTo(p.getPriceRule().getMinimumOrderAmount()) < 0)
            return ineligible("PROMOTION_NOT_APPLICABLE", q);
        // Quote báo trước quota hiện tại; reserve vẫn lock lại để chống race condition.
        if (p.getGlobalUsageLimit() != null && p.getActiveReservationCount() + p.getCommittedUsageCount() >= p.getGlobalUsageLimit()
                || p.getPerAccountUsageLimit() != null && reservations.countByPromotionPromotionIdAndAccountIdAndStatusIn(p.getPromotionId(), q.accountId(), QUOTA_STATUSES) >= p.getPerAccountUsageLimit())
            return ineligible("PROMOTION_QUOTA_EXHAUSTED", q);
        BigDecimal d = p.getPriceRule().getDiscountType() == DiscountType.PERCENTAGE ? eligibleSubtotal.multiply(p.getPriceRule().getPercentage()).divide(BigDecimal.valueOf(100), 0, RoundingMode.DOWN) : p.getPriceRule().getFixedAmount();
        if (p.getPriceRule().getMaxDiscountAmount() != null) d = d.min(p.getPriceRule().getMaxDiscountAmount());
        d = d.min(eligibleSubtotal);
        return new PromotionQuoteResponse(true, null, p.getPromotionId(), p.getBenefitScope(), eligibleSubtotal, d, eligibleSubtotal.subtract(d), q.currency() == null ? "VND" : q.currency().toUpperCase());
    }

    private PromotionQuoteResponse ineligible(String reason, PromotionQuoteRequest q) {
        BigDecimal subtotal = q.ticketSubtotal().add(q.concessionSubtotal());
        return new PromotionQuoteResponse(false, reason, null, null, subtotal, BigDecimal.ZERO, subtotal, q.currency() == null ? "VND" : q.currency().toUpperCase());
    }

    private BigDecimal eligibleSubtotal(PromotionBenefitScope scope, PromotionQuoteRequest q) {
        return switch (scope) {
            case TICKETS -> q.ticketSubtotal();
            case CONCESSIONS -> q.concessionSubtotal();
            case ORDER -> q.ticketSubtotal().add(q.concessionSubtotal());
        };
    }

    private PromotionReservation locked(UUID id) {
        return reservations.findByIdForUpdate(id).orElseThrow(() -> new AppException(PromotionErrorCode.PROMOTION_RESERVATION_NOT_FOUND));
    }

    private void expireIfNeeded(PromotionReservation r) {
        // Lazy expiry ngăn reservation quá TTL bị commit và trả quota ngay trong transaction.
        if (r.getStatus() == PromotionReservationStatus.RESERVED && !OffsetDateTime.now().isBefore(r.getExpiresAt())) {
            r.setStatus(PromotionReservationStatus.EXPIRED);
            r.setExpiredAt(OffsetDateTime.now());
            r.getPromotion().setActiveReservationCount(r.getPromotion().getActiveReservationCount() - 1);
            ledger(r, PromotionUsageEventType.EXPIRED, (short) -1);
            throw new AppException(PromotionErrorCode.PROMOTION_RESERVATION_EXPIRED);
        }
    }

    private void ledger(PromotionReservation r, PromotionUsageEventType e, short d) {
        // Ledger append-only phục vụ audit và đối soát thay đổi quota.
        PromotionUsageLedger l = new PromotionUsageLedger();
        l.setPromotion(r.getPromotion());
        l.setReservation(r);
        l.setAccountId(r.getAccountId());
        l.setBookingId(r.getBookingId());
        l.setEventType(e);
        l.setUsageDelta(d);
        l.setOccurredAt(OffsetDateTime.now());
        ledgers.save(l);
    }

    private PromotionReservationResponse response(PromotionReservation r) {
        return new PromotionReservationResponse(r.getPromotionReservationId(), r.getPromotion().getPromotionId(), r.getBookingId(), r.getAccountId(), r.getStatus(), r.getBenefitScope(), r.getSubtotalAmount(), r.getDiscountAmount(), r.getFinalAmount(), r.getCurrency(), r.getExpiresAt());
    }
}
