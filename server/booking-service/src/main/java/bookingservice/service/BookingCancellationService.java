package bookingservice.service;

import bookingservice.client.PaymentClient;
import bookingservice.client.MovieInventoryClient;
import bookingservice.client.ConcessionClient;
import bookingservice.dto.request.CancelBookingRequest;
import bookingservice.dto.request.InternalPaymentRefundRequest;
import bookingservice.dto.request.ReverseMovieSeatSaleRequest;
import bookingservice.dto.response.CancellationResponse;
import bookingservice.dto.response.PaymentRefundResponse;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class BookingCancellationService {
    private final BookingCancellationStateService stateService;
    private final MovieInventoryClient movieInventoryClient;
    private final PaymentClient paymentClient;
    private final ConcessionClient concessionClient;

    @Value("${movie-service.internal-key}")
    private String movieServiceInternalKey;

    @Value("${payment-service.internal-key}")
    private String paymentServiceInternalKey;

    @Value("${concession-service.internal-key}")
    private String concessionServiceInternalKey;

    public CancellationResponse cancel(
            String bookingId,
            String accountId,
            String idempotencyKey,
            CancelBookingRequest request) {
        BookingCancellationStateService.CancellationInstruction instruction =
                stateService.prepare(bookingId, accountId, idempotencyKey, request);
        if (instruction.action() == BookingCancellationStateService.Action.NONE) {
            return stateService.current(instruction.cancellationId(), instruction.replayed());
        }
        if (instruction.action() == BookingCancellationStateService.Action.REQUEST_REFUND) {
            return requestRefund(instruction);
        }
        try {
            movieInventoryClient.releaseHold(
                    instruction.showtimeId(),
                    instruction.holdId(),
                    movieServiceInternalKey,
                    instruction.ownerId());
            if (instruction.concessionReservationId() != null) {
                concessionClient.release(
                        instruction.concessionReservationId(),
                        concessionServiceInternalKey);
            }
            return stateService.completeRelease(instruction.cancellationId());
        } catch (RuntimeException exception) {
            stateService.markReleaseFailure(instruction.cancellationId(), exception);
            throw exception;
        }
    }

    private CancellationResponse requestRefund(
            BookingCancellationStateService.CancellationInstruction instruction) {
        try {
            ApiResponse<PaymentRefundResponse> wrapper = paymentClient.requestRefund(
                    paymentServiceInternalKey,
                    InternalPaymentRefundRequest.builder()
                            .bookingId(instruction.bookingId())
                            .paymentReference(instruction.paymentReference())
                            .amount(instruction.refundAmount())
                            .currency(instruction.currency())
                            .reasonCode(instruction.reasonCode())
                            .reason(instruction.reason())
                            .idempotencyKey(instruction.refundIdempotencyKey())
                            .build());
            PaymentRefundResponse refund = wrapper == null ? null : wrapper.getResult();
            if (refund == null || refund.getStatus() == null) {
                return stateService.markRefundForManualReview(
                        instruction.cancellationId(),
                        "Payment service returned an empty refund result");
            }
            if ("SUCCEEDED".equalsIgnoreCase(refund.getStatus())) {
                movieInventoryClient.reverseSale(
                        instruction.showtimeId(),
                        instruction.holdId(),
                        movieServiceInternalKey,
                        instruction.ownerId(),
                        ReverseMovieSeatSaleRequest.builder()
                                .bookingId(instruction.bookingId())
                                .build());
                return stateService.completeRefund(
                        instruction.cancellationId(),
                        refund.getProviderRefundReference());
            }
            return stateService.markRefundForManualReview(
                    instruction.cancellationId(),
                    "Provider refund requires reconciliation; payment status="
                            + refund.getStatus());
        } catch (RuntimeException exception) {
            return stateService.markRefundForManualReview(
                    instruction.cancellationId(),
                    "Refund compensation failed: "
                            + exception.getClass().getSimpleName()
                            + (exception.getMessage() == null
                            ? "" : " - " + exception.getMessage()));
        }
    }
}
