package bookingservice.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import bookingservice.dto.request.BookingRequest;
import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.CancelBookingResponse;
import bookingservice.dto.response.CreateBookingResponse;
import bookingservice.service.BookingService;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.security.JwtSecurityUtils;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BookingController {
        BookingService bookingService;

        @PostMapping
        public ApiResponse<CreateBookingResponse> createBooking(@RequestBody @Valid BookingRequest request) {
                String accountId = JwtSecurityUtils.getCurrentAccountId();
                boolean isMember= JwtSecurityUtils.hasRole("ROLE_MEMBER");
                CreateBookingResponse response = bookingService.createBookingAndHoldSeats(request, accountId,isMember);

                return ApiResponse.<CreateBookingResponse>builder()
                                .code(1000)
                                .message("Booking created successfully")
                                .result(response)
                                .build();
        }

        @GetMapping("/{id}")
        public ApiResponse<BookingDetailResponse> getBookingById(@PathVariable String id) {
                return ApiResponse.<BookingDetailResponse>builder()
                                .code(1000)
                                .result(bookingService.getBookingById(id))
                                .build();
        }

        // @GetMapping("/bookings/me")
        // public ApiResponse<List<CreateBookingResponse>> getMyBookings() {
        // return ApiResponse.<List<CreateBookingResponse>>builder()
        // .code(1000)
        // .result(bookingService.getMyBookings())
        // .build();
        // }

        // @GetMapping("/showtimes/{showtimeId}/seats")
        // public ApiResponse<List<SeatAvailabilityResponse>>
        // getSeatAvailability(@PathVariable Long showtimeId) {
        // return ApiResponse.<List<SeatAvailabilityResponse>>builder()
        // .code(1000)
        // .result(bookingService.getSeatAvailability(showtimeId))
        // .build();
        // }

        @PatchMapping("/{id}/cancel")
        public ResponseEntity<ApiResponse<CancelBookingResponse>> cancelBooking(
                        @PathVariable("id") String id) {
                String accountId = JwtSecurityUtils.getCurrentAccountId();
                boolean isAdmin = JwtSecurityUtils.hasRole("ROLE_ADMIN");
                CancelBookingResponse responseData = bookingService.cancelBooking(id, accountId, isAdmin);
                ApiResponse<CancelBookingResponse> apiResponse = new ApiResponse<>(
                                1000,
                                "Booking cancelled successfully",
                                responseData);

                return ResponseEntity.ok(apiResponse);
        }
}
