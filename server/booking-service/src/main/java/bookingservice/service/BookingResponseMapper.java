package bookingservice.service;

import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.BookingItemResponse;
import bookingservice.dto.response.CreateBookingResponse;
import bookingservice.dto.response.ConcessionLineResponse;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingItem;
import bookingservice.entity.ConcessionItem;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class BookingResponseMapper {

    public CreateBookingResponse toCreateResponse(Booking booking) {
        return CreateBookingResponse.builder()
                .bookingId(booking.getBookingId())
                .bookingCode(booking.getBookingCode())
                .status(booking.getStatus().name())
                .holdId(booking.getInventoryReservation().getExternalHoldId())
                .holdToken(booking.getInventoryReservation().getHoldToken())
                .lockedUntil(booking.getExpiresAt())
                .subtotal(booking.getTotalAmount())
                .serviceFee(booking.getServiceFeeAmount())
                .discount(booking.getDiscountAmount().add(booking.getPointsDiscount()))
                .total(booking.getFinalAmount())
                .currency(booking.getCurrency())
                .seats(toItems(booking.getBookingDetails()))
                .build();
    }

    public BookingDetailResponse toDetail(Booking booking) {
        return BookingDetailResponse.builder()
                .bookingId(booking.getBookingId())
                .bookingCode(booking.getBookingCode())
                .status(booking.getStatus().name())
                .paymentStatus(booking.getPaymentStatus().name())
                .inventoryStatus(booking.getInventoryStatus().name())
                .showtimeId(booking.getShowtimeId())
                .movieId(booking.getMovieId())
                .movieName(booking.getMovieName())
                .cinemaClusterId(booking.getClusterId())
                .cinemaClusterName(booking.getClusterName())
                .cinemaRoomId(booking.getCinemaRoomId())
                .cinemaRoomName(booking.getCinemaRoomName())
                .showDate(booking.getShowDate())
                .startTime(booking.getStartTime())
                .seats(toItems(booking.getBookingDetails()))
                .concessions(toConcessions(booking.getConcessionItems()))
                .ticketSubtotal(ticketSubtotal(booking))
                .concessionSubtotal(concessionSubtotal(booking))
                .subtotal(booking.getTotalAmount())
                .serviceFee(booking.getServiceFeeAmount())
                .discount(booking.getDiscountAmount().add(booking.getPointsDiscount()))
                .total(booking.getFinalAmount())
                .currency(booking.getCurrency())
                .expiresAt(booking.getExpiresAt())
                .paidAt(booking.getPaidAt())
                .createdAt(booking.getCreatedAt())
                .concessionOrderId(booking.getConcessionOrderId())
                .concessionPickupCode(booking.getConcessionPickupCode())
                .build();
    }

    private List<BookingItemResponse> toItems(List<BookingItem> items) {
        return items.stream()
                .map(item -> BookingItemResponse.builder()
                        .showtimeSeatId(item.getShowtimeSeatId())
                        .seatCode(item.getSeatCode())
                        .seatType(item.getSeatType())
                        .unitPrice(item.getUnitPrice())
                        .finalPrice(item.getFinalPrice())
                        .build())
                .toList();
    }

    private List<ConcessionLineResponse> toConcessions(List<ConcessionItem> items) {
        return items.stream()
                .map(item -> ConcessionLineResponse.builder()
                        .itemCode(item.getSku())
                        .itemName(item.getItemName())
                        .options(item.getOptionsSnapshot())
                        .quantity(item.getQuantity())
                        .unitPrice(item.getUnitPrice())
                        .discountAmount(item.getDiscountAmount())
                        .finalAmount(item.getFinalAmount())
                        .build())
                .toList();
    }

    private BigDecimal concessionSubtotal(Booking booking) {
        return booking.getConcessionItems().stream()
                .map(ConcessionItem::getFinalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal ticketSubtotal(Booking booking) {
        return booking.getBookingDetails().stream()
                .map(BookingItem::getFinalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
