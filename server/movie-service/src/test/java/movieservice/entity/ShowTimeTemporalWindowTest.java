package movieservice.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class ShowTimeTemporalWindowTest {

    @Test
    void legacyOvernightTimesBecomeTimezoneSafeWindow() {
        CinemaCluster cluster = new CinemaCluster();
        cluster.setTimezone("Asia/Ho_Chi_Minh");
        CinemaRoom room = new CinemaRoom();
        room.setCluster(cluster);

        ShowTime showTime = new ShowTime();
        showTime.setCinemaRoom(room);
        showTime.setShowDate(LocalDate.of(2026, 7, 24));
        showTime.setStartTime(LocalTime.of(23, 30));
        showTime.setEndTime(LocalTime.of(1, 50));

        showTime.synchronizeTemporalWindow();

        assertThat(showTime.getStartAt())
                .isEqualTo(OffsetDateTime.parse("2026-07-24T23:30:00+07:00"));
        assertThat(showTime.getEndAt())
                .isEqualTo(OffsetDateTime.parse("2026-07-25T01:50:00+07:00"));
    }

    @Test
    void canonicalWindowDerivesLegacyBusinessDateFields() {
        CinemaCluster cluster = new CinemaCluster();
        cluster.setTimezone("Asia/Ho_Chi_Minh");
        CinemaRoom room = new CinemaRoom();
        room.setCluster(cluster);

        ShowTime showTime = new ShowTime();
        showTime.setCinemaRoom(room);
        showTime.setStartAt(OffsetDateTime.parse("2026-07-24T16:30:00Z"));
        showTime.setEndAt(OffsetDateTime.parse("2026-07-24T18:50:00Z"));

        showTime.synchronizeTemporalWindow();

        assertThat(showTime.getShowDate()).isEqualTo(LocalDate.of(2026, 7, 24));
        assertThat(showTime.getStartTime()).isEqualTo(LocalTime.of(23, 30));
        assertThat(showTime.getEndTime()).isEqualTo(LocalTime.of(1, 50));
    }
}

