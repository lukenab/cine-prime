package bookingservice.dto.response;

import java.util.List;

/**
 * Read-only inventory snapshot returned by Movie Service while a customer asks
 * for a checkout quote. Booking Service uses these fields instead of trusting
 * movie, branch or price values from the browser.
 */
public record MovieSeatMapResponse(
        Long movieId,
        Long clusterId,
        List<SeatAvailabilityResponse> seats) {
}
