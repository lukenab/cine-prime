package movieservice.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.response.ShowtimeSeatDto;
import movieservice.entity.Seat;
import movieservice.entity.ShowTime;
import movieservice.entity.ShowtimeSeat;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeSeatRepository;
import movieservice.repository.SeatRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShowTimeService {
    private final ShowTimeRepository showTimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final SeatRepository seatRepository;

    @Transactional
    public List<ShowtimeSeatDto> getSeatsByShowtime(Long showtimeId) {
        ShowTime showTime = showTimeRepository.findById(showtimeId)
                .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND)); // Or a better error code

        List<ShowtimeSeat> seats = showtimeSeatRepository.findByShowTime_ShowTimeId(showtimeId);
        
        // Lazy initialize seats for this showtime if they don't exist
        if (seats.isEmpty()) {
            List<Seat> roomSeats = showTime.getCinemaRoom().getSeats();
            if (roomSeats == null || roomSeats.isEmpty()) {
                // If the room has no seats, return empty list
                return List.of();
            }

            seats = roomSeats.stream().map(seat -> {
                ShowtimeSeat showtimeSeat = new ShowtimeSeat();
                showtimeSeat.setShowTime(showTime);
                showtimeSeat.setSeat(seat);
                showtimeSeat.setSeatCode(seat.getSeatCode());
                showtimeSeat.setSeatType(seat.getSeatType() != null ? seat.getSeatType() : "STANDARD");
                showtimeSeat.setPrice(seat.getPrice() != null ? seat.getPrice() : new java.math.BigDecimal("100000.00"));
                showtimeSeat.setStatus(ShowtimeSeat.SeatStatus.AVAILABLE);
                return showtimeSeat;
            }).collect(Collectors.toList());
            
            showtimeSeatRepository.saveAll(seats);
        }

        return seats.stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public void lockSeats(Long showtimeId, List<Long> seatIds) {
        // Find seats
        for (Long seatId : seatIds) {
            ShowtimeSeat seat = showtimeSeatRepository.findById(seatId)
                    .orElseThrow(() -> new RuntimeException("Seat not found"));
            
            if (seat.getStatus() != ShowtimeSeat.SeatStatus.AVAILABLE) {
                // Check if reserved lock has expired
                if (seat.getStatus() == ShowtimeSeat.SeatStatus.RESERVED && seat.getReservedExpiresAt() != null && seat.getReservedExpiresAt().isBefore(LocalDateTime.now())) {
                    // Lock expired, we can proceed
                } else {
                    throw new RuntimeException("Seat is not available"); // Ideal: specialized exception
                }
            }
            
            seat.setStatus(ShowtimeSeat.SeatStatus.RESERVED);
            seat.setReservedAt(LocalDateTime.now());
            seat.setReservedExpiresAt(LocalDateTime.now().plusMinutes(15));
            showtimeSeatRepository.save(seat);
        }
    }

    private ShowtimeSeatDto toDto(ShowtimeSeat seat) {
        String status = "AVAILABLE";
        if (seat.getStatus() == ShowtimeSeat.SeatStatus.SOLD) {
            status = "BOOKED";
        } else if (seat.getStatus() == ShowtimeSeat.SeatStatus.RESERVED) {
            if (seat.getReservedExpiresAt() != null && seat.getReservedExpiresAt().isBefore(LocalDateTime.now())) {
                status = "AVAILABLE"; // lock expired
            } else {
                status = "LOCKED";
            }
        }

        String row = "";
        Integer number = 0;
        
        // Parse seatCode (e.g. A1, A2)
        if (seat.getSeatCode() != null) {
            Pattern pattern = Pattern.compile("([A-Za-z]+)(\\d+)");
            Matcher matcher = pattern.matcher(seat.getSeatCode());
            if (matcher.matches()) {
                row = matcher.group(1).toUpperCase();
                number = Integer.parseInt(matcher.group(2));
            } else {
                row = seat.getSeatCode();
            }
        }

        return ShowtimeSeatDto.builder()
                .seatId(seat.getShowtimeSeatId())
                .row(row)
                .number(number)
                .type(seat.getSeatType())
                .status(status)
                .price(seat.getPrice())
                .build();
    }
}
