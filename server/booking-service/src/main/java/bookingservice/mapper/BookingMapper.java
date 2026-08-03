package bookingservice.mapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.ReportingPolicy;
import org.springframework.data.domain.Page;

import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.BookingItemResponse;
import bookingservice.dto.response.BookingListResponse;
import bookingservice.dto.response.CancelBookingResponse;
import bookingservice.dto.response.CreateBookingResponse;
import bookingservice.dto.response.SeatAvailabilityResponse;
import bookingservice.dto.response.SeatHoldResponse;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingItem;
import bookingservice.entity.SeatLock;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE, nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface BookingMapper {
    @Mapping(source = "details", target = "items")
    BookingDetailResponse toBookingDetailResponse(Booking booking, List<BookingItem> details);

    BookingDetailResponse toBookingListResponse(Booking booking);

    @Mapping(source = "showtimeSeatId", target = "seatId")
    @Mapping(source = "seatCode", target = "seatLabel")
    @Mapping(source = "unitPrice", target = "price")
    BookingItemResponse toBookingItemResponse(BookingItem item);

    @Mapping(source = "showtimeSeatId", target = "seatId")
    @Mapping(source = "seatCode", target = "seatLabel")
    @Mapping(source = "price", target = "price")
    BookingItemResponse toBookingItemResponse(SeatAvailabilityResponse seat);

    @Mapping(source = "booking.bookingId", target = "bookingId")
    @Mapping(source = "booking.seatHoldId", target = "holdId")
    @Mapping(source = "booking.showtimeId", target = "showtimeId")
    @Mapping(source = "booking.status", target = "status")
    @Mapping(source = "booking.totalAmount", target = "totalPrice")
    @Mapping(source = "booking.promotionDiscountAmount", target = "discountAmount")
    @Mapping(source = "booking.finalAmount", target = "finalAmount")
    @Mapping(source = "booking.promotionCode", target = "promotionCode")
    @Mapping(source = "items", target = "items")
    @Mapping(target = "lockedUntil", expression = "java(expiredAt == null ? null : expiredAt.atOffset(java.time.ZoneOffset.UTC))")
    CreateBookingResponse toCreateBookingResponse(Booking booking, List<BookingItemResponse> items,
            LocalDateTime expiredAt);

    CancelBookingResponse toCancelBookingResponse(Booking booking);

    default BookingListResponse toBookingListResponse(Page<Booking> bookingPage) {
        if (bookingPage == null) {
            return null;
        }

        List<BookingDetailResponse> content = bookingPage.getContent().stream()
                .map(this::toBookingListResponse)
                .collect(Collectors.toList());

        return BookingListResponse.builder()
                .content(content)
                .pageNumber(bookingPage.getNumber())
                .pageSize(bookingPage.getSize())
                .totalElements(bookingPage.getTotalElements())
                .totalPages(bookingPage.getTotalPages())
                .isLast(bookingPage.isLast())
                .build();
    }


    default SeatHoldResponse toSeatHoldResponse(List<SeatLock> savedLocks) {
        if (savedLocks == null) {
            return null;
        }

        return SeatHoldResponse.builder()
                .lockedSeats(savedLocks)
                .build();
    }
}
