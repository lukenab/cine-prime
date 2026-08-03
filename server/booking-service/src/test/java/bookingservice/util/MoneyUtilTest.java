package bookingservice.util;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class MoneyUtilTest {

    @Test
    void roundVNDRemovesDecimals() {
        assertThat(MoneyUtil.roundVND(new BigDecimal("120000.49")))
                .isEqualByComparingTo(new BigDecimal("120000"));
        assertThat(MoneyUtil.roundVND(new BigDecimal("120000.50")))
                .isEqualByComparingTo(new BigDecimal("120001"));
        assertThat(MoneyUtil.roundVND(new BigDecimal("120000.99")))
                .isEqualByComparingTo(new BigDecimal("120001"));
    }

    @Test
    void roundVNDToThousandRoundsToNearest1000() {
        assertThat(MoneyUtil.roundVNDToThousand(new BigDecimal("205499")))
                .isEqualByComparingTo(new BigDecimal("205000"));
        assertThat(MoneyUtil.roundVNDToThousand(new BigDecimal("205500")))
                .isEqualByComparingTo(new BigDecimal("206000"));
        assertThat(MoneyUtil.roundVNDToThousand(new BigDecimal("205999")))
                .isEqualByComparingTo(new BigDecimal("206000"));
    }

    @Test
    void isEqualIgnoresScale() {
        assertThat(MoneyUtil.isEqual(new BigDecimal("120000"), new BigDecimal("120000.00")))
                .isTrue();
        assertThat(MoneyUtil.isEqual(new BigDecimal("120000"), new BigDecimal("120000.01")))
                .isFalse();
    }

    @Test
    void nonNegativeReturnsZeroForNegativeInput() {
        assertThat(MoneyUtil.nonNegative(new BigDecimal("-100")))
                .isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(MoneyUtil.nonNegative(new BigDecimal("100")))
                .isEqualByComparingTo(new BigDecimal("100"));
        assertThat(MoneyUtil.nonNegative(null))
                .isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void roundVNDHandlesNull() {
        assertThat(MoneyUtil.roundVND(null))
                .isEqualByComparingTo(BigDecimal.ZERO);
    }
}
