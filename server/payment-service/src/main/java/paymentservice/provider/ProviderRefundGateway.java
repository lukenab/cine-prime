package paymentservice.provider;

import paymentservice.entity.PaymentAttempt;
import paymentservice.entity.PaymentRefund;

public interface ProviderRefundGateway {
    ProviderRefundResult submit(PaymentAttempt payment, PaymentRefund refund);
}
