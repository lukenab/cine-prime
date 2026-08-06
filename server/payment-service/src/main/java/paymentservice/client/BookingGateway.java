package paymentservice.client;

import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import paymentservice.dto.BookingSnapshot;

import static paymentservice.exception.PaymentErrorCode.BOOKING_SERVICE_UNAVAILABLE;

@Component
public class BookingGateway {
    private final RestClient restClient;
    private final String bookingServiceUrl;

    public BookingGateway(
            RestClient.Builder builder,
            @Value("${booking-service.url}") String bookingServiceUrl) {
        this.restClient = builder.build();
        this.bookingServiceUrl = bookingServiceUrl;
    }

    public BookingSnapshot getOwnedBooking(String bookingId, String authorization) {
        try {
            ApiResponse<BookingSnapshot> response = restClient.get()
                    .uri(bookingServiceUrl + "/api/bookings/{bookingId}", bookingId)
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });
            if (response == null || response.getResult() == null) {
                throw new AppException(BOOKING_SERVICE_UNAVAILABLE);
            }
            return response.getResult();
        } catch (AppException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new AppException(BOOKING_SERVICE_UNAVAILABLE);
        }
    }

    public BookingSnapshot lockOwnedCheckout(String bookingId, String authorization) {
        try {
            ApiResponse<BookingSnapshot> response = restClient.post()
                    .uri(bookingServiceUrl + "/api/bookings/{bookingId}/checkout-lock", bookingId)
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });
            if (response == null || response.getResult() == null) {
                throw new AppException(BOOKING_SERVICE_UNAVAILABLE);
            }
            return response.getResult();
        } catch (AppException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new AppException(BOOKING_SERVICE_UNAVAILABLE);
        }
    }
}
