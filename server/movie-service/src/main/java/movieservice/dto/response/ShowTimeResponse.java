package movieservice.dto.response;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowTimeResponse {

    Long showTimeId;

    LocalDate showDate;

    LocalTime startTime;

    LocalTime endTime;

    OffsetDateTime startAt;

    OffsetDateTime endAt;

    Long movieId;

    String movieName;

    String moviePosterUrl;

    Long cinemaRoomId;

    String cinemaRoomName;

    // Cho phep customer loc suat chieu theo cum rap (ShowtimePage.tsx) — trươc day
    // response khong co field nao de biet suat chieu thuoc cum rap nao.
    Long clusterId;

    String clusterName;

    String status;

    String formatCode;

    String source;

    Long screeningVersionId;

    String audioLanguageCode;

    String subtitleLanguageCode;

    // = CinemaRoom.totalSeatCapacity tai thoi diem tao suat (snapshot, khong doi theo
    // sua doi phong sau nay) va availableSeats = totalSeats - soldSeats.
    Integer totalSeats;

    Integer soldSeats;

    Integer availableSeats;

    String cancellationReason;

    // Gia ve thap nhat cua phong (MIN(seat.price) trong cac ghe ACTIVE) — dung de hien
    // thi "tu X d" o danh sach suat chieu; gia chi tiet tung ghe van lay o trang dat ve.
    BigDecimal price;

    /**
     * Standard-seat base price configured for this showtime. Final prices are
     * snapped per sellable seat unit in showtime_seat.
     */
    BigDecimal basePrice;

    LocalDateTime updatedAt;
}
