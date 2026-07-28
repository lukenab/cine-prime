package movieservice.service;

import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import movieservice.repository.ShowtimeSeatRepository;

@Component
public class SeatHoldMetrics {

    private final Counter created;
    private final Counter released;
    private final Counter expired;
    private final Counter conflicts;
    private final Counter sold;
    private final Counter reconciliationMismatches;
    private final AtomicLong createdCount = new AtomicLong();
    private final AtomicLong soldCount = new AtomicLong();

    public SeatHoldMetrics(MeterRegistry registry, ShowtimeSeatRepository repository) {
        created = registry.counter("seat_holds_created_total");
        released = registry.counter("seat_holds_released_total");
        expired = registry.counter("seat_holds_expired_total");
        conflicts = registry.counter("seat_hold_conflicts_total");
        sold = registry.counter("seat_holds_sold_total");
        reconciliationMismatches = registry.counter("seat_hold_reconciliation_mismatches_total");
        Gauge.builder("seat_holds_active", repository, ShowtimeSeatRepository::countActiveHolds)
                .description("Distinct non-expired temporary seat holds")
                .register(registry);
        Gauge.builder("seat_hold_conversion_to_paid_ratio", this, SeatHoldMetrics::conversion)
                .description("Sold holds divided by created holds since process start")
                .register(registry);
    }

    public void created() { created.increment(); createdCount.incrementAndGet(); }
    public void released() { released.increment(); }
    public void expired() { expired.increment(); }
    public void conflict() { conflicts.increment(); }
    public void sold() { sold.increment(); soldCount.incrementAndGet(); }
    public void reconciliationMismatch() { reconciliationMismatches.increment(); }

    private double conversion() {
        long denominator = createdCount.get();
        return denominator == 0 ? 0 : (double) soldCount.get() / denominator;
    }
}
