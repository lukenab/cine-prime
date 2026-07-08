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
import movieservice.entity.CinemaRoom;
import movieservice.entity.CinemaRoomMaintenance;
import movieservice.enums.CinemaRoomStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaRoomMaintenanceRepository;
import movieservice.repository.CinemaRoomRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class CinemaRoomService {

    CinemaRoomRepository cinemaRoomRepository;
    CinemaRoomMaintenanceRepository maintenanceRepository;
    MovieMapper movieMapper;
    AuditLogService auditLogService;
    SeatService seatService;

    @Transactional
    public CinemaRoomResponse createCinemaRoom(CinemaRoomRequest request) {
        if (cinemaRoomRepository.existsByCinemaRoomName(request.getCinemaRoomName())) {
            throw new AppException(MovieErrorCode.CINEMA_ROOM_NAME_EXISTED);
        }

        int maxSeats = request.getRoomType().getMaxSeats();
        if (request.getTotalSeatCapacity() > maxSeats) {
            throw new AppException(MovieErrorCode.SEAT_QUANTITY_EXCEEDS_LIMIT);
        }

        CinemaRoom room = movieMapper.toCinemaRoom(request);
        room.setStatus(CinemaRoomStatus.ACTIVE);
        room = cinemaRoomRepository.save(room);

        seatService.generateSeatsForRoom(room, request.getDefaultPrice());

        auditLogService.logAction("SYSTEM", "Admin",
                "cinema_room:" + room.getCinemaRoomId(),
                "Created cinema room: " + room.getCinemaRoomName());

        return movieMapper.toCinemaRoomResponse(room);
    }

    public CinemaRoom findByCinemaRoom(Long cinemaId) {
        return cinemaRoomRepository.findByCinemaRoomId(cinemaId);
    }

    public List<CinemaRoomResponse> getAllRooms() {
        return movieMapper.toCinemaRoomResponseList(cinemaRoomRepository.findAll());
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
