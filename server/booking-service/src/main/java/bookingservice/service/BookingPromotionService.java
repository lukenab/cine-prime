package bookingservice.service;

import bookingservice.client.PromotionClient;
import bookingservice.dto.request.PromotionQuoteRequest;
import bookingservice.dto.request.PromotionReserveRequest;
import bookingservice.dto.response.PromotionReservationResponse;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingItem;
import bookingservice.entity.ConcessionItem;
import bookingservice.repository.PromotionReservationRepository;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

import static bookingservice.exception.BookingErrorCode.*;

@Service
@RequiredArgsConstructor
public class BookingPromotionService {
    private final PromotionClient promotionClient;
    private final PromotionReservationRepository reservationRepository;

    @Value("${promotion-service.internal-key}")
    private String internalKey;

    public PromotionReservationResponse reserve(
            String code,
            Booking booking,
            String idempotencyKey) {
        String normalized = normalize(code);
        if (normalized == null) {
            return null;
        }
        BigDecimal ticketSubtotal = booking.getBookingDetails().stream()
                .map(BookingItem::getFinalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal concessionSubtotal = booking.getConcessionItems().stream()
                .map(ConcessionItem::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        PromotionQuoteRequest snapshot = new PromotionQuoteRequest(
                normalized,
                booking.getBookingId(),
                booking.getAccountId(),
                booking.getMovieId(),
                booking.getShowtimeId(),
                booking.getClusterId(),
                ticketSubtotal,
                concessionSubtotal,
                booking.getServiceFeeAmount(),
                booking.getCurrency());
        try {
            ApiResponse<PromotionReservationResponse> wrapper = promotionClient.reserve(
                    internalKey,
                    new PromotionReserveRequest(idempotencyKey, snapshot));
            if (wrapper == null || wrapper.getResult() == null) {
                throw new AppException(PROMOTION_SERVICE_UNAVAILABLE);
            }
            return wrapper.getResult();
        } catch (FeignException exception) {
            String payload = exception.contentUTF8();
            if (payload != null && payload.contains("2702")) {
                throw new AppException(PROMOTION_QUOTA_EXHAUSTED);
            }
            if (exception.status() == 404 || exception.status() == 409 || exception.status() == 410) {
                throw new AppException(PROMOTION_NOT_APPLICABLE);
            }
            throw new AppException(PROMOTION_SERVICE_UNAVAILABLE);
        }
    }

    @Transactional
    public void commit(String reservationId) {
        if (reservationId == null || reservationId.isBlank()) {
            return;
        }
        PromotionReservationResponse response = requireResult(
                promotionClient.commit(internalKey, UUID.fromString(reservationId)));
        reservationRepository.findByExternalReservationId(reservationId)
                .ifPresent(local -> local.setStatus(response.status()));
    }

    @Transactional
    public void release(String reservationId) {
        if (reservationId == null || reservationId.isBlank()) {
            return;
        }
        PromotionReservationResponse response = requireResult(
                promotionClient.release(internalKey, UUID.fromString(reservationId)));
        reservationRepository.findByExternalReservationId(reservationId)
                .ifPresent(local -> local.setStatus(response.status()));
    }

    public void releaseQuietly(PromotionReservationResponse reservation) {
        if (reservation == null || reservation.reservationId() == null) {
            return;
        }
        try {
            promotionClient.release(internalKey, reservation.reservationId());
        } catch (RuntimeException ignored) {
            // Reservation TTL remains the final quota safety net.
        }
    }

    public String normalize(String code) {
        return code == null || code.isBlank() ? null : code.trim().toUpperCase();
    }

    private PromotionReservationResponse requireResult(ApiResponse<PromotionReservationResponse> wrapper) {
        if (wrapper == null || wrapper.getResult() == null) {
            throw new AppException(PROMOTION_SERVICE_UNAVAILABLE);
        }
        return wrapper.getResult();
    }
}
