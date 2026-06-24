package movieservice.service;

import java.util.List;

import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.CinemaRoomRequest;
import movieservice.dto.response.CinemaRoomResponse;
import movieservice.entity.CinemaRoom;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.CinemaRoomRepository;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class CinemaRoomService {
    CinemaRoomRepository cinemaRoomRepository;
    MovieMapper movieMapper;
    AuditLogService auditLogService;

    @Transactional
    public CinemaRoomResponse createCinemaRoom(CinemaRoomRequest cinemaRoomRequest) {
        if (cinemaRoomRepository.existsByCinemaRoomName(cinemaRoomRequest.getCinemaRoomName())) {

            throw new AppException(MovieErrorCode.CINEMA_ROOM_NAME_EXISTED);
        }

        CinemaRoom cinemaRoom = movieMapper.toCinemaRoom(cinemaRoomRequest);
        CinemaRoom room = cinemaRoomRepository.save(cinemaRoom);
        CinemaRoomResponse cinemaRoomResponse = movieMapper.toCinemaResponse(cinemaRoom);
        auditLogService.logAction("1", "Admin System", "cinema - id:" + String.valueOf(room.getCinemaRoomId()),
                "Created new cinema: " + room.getCinemaRoomName());
        return cinemaRoomResponse;
    }

   

    public CinemaRoom findByCinemaRoom(Long cinemaId) {
        return cinemaRoomRepository.findByCinemaRoomId(cinemaId);
    }

    public List<CinemaRoomResponse> getAllRooms() {
        return movieMapper.toCinemaResponseList(cinemaRoomRepository.findAll());
    }
}
