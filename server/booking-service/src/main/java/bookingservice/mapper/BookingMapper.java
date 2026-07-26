package bookingservice.mapper;

import java.time.OffsetDateTime;
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
import bookingservice.entity.Booking;
import bookingservice.entity.BookingItem;

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
    @Mapping(source = "booking.showtimeId", target = "showtimeId")
    @Mapping(source = "booking.status", target = "status")
    @Mapping(source = "booking.totalAmount", target = "totalPrice")
    @Mapping(source = "items", target = "items")
    @Mapping(source = "expiredAt", target = "lockedUntil")
    CreateBookingResponse toCreateBookingResponse(Booking booking, List<BookingItemResponse> items,
            OffsetDateTime expiredAt);

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


}
