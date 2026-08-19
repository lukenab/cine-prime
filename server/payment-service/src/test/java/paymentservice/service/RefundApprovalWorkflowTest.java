package paymentservice.service;

import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import paymentservice.client.BookingGateway;
import paymentservice.config.PaymentProperties;
import paymentservice.config.VnpayProperties;
import paymentservice.entity.PaymentRefund;
import paymentservice.entity.RefundApprovalRequest;
import paymentservice.entity.RefundApprovalStatus;
import paymentservice.provider.ProviderRefundGateway;
import paymentservice.provider.VnpaySigner;
import paymentservice.repository.*;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefundApprovalWorkflowTest {
    @Mock PaymentAttemptRepository attemptRepository;
    @Mock PaymentEventInboxRepository inboxRepository;
    @Mock PaymentReconciliationCaseRepository reconciliationRepository;
    @Mock PaymentRefundRepository refundRepository;
    @Mock RefundApprovalRequestRepository refundApprovalRepository;
    @Mock BookingGateway bookingGateway;
    @Mock VnpaySigner signer;
    @Mock VnpayProperties vnpayProperties;
    @Mock PaymentProperties paymentProperties;
    @Mock PaymentOutcomePublisher outcomePublisher;
    @Mock ProviderRefundGateway providerRefundGateway;
    @Mock JdbcTemplate jdbcTemplate;
    @InjectMocks PaymentApplicationService service;

    @AfterEach
    void clearSecurity() { SecurityContextHolder.clearContext(); }

    @Test
    void approverCanApproveSubmittedRequestWithoutExecutingRefund() {
        authenticate("approver-account");
        RefundApprovalRequest request = submitted("officer-account");
        when(refundApprovalRepository.findById("request-1")).thenReturn(Optional.of(request));
        when(refundApprovalRepository.save(request)).thenReturn(request);

        var response = service.approveRefundApproval("request-1", "Ledger checked");

        assertThat(response.getStatus()).isEqualTo("APPROVED");
        assertThat(response.getReviewedBy()).isEqualTo("approver-account");
        assertThat(request.getExecutedAt()).isNull();
    }

    @Test
    void requesterCannotApproveOwnSubmittedRequest() {
        authenticate("officer-account");
        when(refundApprovalRepository.findById("request-1"))
                .thenReturn(Optional.of(submitted("officer-account")));

        assertThatThrownBy(() -> service.approveRefundApproval("request-1", null))
                .isInstanceOf(AppException.class)
                .satisfies(error -> assertThat(((AppException) error).getErrorCode())
                        .isEqualTo(paymentservice.exception.PaymentErrorCode.REFUND_SELF_APPROVAL_FORBIDDEN));
    }

    private RefundApprovalRequest submitted(String requester) {
        return RefundApprovalRequest.builder()
                .requestId("request-1")
                .refund(PaymentRefund.builder().refundId("refund-1").bookingId("booking-1").build())
                .status(RefundApprovalStatus.SUBMITTED)
                .requestedBy(requester)
                .build();
    }

    private void authenticate(String accountId) {
        Jwt jwt = Jwt.withTokenValue("test")
                .header("alg", "none")
                .subject(accountId)
                .claim("accountId", accountId)
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
}
