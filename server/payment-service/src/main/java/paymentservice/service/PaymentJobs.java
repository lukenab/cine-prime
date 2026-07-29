package paymentservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PaymentJobs {
    private final PaymentApplicationService paymentService;

    @Scheduled(fixedDelayString = "${payment.delivery.fixed-delay-ms:5000}")
    public void retryOutcomeDelivery() {
        paymentService.retryOutcomeDelivery();
    }

    @Scheduled(fixedDelayString = "30000")
    public void expireDueSessions() {
        paymentService.expireDueSessions();
    }
}
