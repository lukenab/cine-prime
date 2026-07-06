package userservice.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.ExponentialBackOff;

@Configuration
@Slf4j
public class KafkaConsumerConfig {

    /**
     * Cấu hình error handler cho tất cả Kafka listeners trong user-service.
     *
     * Chiến lược:
     * 1. Retry tối đa 3 lần với exponential backoff: 1s → 2s → 4s
     * 2. Sau 3 lần thất bại, message được chuyển sang Dead Letter Topic
     *    (tên DLT = {original-topic}.DLT, ví dụ: user-register-topic.DLT)
     * 3. DLT listener trong UserEventConsumer sẽ log ALERT để team biết
     *    cần can thiệp thủ công.
     *
     * Tại sao dùng ExponentialBackOff thay vì FixedBackOff?
     * Nếu DB đang quá tải, retry ngay lập tức (fixed) sẽ làm nặng thêm.
     * Exponential backoff cho DB thời gian phục hồi giữa các lần retry.
     */
    @Bean
    public DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, Object> kafkaTemplate) {
        // Publish message thất bại sang DLT
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(kafkaTemplate);

        // Retry 3 lần: lần 1 sau 1s, lần 2 sau 2s, lần 3 sau 4s
        ExponentialBackOff backoff = new ExponentialBackOff(1_000L, 2.0);
        backoff.setMaxAttempts(3);

        DefaultErrorHandler errorHandler = new DefaultErrorHandler(recoverer, backoff);

        // Log khi retry
        errorHandler.setRetryListeners((record, ex, deliveryAttempt) ->
            log.warn("[KAFKA] Retry attempt {} for topic={} partition={} offset={}: {}",
                deliveryAttempt,
                record.topic(),
                record.partition(),
                record.offset(),
                ex.getMessage())
        );

        return errorHandler;
    }
}
