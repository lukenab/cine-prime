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
import movieservice.util.SeatLayoutUtil;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class SeatService {

    SeatRepository seatRepository;
    MovieMapper movieMapper;

    // Gioi han an toan cho so hang/phong - khong gan lien voi 26 chu cai nua vi rowLabel()
    // ben duoi da ho tro nhan hang kieu Excel (A..Z, AA, AB...) khi vuot qua Z. Day chi la
    // "khoa an toan" chan cau hinh phi thuc te. Package-private (khong private) de
    // CinemaRoomService dung lai cung 1 gioi han khi validate truoc luc luu phong.
    static final int MAX_ROWS = 50;

    @Transactional
    public void generateSeatsForRoom(CinemaRoom room, BigDecimal defaultPrice) {
        // numberOfRows/seatsPerRow do admin chon (xem CinemaRoomRequest), khong con suy ra
        // tu RoomType.seatsPerRow co dinh nua — RoomType chi con la nguon gia tri mac dinh
        // goi y + gioi han maxSeats o tang validate (CinemaRoomService).
        int seatsPerRow = room.getSeatsPerRow();
        int totalRows = room.getNumberOfRows();
        int total = room.getTotalSeatCapacity();

        if (totalRows > MAX_ROWS) {
            throw new AppException(MovieErrorCode.SEAT_ROW_LIMIT_EXCEEDED);
        }

        // Phan bo zone do admin cau hinh theo tung phong; RoomType khong con quyet dinh
        // ty le hay so hang Standard/VIP/Couple.
        int standardRows = room.getStandardRowCount();
        int vipRows = room.getVipRowCount();
        int coupleRows = room.getCoupleRowCount();

        // Ghe accessible (wheelchair): ~1% capacity, toi thieu 2 — dat tren hang KHONG phai
        // Couple (ghe doi colSpan=2 khong hop cho xe lan) gan nhat voi vung Couple/cuoi phong,
        // sat 2 loi di trai/phai de de tiep can nhat.
        int accessibleTarget = Math.max(2, Math.round(total * 0.01f));
        int accessibleRowIdx = coupleRows > 0 ? (standardRows + vipRows - 1) : (totalRows - 1);

        List<Seat> seats = new ArrayList<>();
        int seatsAssigned = 0; // so "cho ngoi" (dau nguoi) da dung, de dung dung o `total`

        for (int rowIdx = 0; rowIdx < totalRows && seatsAssigned < total; rowIdx++) {
            String rowLabel = rowLabel(rowIdx);
            SeatType rowType = rowIdx < standardRows
                    ? SeatType.STANDARD
                    : rowIdx < standardRows + vipRows
                        ? SeatType.VIP
                        : SeatType.COUPLE;

            int seatsRemaining = total - seatsAssigned;
            int physicalSeatsInRow = Math.min(seatsPerRow, seatsRemaining);

            // Hang Couple nhung khong du it nhat 1 cap ghe (vd hang cuoi bi cat ngan do
            // totalSeatCapacity khong chia het cho seatsPerRow) thi ha xuong Standard
            // thay vi bo trang hang.
            if (rowType.getColSpan() > 1 && physicalSeatsInRow < rowType.getColSpan()) {
                rowType = SeatType.STANDARD;
            }

            int colSpan = rowType.getColSpan();
            int unitsInRow = physicalSeatsInRow / colSpan;

            Set<Integer> accessibleUnits = (rowIdx == accessibleRowIdx && colSpan == 1)
                    ? pickAccessibleUnits(unitsInRow, accessibleTarget)
                    : Set.of();

            for (int col = 1; col <= unitsInRow; col++) {
                SeatType type = accessibleUnits.contains(col) ? SeatType.ACCESSIBLE : rowType;
                BigDecimal price = defaultPrice.multiply(BigDecimal.valueOf(type.getPriceMultiplier()));
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

    /**
     * Nhan hang kieu Excel: 0->A, 1->B, ..., 25->Z, 26->AA, 27->AB, ... Khong gioi han o 26
     * chu cai nhu (char)('A'+index) truoc day (se sinh ky tu la sau Z, sai/khong doc duoc).
     */
    private static String rowLabel(int index) {
        StringBuilder sb = new StringBuilder();
        int n = index;
        do {
            sb.insert(0, (char) ('A' + (n % 26)));
            n = n / 26 - 1;
        } while (n >= 0);
        return sb.toString();
    }

    /** Uu tien vi tri sat 2 loi di (trai/phai); neu can nhieu hon 2 ghe thi lay them cot ke ben. */
    private static Set<Integer> pickAccessibleUnits(int unitsInRow, int accessibleTarget) {
        int[] boundaries = SeatLayoutUtil.aisleBoundaryUnits(unitsInRow);
        Set<Integer> picked = new LinkedHashSet<>();
        for (int boundary : boundaries) {
            if (picked.size() >= accessibleTarget) break;
            picked.add(boundary);
        }
        for (int offset = 1; picked.size() < accessibleTarget && offset < unitsInRow; offset++) {
            for (int boundary : boundaries) {
                if (picked.size() >= accessibleTarget) break;
                int candidate = boundary - offset;
                if (candidate >= 1 && candidate <= unitsInRow) {
                    picked.add(candidate);
                }
            }
        }
        return picked;
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

    /**
     * Xoa toan bo ghe cua 1 phong - dung khi xoa cung phong chua tung co showtime nao
     * (xem CinemaRoomService.deleteCinemaRoom()).
     */
    @Transactional
    public void deleteSeatsByRoom(Long roomId) {
        seatRepository.deleteByCinemaRoomCinemaRoomId(roomId);
    }
}
