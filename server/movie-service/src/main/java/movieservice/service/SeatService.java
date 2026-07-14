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
import movieservice.enums.RoomType;
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

    @Transactional
    public void generateSeatsForRoom(CinemaRoom room, BigDecimal defaultPrice) {
        int total = room.getTotalSeatCapacity();
        RoomType roomType = room.getRoomType();
        int seatsPerRow = roomType.getSeatsPerRow();
        int totalRows = (int) Math.ceil((double) total / seatsPerRow);

        // Phong qua nho (< 3 hang) thi bo han vung Couple de tranh chiem gan het phong.
        int coupleRows = totalRows >= 3 ? Math.min(roomType.getCoupleRowCount(), 1) : 0;
        int vipRows = (int) Math.round((totalRows - coupleRows) * roomType.getVipRowRatio());
        int standardRows = totalRows - coupleRows - vipRows;

        List<Seat> seats = new ArrayList<>();
        int seatsAssigned = 0; // so "cho ngoi" (dau nguoi) da dung, de dung dung o `total`

        for (int rowIdx = 0; rowIdx < totalRows && seatsAssigned < total; rowIdx++) {
            String rowLabel = String.valueOf((char) ('A' + rowIdx));
            SeatType type = rowIdx < standardRows
                    ? SeatType.STANDARD
                    : rowIdx < standardRows + vipRows
                        ? SeatType.VIP
                        : SeatType.COUPLE;

            int seatsRemaining = total - seatsAssigned;
            int physicalSeatsInRow = Math.min(seatsPerRow, seatsRemaining);

            // Hang Couple nhung khong du it nhat 1 cap ghe (vd hang cuoi bi cat ngan do
            // totalSeatCapacity khong chia het cho seatsPerRow) thi ha xuong Standard
            // thay vi bo trang hang.
            if (type.getColSpan() > 1 && physicalSeatsInRow < type.getColSpan()) {
                type = SeatType.STANDARD;
            }

            int colSpan = type.getColSpan();
            int unitsInRow = physicalSeatsInRow / colSpan;
            BigDecimal price = defaultPrice.multiply(BigDecimal.valueOf(type.getPriceMultiplier()));

            for (int col = 1; col <= unitsInRow; col++) {
                Seat seat = Seat.builder()
                        .seatCode(rowLabel + col)
                        .rowLabel(rowLabel)
                        .colNumber(col)
                        .seatType(type)
                        .status(SeatStatus.ACTIVE)
                        .price(price)
                        .cinemaRoom(room)
                        .build();
                seats.add(seat);
            }

            seatsAssigned += physicalSeatsInRow;
        }

        seatRepository.saveAll(seats);
        log.info("Generated {} seats ({} standard rows, {} VIP rows, {} couple rows) for room '{}'",
                seats.size(), standardRows, vipRows, coupleRows, room.getCinemaRoomName());
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
