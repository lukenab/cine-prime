package movieservice.security;

import lombok.RequiredArgsConstructor;
import movie.theater.common.security.JwtBranchScope;
import movieservice.entity.CinemaRoom;
import movieservice.entity.CinemaRoomMaintenance;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.CinemaRoomMaintenanceRepository;
import movieservice.repository.CinemaRoomRepository;
import movie.theater.common.exception.AppException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class CinemaRoomAccessPolicy {

    private final CinemaRoomRepository cinemaRoomRepository;
    private final CinemaRoomMaintenanceRepository maintenanceRepository;

    @Transactional(readOnly = true)
    public void requireRoomAccess(Long roomId) {
        CinemaRoom room = cinemaRoomRepository.findById(roomId)
                .orElseThrow(() -> new AppException(MovieErrorCode.CINEMA_ROOM_NOT_FOUND));
        Long clusterId = room.getCluster() == null ? null : room.getCluster().getClusterId();
        requireClusterAccess(clusterId);
    }

    @Transactional(readOnly = true)
    public void requireMaintenanceAccess(Long maintenanceId) {
        CinemaRoomMaintenance maintenance = maintenanceRepository.findById(maintenanceId)
                .orElseThrow(() -> new AppException(MovieErrorCode.MAINTENANCE_NOT_FOUND));
        CinemaRoom room = maintenance.getCinemaRoom();
        Long clusterId = room == null || room.getCluster() == null
                ? null
                : room.getCluster().getClusterId();
        requireClusterAccess(clusterId);
    }

    private void requireClusterAccess(Long clusterId) {
        if (clusterId == null || !JwtBranchScope.canAccess(clusterId)) {
            throw new AccessDeniedException("Cinema branch is outside the authenticated staff scope");
        }
    }
}
