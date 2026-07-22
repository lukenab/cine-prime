package movieservice.entity;

import movieservice.enums.ScreeningVersionStatus;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class MovieScreeningVersionTest {

    @Test
    void isEffectiveOnlyInsideWindowWhileActive() {
        MovieScreeningVersion version = MovieScreeningVersion.builder()
                .status(ScreeningVersionStatus.ACTIVE)
                .effectiveFrom(LocalDate.of(2026, 7, 1))
                .effectiveTo(LocalDate.of(2026, 7, 31))
                .build();

        assertThat(version.isEffectiveOn(LocalDate.of(2026, 6, 30))).isFalse();
        assertThat(version.isEffectiveOn(LocalDate.of(2026, 7, 1))).isTrue();
        assertThat(version.isEffectiveOn(LocalDate.of(2026, 7, 31))).isTrue();
        assertThat(version.isEffectiveOn(LocalDate.of(2026, 8, 1))).isFalse();

        version.setStatus(ScreeningVersionStatus.SUPERSEDED);
        assertThat(version.isEffectiveOn(LocalDate.of(2026, 7, 15))).isFalse();
    }
}

