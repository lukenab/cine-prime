package paymentservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import paymentservice.client.BookingGateway;
import paymentservice.config.PaymentProperties;
import paymentservice.config.VnpayProperties;
import paymentservice.dto.InternalRefundRequest;
import paymentservice.entity.*;
import paymentservice.provider.ProviderRefundGateway;
import paymentservice.provider.ProviderRefundResult;
import paymentservice.provider.VnpaySigner;
import paymentservice.repository.*;
import paymentservice.util.PaymentHashing;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentProviderRefundServiceTest {
    @Mock PaymentAttemptRepository attemptRepository;
    @Mock PaymentEventInboxRepository inboxRepository;
    @Mock PaymentReconciliationCaseRepository reconciliationRepository;
    @Mock PaymentRefundRepository refundRepository;
    @Mock BookingGateway bookingGateway;
    @Mock VnpaySigner vnpaySigner;
    @Mock VnpayProperties vnpayProperties;
    @Mock PaymentProperties paymentProperties;
    @Mock PaymentOutcomePublisher outcomePublisher;
    @Mock ProviderRefundGateway providerRefundGateway;
    @Mock JdbcTemplate jdbcTemplate;

    @InjectMocks PaymentApplicationService service;

    @BeforeEach
    void setUp() {
        when(paymentProperties.internalServiceKey()).thenReturn("internal-key");
    }

    private void stubNewRefund() {
        when(paymentProperties.refund()).thenReturn(new PaymentProperties.Refund(false));
        when(refundRepository.findByIdempotencyKey("refund-key-1"))
                .thenReturn(Optional.empty());
        when(attemptRepository.findFirstByBookingIdOrderByCreatedAtDesc("BKG-1"))
                .thenReturn(Optional.of(paidAttempt()));
        when(refundRepository.save(any(PaymentRefund.class))).thenAnswer(invocation -> {
            PaymentRefund refund = invocation.getArgument(0);
            refund.setRefundId("REF-1");
            return refund;
        });
    }

    @Test
    void providerSuccessMarksRefundAndPaymentLedgerSucceeded() {
        stubNewRefund();
        when(providerRefundGateway.submit(any(), any())).thenReturn(new ProviderRefundResult(
                ProviderRefundResult.Outcome.SUCCEEDED,
                "VNPAY-REF-1", "00", "Success"));

        var response = service.refund("internal-key", request());

        ArgumentCaptor<PaymentRefund> refund = ArgumentCaptor.forClass(PaymentRefund.class);
        verify(refundRepository).save(refund.capture());
        assertThat(refund.getValue().getStatus()).isEqualTo(PaymentRefundStatus.SUCCEEDED);
        assertThat(refund.getValue().getProviderRefundReference()).isEqualTo("VNPAY-REF-1");
        assertThat(refund.getValue().getPayment().getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        assertThat(refund.getValue().getCompletedAt()).isNotNull();
        assertThat(response.getStatus()).isEqualTo("SUCCEEDED");
        verifyNoInteractions(reconciliationRepository);
    }

    @Test
    void providerRejectionMarksRefundFailedAndLeavesPaymentPaid() {
        stubNewRefund();
        when(providerRefundGateway.submit(any(), any())).thenReturn(new ProviderRefundResult(
                ProviderRefundResult.Outcome.FAILED,
                "VNPAY-REF-2", "95", "Refund rejected"));

        var response = service.refund("internal-key", request());

        ArgumentCaptor<PaymentRefund> refund = ArgumentCaptor.forClass(PaymentRefund.class);
        verify(refundRepository).save(refund.capture());
        assertThat(refund.getValue().getStatus()).isEqualTo(PaymentRefundStatus.FAILED);
        assertThat(refund.getValue().getFailureCode()).isEqualTo("95");
        assertThat(refund.getValue().getPayment().getStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(response.getStatus()).isEqualTo("FAILED");
    }

    @Test
    void providerPendingKeepsBothLedgersPending() {
        stubNewRefund();
        when(providerRefundGateway.submit(any(), any())).thenReturn(new ProviderRefundResult(
                ProviderRefundResult.Outcome.PENDING,
                "VNPAY-REF-3", "94", "Request is being processed"));

        var response = service.refund("internal-key", request());

        ArgumentCaptor<PaymentRefund> refund = ArgumentCaptor.forClass(PaymentRefund.class);
        verify(refundRepository).save(refund.capture());
        assertThat(refund.getValue().getStatus()).isEqualTo(PaymentRefundStatus.PENDING);
        assertThat(refund.getValue().getPayment().getStatus()).isEqualTo(PaymentStatus.REFUND_PENDING);
        assertThat(refund.getValue().getCompletedAt()).isNull();
        assertThat(response.getStatus()).isEqualTo("PENDING");
    }

    @Test
    void unknownProviderResultMovesLedgerToManualReview() {
        stubNewRefund();
        when(providerRefundGateway.submit(any(), any())).thenReturn(new ProviderRefundResult(
                ProviderRefundResult.Outcome.UNKNOWN,
                null, "HTTP_ERROR", "Provider timed out"));

        var response = service.refund("internal-key", request());

        ArgumentCaptor<PaymentRefund> refund = ArgumentCaptor.forClass(PaymentRefund.class);
        verify(refundRepository).save(refund.capture());
        assertThat(refund.getValue().getStatus()).isEqualTo(PaymentRefundStatus.MANUAL_REVIEW);
        assertThat(refund.getValue().getPayment().getStatus()).isEqualTo(PaymentStatus.REFUND_PENDING);
        assertThat(response.getStatus()).isEqualTo("MANUAL_REVIEW");
        verify(reconciliationRepository).save(any(PaymentReconciliationCase.class));
    }

    @Test
    void duplicateRequestReturnsLedgerReplayWithoutCallingProviderAgain() {
        PaymentRefund existing = PaymentRefund.builder()
                .refundId("REF-EXISTING")
                .payment(paidAttempt())
                .bookingId("BKG-1")
                .paymentReference("VNPAY-TXN-1")
                .idempotencyKey("refund-key-1")
                .requestHash(PaymentHashing.sha256(String.join("|",
                        "BKG-1", "VNPAY-TXN-1", "100000.00", "VND",
                        "CUSTOMER_CANCELLATION", "Customer cancelled")))
                .amount(new BigDecimal("100000.00"))
                .currency("VND")
                .reasonCode("CUSTOMER_CANCELLATION")
                .reason("Customer cancelled")
                .status(PaymentRefundStatus.SUCCEEDED)
                .completedAt(OffsetDateTime.now())
                .build();
        when(refundRepository.findByIdempotencyKey("refund-key-1"))
                .thenReturn(Optional.of(existing));

        var response = service.refund("internal-key", request());

        assertThat(response.getRefundId()).isEqualTo("REF-EXISTING");
        assertThat(response.isReplayed()).isTrue();
        verifyNoInteractions(providerRefundGateway);
        verify(refundRepository, never()).save(any());
    }

    private InternalRefundRequest request() {
        return InternalRefundRequest.builder()
                .bookingId("BKG-1")
                .paymentReference("VNPAY-TXN-1")
                .amount(new BigDecimal("100000.00"))
                .currency("VND")
                .reasonCode("CUSTOMER_CANCELLATION")
                .reason("Customer cancelled")
                .idempotencyKey("refund-key-1")
                .build();
    }

    private PaymentAttempt paidAttempt() {
        return PaymentAttempt.builder()
                .paymentId("PAY-1")
                .bookingId("BKG-1")
                .provider("VNPAY")
                .providerTxnRef("CP123")
                .providerTransactionId("VNPAY-TXN-1")
                .amount(new BigDecimal("100000.00"))
                .currency("VND")
                .status(PaymentStatus.PAID)
                .providerCreatedAt(OffsetDateTime.now().minusHours(1))
                .createdAt(OffsetDateTime.now().minusHours(1))
                .build();
    }
}
