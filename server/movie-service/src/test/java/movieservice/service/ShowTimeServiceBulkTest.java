package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.BulkShowTimeRequest;
import movieservice.dto.response.BulkShowTimeCreateResponse;
import movieservice.dto.response.BulkShowTimePreviewResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.CinemaCluster;
import movieservice.entity.Movie;
import movieservice.entity.RoomLayout;
import movieservice.entity.ShowTime;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.LayoutStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.SeatRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShowTimeServiceBulkTest {

    @Mock ShowTimeRepository showTimeRepository;
    @Mock ShowtimeSeatRepository showtimeSeatRepository;
    @Mock SeatRepository seatRepository;
    @Mock MovieRepository movieRepository;
    @Mock CinemaRoomRepository cinemaRoomRepository;
    @Mock RoomLayoutRepository roomLayoutRepository;
    @Mock MovieMapper movieMapper;

    @InjectMocks
    ShowTimeService showTimeService;

    @Test
    void previewRejectsMovieThatWouldFinishOnNextDay() {
        BulkShowTimeRequest request = request(
                LocalDate.now().plusDays(3), List.of(LocalTime.of(22, 0)));
        Movie movie = Movie.builder().movieId(1L).durationMinutes(166).build();
        CinemaRoom room = room();

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(cinemaRoomRepository.findAllById(List.of(1L))).thenReturn(List.of(room));
        allowActiveLayout(1L);
        when(showTimeRepository.findActiveByRoomsAndDateRange(
                List.of(1L), request.getFromDate(), request.getToDate())).thenReturn(List.of());

        BulkShowTimePreviewResponse response = showTimeService.generatePreview(request);

        assertEquals(0, response.getValidCount());
        assertEquals(1, response.getConflictCount());
        assertEquals("Showtime falls outside operating hours (08:00–23:00)",
                response.getConflicts().getFirst().getReason());
        verify(showTimeRepository, never()).existsByCinemaRoomAndOverlappingTime(
                any(), any(), any(), any());
    }

    @Test
    void previewRejectsRequestStartingBeforeMinimumDate() {
        BulkShowTimeRequest request = request(
                LocalDate.now().plusDays(2), List.of(LocalTime.of(10, 0)));

        AppException exception = assertThrows(
                AppException.class, () -> showTimeService.generatePreview(request));

        assertEquals(MovieErrorCode.INVALID_SHOWDATE, exception.getErrorCode());
        verify(movieRepository, never()).findById(any());
    }

    @Test
    void previewDeduplicatesAndChecksGeneratedOverlapInLinearOrder() {
        BulkShowTimeRequest request = request(
                LocalDate.now().plusDays(3),
                List.of(LocalTime.of(10, 0), LocalTime.of(10, 0), LocalTime.of(11, 0)));
        Movie movie = Movie.builder().movieId(1L).durationMinutes(120).build();

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(cinemaRoomRepository.findAllById(List.of(1L))).thenReturn(List.of(room()));
        allowActiveLayout(1L);
        when(showTimeRepository.findActiveByRoomsAndDateRange(
                List.of(1L), request.getFromDate(), request.getToDate())).thenReturn(List.of());

        BulkShowTimePreviewResponse response = showTimeService.generatePreview(request);

        assertEquals(1, response.getValidCount());
        assertEquals(1, response.getConflictCount());
        assertEquals(LocalTime.of(10, 0), response.getValid().getFirst().getStartTime());
    }

    @Test
    void bulkCreateLocksRoomsBeforeConflictQueryAndReusesLoadedRooms() {
        BulkShowTimeRequest request = request(
                LocalDate.now().plusDays(3), List.of(LocalTime.of(10, 0)));
        Movie movie = Movie.builder().movieId(1L).durationMinutes(90).build();
        CinemaRoom room = room();

        when(movieRepository.findById(1L)).thenReturn(Optional.of(movie));
        when(cinemaRoomRepository.findAllByIdForUpdate(List.of(1L))).thenReturn(List.of(room));
        allowActiveLayout(1L);
        when(showTimeRepository.findActiveByRoomsAndDateRange(
                List.of(1L), request.getFromDate(), request.getToDate())).thenReturn(List.of());
        when(showTimeRepository.saveAllAndFlush(anyList())).thenAnswer(invocation -> {
            List<ShowTime> values = invocation.getArgument(0);
            values.getFirst().setShowTimeId(99L);
            return values;
        });

        BulkShowTimeCreateResponse response = showTimeService.bulkCreate(request);

        assertEquals(1, response.getCreatedCount());
        assertEquals(0, response.getSkippedCount());
        verify(cinemaRoomRepository, never()).findByCinemaRoomId(any());
        verify(showTimeRepository, never()).existsByCinemaRoomAndOverlappingTime(
                any(), any(), any(), any());

        InOrder ordered = inOrder(cinemaRoomRepository, showTimeRepository);
        ordered.verify(cinemaRoomRepository).findAllByIdForUpdate(List.of(1L));
        ordered.verify(showTimeRepository).findActiveByRoomsAndDateRange(
                List.of(1L), request.getFromDate(), request.getToDate());
        ordered.verify(showTimeRepository).saveAllAndFlush(anyList());
    }

    private BulkShowTimeRequest request(LocalDate date, List<LocalTime> startTimes) {
        BulkShowTimeRequest request = new BulkShowTimeRequest();
        request.setMovieId(1L);
        request.setCinemaRoomIds(List.of(1L));
        request.setFromDate(date);
        request.setToDate(date);
        request.setStartTimes(startTimes);
        request.setBasePrice(new BigDecimal("100000.00"));
        request.setLanguageCode("vi");
        return request;
    }

    private CinemaRoom room() {
        return CinemaRoom.builder()
                .cinemaRoomId(1L)
                .cinemaRoomName("Room 1")
                .totalSeatCapacity(100)
                .status(CinemaRoomStatus.ACTIVE)
                .cluster(CinemaCluster.builder().clusterId(1L).status(ClusterStatus.ACTIVE).build())
                .build();
    }

    private void allowActiveLayout(Long roomId) {
        RoomLayout layout = RoomLayout.builder()
                .status(LayoutStatus.ACTIVE)
                .personCapacity(100)
                .sellableUnitCount(100)
                .build();
        when(roomLayoutRepository.findByCinemaRoomCinemaRoomIdAndStatus(roomId, LayoutStatus.ACTIVE))
                .thenReturn(Optional.of(layout));
    }
}
