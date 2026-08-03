package bookingservice.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import bookingservice.dto.request.CreateBookingQuoteRequest;
import bookingservice.dto.response.BookingQuoteResponse;
import bookingservice.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.security.JwtSecurityUtils;

@RestController
@RequestMapping("/api/booking-quotes")
@RequiredArgsConstructor
public class BookingQuoteController {
    private final BookingService bookingService;

    /** Quote does not reserve a seat or promotion quota; booking creation does that atomically later. */
    @PostMapping
    public ApiResponse<BookingQuoteResponse> createQuote(@RequestBody @Valid CreateBookingQuoteRequest request) {
        return ApiResponse.<BookingQuoteResponse>builder()
                .code(1000)
                .result(bookingService.createCheckoutQuote(
                        request,
                        JwtSecurityUtils.getCurrentAccountId(),
                        JwtSecurityUtils.hasRole("ROLE_MEMBER")))
                .build();
    }
}
