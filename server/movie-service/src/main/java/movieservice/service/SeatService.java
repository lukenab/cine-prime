package movieservice.service;

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
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.SeatRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class SeatService {

    SeatRepository seatRepository;
    MovieMapper movieMapper;

    /**
     * Tự động sinh ghế cho phòng mới tạo.
     * Mỗi ghế có rowLabel (A, B, C...) và colNumber (1, 2, 3...).
     * seatCode = rowLabel + colNumber, e.g. "A1", "B12".
     */
    @Transactional
    public void generateSeatsForRoom(CinemaRoom room, BigDecimal defaultPrice) {
        int total = room.getTotalSeatCapacity();
        int seatsPerRow = room.getRoomType().getSeatsPerRow();
        List<Seat> seats = new ArrayList<>(total);

        for (int i = 0; i < total; i++) {
            String rowLabel = String.valueOf((char) ('A' + (i / seatsPerRow)));
            int colNumber = (i % seatsPerRow) + 1;

            Seat seat = Seat.builder()
                    .seatCode(rowLabel + colNumber)
                    .rowLabel(rowLabel)
                    .colNumber(colNumber)
                    .seatType(SeatType.STANDARD)
                    .status(SeatStatus.ACTIVE)
                    .price(defaultPrice)
                    .cinemaRoom(room)
                    .build();

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
        return movieMapper.toSeatResponse(seatRepository.save(seat));
    }

    /**
     * Đặt ghế thành MAINTENANCE (e.g. ghế bị hỏng).
     */
    @Transactional
    public void setSeatStatus(long seatId, SeatStatus newStatus) {
        Seat seat = seatRepository.findById(seatId)
                .orElseThrow(() -> new AppException(MovieErrorCode.SEAT_NOT_FOUND));
        seat.setStatus(newStatus);
        seatRepository.save(seat);
    }
}
