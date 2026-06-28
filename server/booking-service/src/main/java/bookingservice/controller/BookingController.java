package bookingservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import bookingservice.dto.response.CancelBookingResponse;
import bookingservice.service.BookingService;
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
