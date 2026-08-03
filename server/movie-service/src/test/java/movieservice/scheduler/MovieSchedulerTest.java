package movieservice.scheduler;

import movieservice.entity.CinemaCluster;
import movieservice.entity.Movie;
import movieservice.entity.MovieAvailability;
import movieservice.enums.AvailabilityStatus;
import movieservice.repository.MovieAvailabilityRepository;
import movieservice.lifecycle.LifecycleEventNotifier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MovieSchedulerTest {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final LocalDate BUSINESS_DATE = LocalDate.of(2026, 8, 2);

    @Mock
    private MovieAvailabilityRepository movieAvailabilityRepository;
    @Mock
    private LifecycleEventNotifier lifecycleEventNotifier;

    private MovieScheduler scheduler;

    @BeforeEach
    void setUp() {
        // 2026-08-01 17:05 UTC is already 2026-08-02 in Vietnam.
        Clock clock = Clock.fixed(Instant.parse("2026-08-01T17:05:00Z"), BUSINESS_ZONE);
        scheduler = new MovieScheduler(movieAvailabilityRepository, clock, lifecycleEventNotifier);
    }

    @Test
    void closesExpiredWindowsUsingConfiguredBusinessDate() {
        MovieAvailability open = availability(11L, AvailabilityStatus.OPEN);
        MovieAvailability suspended = availability(12L, AvailabilityStatus.SUSPENDED);
        List<AvailabilityStatus> closeable = List.of(
                AvailabilityStatus.PLANNED,
                AvailabilityStatus.IN_REVIEW,
                AvailabilityStatus.CHANGES_REQUESTED,
                AvailabilityStatus.APPROVED,
                AvailabilityStatus.OPEN,
                AvailabilityStatus.SUSPENDED);
        when(movieAvailabilityRepository.findByStatusInAndShowingEndDateBefore(
                closeable, BUSINESS_DATE)).thenReturn(List.of(open, suspended));

        scheduler.autoCloseExpiredAvailability();

        assertEquals(AvailabilityStatus.CLOSED, open.getStatus());
        assertEquals(AvailabilityStatus.CLOSED, suspended.getStatus());
        assertEquals("SYSTEM", open.getUpdatedBy());
        assertEquals("SYSTEM", suspended.getUpdatedBy());
        verify(movieAvailabilityRepository).saveAll(List.of(open, suspended));
    }

    @Test
    void opensDueReleasePlanWindowsUsingConfiguredBusinessDate() {
        MovieAvailability approved = availability(21L, AvailabilityStatus.APPROVED);
        approved.setShowingStartDate(BUSINESS_DATE.plusDays(2));
        approved.setShowingEndDate(BUSINESS_DATE.plusDays(7));
        when(movieAvailabilityRepository.findDueToOpen(
                LocalDateTime.of(2026, 8, 2, 0, 5), BUSINESS_DATE))
                .thenReturn(List.of(approved));

        scheduler.autoOpenDueAvailability();

        assertEquals(AvailabilityStatus.OPEN, approved.getStatus());
        assertEquals("SYSTEM", approved.getUpdatedBy());
        verify(movieAvailabilityRepository).saveAll(List.of(approved));
    }

    @Test
    void emptySchedulerRunsDoNotWriteAnything() {
        List<AvailabilityStatus> closeable = List.of(
                AvailabilityStatus.PLANNED,
                AvailabilityStatus.IN_REVIEW,
                AvailabilityStatus.CHANGES_REQUESTED,
                AvailabilityStatus.APPROVED,
                AvailabilityStatus.OPEN,
                AvailabilityStatus.SUSPENDED);
        when(movieAvailabilityRepository.findByStatusInAndShowingEndDateBefore(
                closeable, BUSINESS_DATE)).thenReturn(List.of());
        when(movieAvailabilityRepository.findDueToOpen(
                LocalDateTime.of(2026, 8, 2, 0, 5), BUSINESS_DATE)).thenReturn(List.of());

        scheduler.autoCloseExpiredAvailability();
        scheduler.autoOpenDueAvailability();

        verify(movieAvailabilityRepository, never()).saveAll(org.mockito.ArgumentMatchers.anyList());
    }

    private MovieAvailability availability(Long availabilityId, AvailabilityStatus status) {
        return MovieAvailability.builder()
                .availabilityId(availabilityId)
                .movie(Movie.builder().movieId(100L + availabilityId).build())
                .cluster(CinemaCluster.builder().clusterId(200L + availabilityId).build())
                .status(status)
                .showingStartDate(BUSINESS_DATE.minusDays(1))
                .showingEndDate(BUSINESS_DATE.minusDays(1))
                .build();
    }
}
