package bookingservice.service;

import bookingservice.client.ConcessionClient;
import bookingservice.dto.request.AttachConcessionsRequest;
import bookingservice.dto.request.ConcessionReservationRequest;
import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.ConcessionLineResponse;
import bookingservice.dto.response.ConcessionReservationResponse;
import bookingservice.entity.*;
import bookingservice.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static bookingservice.exception.BookingErrorCode.*;

@Service
@RequiredArgsConstructor
public class ConcessionAttachService {
    private final BookingRepository bookingRepository;
    private final ConcessionClient concessionClient;
    private final BookingResponseMapper responseMapper;
    private final BookingEventService bookingEventService;

    @Value("${concession-service.internal-key}")
    private String internalKey;

    @Transactional
    public BookingDetailResponse attach(
            String bookingId,
            String accountId,
            String idempotencyKey,
            AttachConcessionsRequest request) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new AppException(BOOKING_NOT_FOUND));
        if (!booking.getAccountId().equals(accountId)) throw new AppException(BOOKING_FORBIDDEN);
        if (booking.getStatus() != BookingStatus.PENDING_PAYMENT
                || booking.getExpiresAt().isBefore(java.time.OffsetDateTime.now())) {
            throw new AppException(BOOKING_NOT_PAYABLE);
        }
        if (!booking.getConcessionItems().isEmpty()) {
            boolean replay = booking.getConcessionItems().stream()
                    .allMatch(item -> item.getIdempotencyKey().startsWith(idempotencyKey + ":"));
            if (replay) return responseMapper.toDetail(booking);
            throw new AppException(CONCESSION_ALREADY_ATTACHED);
        }

        ConcessionReservationResponse reservation;
        try {
            ApiResponse<ConcessionReservationResponse> wrapper = concessionClient.reserve(
                    internalKey,
                    ConcessionReservationRequest.builder()
                            .bookingId(bookingId)
                            .customerId(accountId)
                            .cinemaClusterId(booking.getClusterId())
                            .items(request.getItems())
                            .idempotencyKey(idempotencyKey)
                            .checkoutExpiresAt(booking.getExpiresAt())
                            .build());
            reservation = wrapper == null ? null : wrapper.getResult();
            if (reservation == null || reservation.getItems() == null
                    || !bookingId.equals(reservation.getBookingId())
                    || !booking.getClusterId().equals(reservation.getCinemaClusterId())) {
                throw new AppException(CONCESSION_RESERVATION_FAILED);
            }
        } catch (AppException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new AppException(CONCESSION_RESERVATION_FAILED);
        }

        try {
            int index = 0;
            for (ConcessionLineResponse line : reservation.getItems()) {
                ConcessionItem item = ConcessionItem.builder()
                        .booking(booking)
                        .sku(line.getItemCode())
                        .itemName(line.getItemName())
                        .optionsSnapshot(line.getOptions() == null ? "" : line.getOptions())
                        .quantity(line.getQuantity())
                        .unitPrice(line.getUnitPrice())
                        .discountAmount(line.getDiscountAmount())
                        .finalAmount(line.getFinalAmount())
                        .fulfillmentClusterId(booking.getClusterId())
                        .externalReservationId(reservation.getReservationId())
                        .status("RESERVED")
                        .idempotencyKey(idempotencyKey + ":" + index++)
                        .build();
                booking.getConcessionItems().add(item);
            }
            BigDecimal ticketTotal = booking.getBookingDetails().stream()
                    .map(BookingItem::getFinalPrice)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal concessionTotal = reservation.getItems().stream()
                    .map(ConcessionLineResponse::getFinalAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            booking.setTotalAmount(ticketTotal.add(concessionTotal));
            booking.setFinalAmount(booking.getTotalAmount()
                    .add(booking.getServiceFeeAmount())
                    .subtract(booking.getDiscountAmount())
                    .subtract(booking.getPointsDiscount()));
            if (reservation.getExpiresAt().isBefore(booking.getExpiresAt())) {
                booking.setExpiresAt(reservation.getExpiresAt());
                booking.getInventoryReservation().setExpiresAt(reservation.getExpiresAt());
            }
            bookingEventService.append(
                    booking, "CONCESSION_RESERVED", "concession:" + reservation.getReservationId());
            return responseMapper.toDetail(bookingRepository.save(booking));
        } catch (RuntimeException exception) {
            try {
                concessionClient.release(reservation.getReservationId(), internalKey);
            } catch (RuntimeException ignored) {
                // concession-service expiry remains the safety net.
            }
            throw exception;
        }
    }
}
