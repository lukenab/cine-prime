package bookingservice.mapper;

import java.time.LocalDateTime;
import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.NullValuePropertyMappingStrategy;
import org.mapstruct.ReportingPolicy;

import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.BookingItemResponse;
import bookingservice.dto.response.CancelBookingResponse;
import bookingservice.dto.response.CreateBookingResponse;
import bookingservice.dto.response.SeatAvailabilityResponse;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingItem;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE, nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface BookingMapper {
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
    @Mapping(source = "booking.totalAmount", target = "totalPrice") // Sửa totalAmount -> totalPrice
    @Mapping(source = "items", target = "items")
    @Mapping(source = "expiredAt", target = "lockedUntil")
    CreateBookingResponse toCreateBookingResponse(Booking booking, List<BookingItemResponse> items,
            LocalDateTime expiredAt);

    CancelBookingResponse toCancelBookingResponse(Booking booking);
}
