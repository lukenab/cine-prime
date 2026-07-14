package movieservice.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.request.MaintenanceRequest;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.entity.CinemaCluster;
import movieservice.entity.CinemaRoom;
import movieservice.entity.CinemaRoomMaintenance;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.ClusterStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomMaintenanceRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.ShowTimeRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class CinemaRoomService {

    // Duoi truoc day tung ap len totalSeatCapacity truc tiep (@Min(10) tren field request);
    // gio capacity la gia tri tinh (numberOfRows * seatsPerRow) nen kiem tra sau khi tinh.
    private static final int MIN_SEAT_CAPACITY = 10;

    CinemaRoomRepository cinemaRoomRepository;
    CinemaRoomMaintenanceRepository maintenanceRepository;
    CinemaClusterRepository cinemaClusterRepository;
    ShowTimeRepository showTimeRepository;
    MovieMapper movieMapper;
    AuditLogService auditLogService;
    SeatService seatService;

    @Transactional
    public CinemaRoomResponse createCinemaRoom(CinemaRoomRequest request) {
        CinemaCluster cluster = cinemaClusterRepository.findById(request.getClusterId())
                .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));

        if (cluster.getStatus() != ClusterStatus.ACTIVE) {
            throw new AppException(MovieErrorCode.CLUSTER_NOT_ACTIVE);
        }

        if (cinemaRoomRepository.existsByCluster_ClusterIdAndCinemaRoomName(
                request.getClusterId(), request.getCinemaRoomName())) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_NAME_EXISTED);
        }

        if (request.getNumberOfRows() > SeatService.MAX_ROWS) {
            throw new AppException(MovieErrorCode.SEAT_ROW_LIMIT_EXCEEDED);
        }

        // totalSeatCapacity la gia tri tinh, khong nhan tu client — RoomType chi con dung
        // de gioi han maxSeats (va cung cap gia tri mac dinh goi y o frontend).
        int estimatedSeats = request.getNumberOfRows() * request.getSeatsPerRow();
        int maxSeats = request.getRoomType().getMaxSeats();
        if (estimatedSeats > maxSeats) {
            throw new AppException(MovieErrorCode.SEAT_QUANTITY_EXCEEDS_LIMIT);
        }
        if (estimatedSeats < MIN_SEAT_CAPACITY) {
            throw new AppException(MovieErrorCode.SEAT_QUANTITY_TOO_SMALL);
        }

        int allocatedRows = request.getStandardRowCount()
                + request.getVipRowCount()
                + request.getCoupleRowCount();
        boolean hasAccessibleHostRow = request.getStandardRowCount() + request.getVipRowCount() > 0;
        if (allocatedRows != request.getNumberOfRows() || !hasAccessibleHostRow) {
            throw new AppException(MovieErrorCode.SEAT_ROW_ALLOCATION_INVALID);
        }
        if (request.getCoupleRowCount() > 0 && request.getSeatsPerRow() % 2 != 0) {
            throw new AppException(MovieErrorCode.COUPLE_ROW_REQUIRES_EVEN_SEATS);
        }

        CinemaRoom room = movieMapper.toCinemaRoom(request);
        room.setTotalSeatCapacity(estimatedSeats);
        room.setCluster(cluster);
        room.setStatus(CinemaRoomStatus.ACTIVE);
        room = cinemaRoomRepository.save(room);

        seatService.generateSeatsForRoom(room, request.getDefaultPrice());

        auditLogService.logAction("SYSTEM", "Admin",
                "cinema_room:" + room.getCinemaRoomId(),
                "Created cinema room: " + room.getCinemaRoomName());

        return movieMapper.toCinemaRoomResponse(room);
    }

    // Chỉ cho xóa cứng room chưa từng gắn showtime nào — có showtime rồi (kể cả đã qua/đã hủy)
    // thì bắt buộc dùng setRoomStatus(CLOSED) để giữ nguyên vẹn lịch sử vé/doanh thu.
    @Transactional
    public void deleteCinemaRoom(Long roomId) {
        if (!cinemaRoomRepository.existsById(roomId)) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND);
        }

        if (showTimeRepository.existsByCinemaRoomCinemaRoomId(roomId)) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_HAS_SHOWTIMES);
        }

        seatService.deleteSeatsByRoom(roomId);
        cinemaRoomRepository.deleteById(roomId);

        auditLogService.logAction("SYSTEM", "Admin",
                "cinema_room:" + roomId, "Deleted cinema room");
    }

    public CinemaRoom findByCinemaRoom(Long cinemaId) {
        return cinemaRoomRepository.findByCinemaRoomId(cinemaId);
    }

    public List<CinemaRoomResponse> getAllRooms(Long clusterId) {
        List<CinemaRoom> rooms = (clusterId != null)
                ? cinemaRoomRepository.findByCluster_ClusterId(clusterId)
                : cinemaRoomRepository.findAll();
        return movieMapper.toCinemaRoomResponseList(rooms);
    }

    // ── Maintenance ───────────────────────────────────────────

    @Transactional
    public CinemaRoomMaintenance reportMaintenance(Long roomId,
                                                    MaintenanceRequest request,
                                                    String createdBy) {
        CinemaRoom room = cinemaRoomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));

        // Tạo maintenance record
        CinemaRoomMaintenance maintenance = CinemaRoomMaintenance.builder()
                .cinemaRoom(room)
                .reason(request.getReason())
                .severity(request.getSeverity())
                .startedAt(request.getStartedAt() != null ? request.getStartedAt() : LocalDateTime.now())
                .resolved(false)
                .createdBy(createdBy)
                .build();

        maintenanceRepository.save(maintenance);

        // Tự động set room status → TEMPORARILY_UNAVAILABLE
        room.setStatus(CinemaRoomStatus.TEMPORARILY_UNAVAILABLE);
        room.setMaintenanceNote(request.getReason());
        cinemaRoomRepository.save(room);

        log.info("Room {} set to TEMPORARILY_UNAVAILABLE — reason: {}", roomId, request.getReason());
        return maintenance;
    }

    @Transactional
    public void resolveMaintenance(Long maintenanceId, String resolutionNote, String resolvedBy) {
        CinemaRoomMaintenance maintenance = maintenanceRepository.findById(maintenanceId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));

        maintenance.setResolved(true);
        maintenance.setResolvedAt(LocalDateTime.now());
        maintenance.setResolutionNote(resolutionNote);
        maintenanceRepository.save(maintenance);

        CinemaRoom room = maintenance.getCinemaRoom();
        boolean hasOpenMaintenance = maintenanceRepository
                .findByCinemaRoom_CinemaRoomIdAndResolvedFalse(room.getCinemaRoomId())
                .isEmpty();

        if (hasOpenMaintenance) {
            room.setStatus(CinemaRoomStatus.ACTIVE);
            room.setMaintenanceNote(null);
            cinemaRoomRepository.save(room);
            log.info("Room {} restored to ACTIVE", room.getCinemaRoomId());
        }
    }

    @Transactional
    public CinemaRoomResponse setRoomStatus(Long roomId, CinemaRoomStatus newStatus, String updatedBy) {
        CinemaRoom room = cinemaRoomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
        room.setStatus(newStatus);
        room.setUpdatedBy(updatedBy);
        return movieMapper.toCinemaRoomResponse(cinemaRoomRepository.save(room));
    }
}
