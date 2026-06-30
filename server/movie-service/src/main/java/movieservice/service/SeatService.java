package movieservice.service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.SeatRequest;
import movieservice.dto.response.SeatResponse;
import movieservice.entity.CinemaRoom;
import movieservice.entity.Seat;
import movieservice.enums.SeatType;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.SeatRepository;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class SeatService {

    SeatRepository seatRepository;
    MovieMapper movieMapper;

    @Transactional
    public void generateSeatsForRoom(CinemaRoom room, BigDecimal defaultPrice) {
        int total = room.getSeatQuantity();
        int seatsPerRow = room.getRoomType().getSeatsPerRow();
        List<Seat> seats = new ArrayList<>(total);

        for (int i = 0; i < total; i++) {
            char rowChar = (char) ('A' + (i / seatsPerRow));
            int col = (i % seatsPerRow) + 1;

            Seat seat = new Seat();
            seat.setSeatCode(rowChar + String.valueOf(col));
            seat.setSeatType(SeatType.STANDARD);
            seat.setSeatStatus(1);
            seat.setPrice(defaultPrice);
            seat.setCinemaRoom(room);
            seat.setCreatedAt(OffsetDateTime.now());
            seats.add(seat);
        }

        seatRepository.saveAll(seats);
        log.info("Generated {} seats for room '{}'", total, room.getCinemaRoomName());
    }

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
        seat.setUpdatedAt(OffsetDateTime.now());
        return movieMapper.toSeatResponse(seatRepository.save(seat));
    }
}
