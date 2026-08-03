package bookingservice.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import bookingservice.dto.request.BookingRequest;
import bookingservice.dto.request.HoldSeatRequest;

import bookingservice.dto.response.BookingDetailResponse;
import bookingservice.dto.response.BookingListResponse;
import bookingservice.dto.response.CancelBookingResponse;
import bookingservice.dto.response.CreateBookingResponse;
import bookingservice.dto.response.SeatHoldResponse;
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
        @ResponseStatus(HttpStatus.CREATED)
        public ApiResponse<CreateBookingResponse> createBooking(
                        @RequestHeader("Idempotency-Key") String idempotencyKey,
                        @RequestBody @Valid BookingRequest request) {
                String accountId = JwtSecurityUtils.getCurrentAccountId();
                boolean isMember = JwtSecurityUtils.hasRole("ROLE_MEMBER");
                CreateBookingResponse response = bookingService.createBookingAndHoldSeats(
                                request, accountId, isMember, idempotencyKey);

                return ApiResponse.<CreateBookingResponse>builder()
                                .code(1000)
                                .message("Booking created successfully")
                                .result(response)
                                .build();
        }


        @GetMapping("/{id}")
        public ApiResponse<BookingDetailResponse> getBookingById(@PathVariable("id") String id) {
                String accountId = JwtSecurityUtils.getCurrentAccountId();
                boolean isAdmin = JwtSecurityUtils.hasRole("ROLE_ADMIN");
                return ApiResponse.<BookingDetailResponse>builder()
                                .code(1000)
                                .result(bookingService.getBookingById(id, accountId, isAdmin))
                                .build();
        }

        @GetMapping("/me")
        public ApiResponse<BookingListResponse> getMyBookings(
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "10") int size) {
                String accountId = JwtSecurityUtils.getCurrentAccountId();
                return ApiResponse.<BookingListResponse>builder()
                                .code(1000)
                                .result(bookingService.getMyBookings(accountId, page, size))
                                .build();
        }

        @PatchMapping("/{id}/cancel")
        public ApiResponse<CancelBookingResponse> cancelBooking(@PathVariable("id") String id) {
                String accountId = JwtSecurityUtils.getCurrentAccountId();
                boolean isAdmin = JwtSecurityUtils.hasRole("ROLE_ADMIN");

                CancelBookingResponse responseData = bookingService.cancelBooking(id, accountId, isAdmin);

                return new ApiResponse<>(
                                1000,
                                "Booking cancelled successfully",
                                responseData);
        }

        /** Internal payment confirmation: commits the already-created promotion reservation once. */
        @PatchMapping("/{id}/confirm")
        public ApiResponse<CreateBookingResponse> confirmBooking(@PathVariable("id") String id) {
                boolean canConfirm = JwtSecurityUtils.hasRole("ROLE_ADMIN")
                                || JwtSecurityUtils.hasRole("ROLE_EMPLOYEE");
                return ApiResponse.<CreateBookingResponse>builder()
                                .code(1000)
                                .result(bookingService.confirmBooking(id, canConfirm))
                                .build();
        }
}
