package movieservice.service;

import java.math.BigDecimal;

/// Một nguồn giá mặc định dùng chung cho manual và auto showtime khi room chưa có Seat price.
public final class ShowtimePricingDefaults {

    public static final BigDecimal DEFAULT_SEAT_PRICE = new BigDecimal("85000.00");

    private ShowtimePricingDefaults() {
    }
}
