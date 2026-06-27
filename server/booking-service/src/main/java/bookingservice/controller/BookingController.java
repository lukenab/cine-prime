package bookingservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import bookingservice.dto.response.BookingResponse;
import bookingservice.service.BookingService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class BookingController {
    BookingService bookingService;

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<BookingResponse>> cancelBooking(
            @PathVariable("id") String id) {
// chỗ này lấy thông tin từ token mà hiện tại chưa có nên tui fix cứng trước
        BookingResponse responseData = bookingService.cancelBooking(id, "1", true); 
        ApiResponse<BookingResponse> apiResponse = new ApiResponse<>(
                1000,
                "Booking cancelled successfully",
                responseData
        );

        return ResponseEntity.ok(apiResponse);
    }
}
