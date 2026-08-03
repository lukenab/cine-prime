package bookingservice.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Utility for consistent VND monetary operations.
 * VND does not use decimals in practice; all amounts are rounded to the nearest dong.
 */
public final class MoneyUtil {

    private MoneyUtil() {
        throw new UnsupportedOperationException("Utility class");
    }

    /**
     * Rounds a VND amount to the nearest dong (no decimal places).
     * Uses HALF_UP rounding: 0.5 and above rounds up, below 0.5 rounds down.
     *
     * @param amount the amount to round
     * @return rounded amount with scale 0
     */
    public static BigDecimal roundVND(BigDecimal amount) {
        if (amount == null) {
            return BigDecimal.ZERO;
        }
        return amount.setScale(0, RoundingMode.HALF_UP);
    }

    /**
     * Rounds a VND amount to the nearest 1000 dong for display purposes.
     * Example: 205500 → 206000, 205499 → 205000
     *
     * @param amount the amount to round
     * @return rounded amount to nearest 1000
     */
    public static BigDecimal roundVNDToThousand(BigDecimal amount) {
        if (amount == null) {
            return BigDecimal.ZERO;
        }
        // Divide by 1000, round, then multiply back
        return amount.divide(new BigDecimal("1000"), 0, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("1000"));
    }

    /**
     * Checks if two monetary amounts are equal in value, ignoring scale differences.
     * Use this instead of equals() for BigDecimal money comparisons.
     *
     * @param a first amount
     * @param b second amount
     * @return true if amounts are numerically equal
     */
    public static boolean isEqual(BigDecimal a, BigDecimal b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.compareTo(b) == 0;
    }

    /**
     * Ensures a final amount is not negative. Returns zero if negative.
     *
     * @param amount the amount to check
     * @return max(amount, 0)
     */
    public static BigDecimal nonNegative(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO;
        }
        return amount;
    }
}
