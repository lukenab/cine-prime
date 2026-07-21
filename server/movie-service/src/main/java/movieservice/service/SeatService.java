package movieservice.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.SeatRequest;
import movieservice.dto.response.SeatResponse;
import movieservice.entity.Seat;
import movieservice.enums.SeatStatus;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.SeatRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class SeatService {

    SeatRepository seatRepository;
    MovieMapper movieMapper;

    public List<SeatResponse> getSeatsByRoom(Long roomId) {
        return movieMapper.toSeatResponseList(
                seatRepository.findByCinemaRoomCinemaRoomId(roomId));
    }

    public SeatResponse getSeatById(long seatId) {
        Seat seat = seatRepository.findById(seatId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SEAT_NOT_FOUND));
        return movieMapper.toSeatResponse(seat);
    }

    @Transactional
    public SeatResponse updateSeat(long seatId, SeatRequest request) {
        Seat seat = seatRepository.findById(seatId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SEAT_NOT_FOUND));
        seat.setSeatType(request.getSeatType());
        seat.setPrice(request.getPrice());
        return movieMapper.toSeatResponse(seatRepository.save(seat));
    }

    /**
     * Dat ghe thanh MAINTENANCE (vd ghe bi hong).
     */
    @Transactional
    public SeatResponse setSeatStatus(long seatId, String newStatusStr) {
        Seat seat = seatRepository.findById(seatId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SEAT_NOT_FOUND));

        SeatStatus newStatus;
        try {
            newStatus = SeatStatus.valueOf(newStatusStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException(MovieErrorCode.INVALID_SEAT_STATUS);
        }

        seat.setStatus(newStatus);
        return movieMapper.toSeatResponse(seatRepository.save(seat));
    }
}
