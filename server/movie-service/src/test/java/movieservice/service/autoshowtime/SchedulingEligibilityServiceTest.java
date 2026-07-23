package movieservice.service.autoshowtime;

import movieservice.entity.CinemaCluster;
import movieservice.entity.Movie;
import movieservice.entity.MovieScreeningVersion;
import movieservice.repository.MovieAvailabilityRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SchedulingEligibilityServiceTest {

    @Mock MovieAvailabilityRepository availabilityRepository;

    private SchedulingEligibilityService service;
    private Movie movie;
    private CinemaCluster cluster;
    private MovieScreeningVersion version;
    private LocalDate businessDate;

    @BeforeEach
    void setUp() {
        service = new SchedulingEligibilityService(availabilityRepository);
        movie = Movie.builder().movieId(1L).build();
        cluster = CinemaCluster.builder().clusterId(2L).countryCode("VN").build();
        version = MovieScreeningVersion.builder().screeningVersionId(3L).movie(movie).build();
        businessDate = LocalDate.of(2026, 7, 24);
    }

    @Test
    void acceptsOnlyWhenAllIndependentGatesPass() {
        when(availabilityRepository.existsSchedulableForDate(1L, 2L, businessDate)).thenReturn(true);

        assertThat(service.evaluate(movie, cluster, version, businessDate).eligible()).isTrue();
    }

    @Test
    void returnsStableReasonsForEveryFailedGate() {
        SchedulingEligibilityResult result = service.evaluate(movie, cluster, version, businessDate);

        assertThat(result.eligible()).isFalse();
        assertThat(result.reasonCodes()).containsExactly(
                SchedulingEligibilityService.AVAILABILITY_NOT_OPEN
        );
    }
}

