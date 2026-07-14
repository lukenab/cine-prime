package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.entity.CinemaCluster;
import movieservice.enums.ClusterStatus;
import movieservice.enums.RoomType;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomMaintenanceRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.ShowTimeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CinemaRoomServiceTest {

    @Mock CinemaRoomRepository cinemaRoomRepository;
    @Mock CinemaRoomMaintenanceRepository maintenanceRepository;
    @Mock CinemaClusterRepository cinemaClusterRepository;
    @Mock ShowTimeRepository showTimeRepository;
    @Mock MovieMapper movieMapper;
    @Mock AuditLogService auditLogService;
    @Mock SeatService seatService;

    @InjectMocks
    CinemaRoomService cinemaRoomService;

    @BeforeEach
    void setUpActiveCluster() {
        CinemaCluster cluster = CinemaCluster.builder()
                .clusterId(1L)
                .status(ClusterStatus.ACTIVE)
                .build();
        when(cinemaClusterRepository.findById(1L)).thenReturn(Optional.of(cluster));
    }

    @Test
    void rejectsAllocationWhoseRowsDoNotMatchRoomRows() {
        CinemaRoomRequest request = validRequest()
                .numberOfRows(10)
                .standardRowCount(5)
                .vipRowCount(3)
                .coupleRowCount(1)
                .build();

        AppException exception = assertThrows(
                AppException.class,
                () -> cinemaRoomService.createCinemaRoom(request));

        assertEquals(MovieErrorCode.SEAT_ROW_ALLOCATION_INVALID, exception.getErrorCode());
    }

    @Test
    void rejectsOddRowWidthWhenCoupleRowsExist() {
        CinemaRoomRequest request = validRequest()
                .numberOfRows(9)
                .seatsPerRow(9)
                .standardRowCount(5)
                .vipRowCount(3)
                .coupleRowCount(1)
                .build();

        AppException exception = assertThrows(
                AppException.class,
                () -> cinemaRoomService.createCinemaRoom(request));

        assertEquals(MovieErrorCode.COUPLE_ROW_REQUIRES_EVEN_SEATS, exception.getErrorCode());
    }

    private CinemaRoomRequest.CinemaRoomRequestBuilder validRequest() {
        return CinemaRoomRequest.builder()
                .cinemaRoomName("Room 1")
                .roomType(RoomType.STANDARD)
                .numberOfRows(10)
                .seatsPerRow(10)
                .standardRowCount(6)
                .vipRowCount(3)
                .coupleRowCount(1)
                .defaultPrice(new BigDecimal("90000"))
                .clusterId(1L);
    }
}
