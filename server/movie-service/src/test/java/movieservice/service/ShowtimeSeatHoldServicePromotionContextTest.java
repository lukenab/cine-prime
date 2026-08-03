package movieservice.service;

import movieservice.dto.request.HoldShowtimeSeatsRequest;
import movieservice.dto.response.ShowtimeSeatHoldResponse;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Movie;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.enums.ShowTimeStatus;
import movieservice.enums.ShowtimeSeatStatus;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ShowtimeSeatHoldServicePromotionContextTest {

    @Test
    void hold_returnsMovieAndClusterContextFromAuthoritativeShowtime() {
        ShowTimeRepository showtimes = mock(ShowTimeRepository.class);
        ShowtimeSeatRepository seats = mock(ShowtimeSeatRepository.class);
        Clock clock = Clock.fixed(Instant.parse("2026-08-03T00:00:00Z"), ZoneOffset.UTC);
        ShowtimeSeatHoldService service = new ShowtimeSeatHoldService(showtimes, seats, clock);

        Movie movie = new Movie();
        movie.setMovieId(12L);
        CinemaCluster cluster = new CinemaCluster();
        cluster.setClusterId(7L);
        CinemaRoom room = new CinemaRoom();
        room.setCluster(cluster);
        ShowTime showtime = new ShowTime();
        showtime.setShowTimeId(55L);
        showtime.setMovie(movie);
        showtime.setCinemaRoom(room);
        showtime.setStatus(ShowTimeStatus.ON_SALE);

        ShowtimeSeat seat = new ShowtimeSeat();
        seat.setShowtimeSeatId(901L);
        seat.setSeatCode("G7");
        seat.setPrice(new BigDecimal("120000"));
        seat.setStatus(ShowtimeSeatStatus.AVAILABLE);

        when(showtimes.findByIdForUpdate(55L)).thenReturn(Optional.of(showtime));
        when(seats.findByHoldOwnerAndIdempotencyKey(55L, "member-01", "hold-001")).thenReturn(List.of());
        when(seats.findAllByShowtimeAndIdsForUpdate(eq(55L), any())).thenReturn(List.of(seat));

        ShowtimeSeatHoldResponse response = service.hold(
                55L, new HoldShowtimeSeatsRequest(List.of(901L)), "member-01", "hold-001");

        assertThat(response.getMovieId()).isEqualTo(12L);
        assertThat(response.getClusterId()).isEqualTo(7L);
        assertThat(response.getShowtimeId()).isEqualTo(55L);
        assertThat(response.getTotalPrice()).isEqualByComparingTo("120000");
    }
}
