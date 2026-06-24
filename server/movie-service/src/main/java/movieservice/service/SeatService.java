package movieservice.service;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import movieservice.dto.request.SeatRequest;
import movieservice.entity.Seat;
import movieservice.mapper.MovieMapper;
import movieservice.repository.SeatRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class SeatService {
    SeatRepository seatRepository;
    MovieMapper movieMapper;

    // public void generateSeatsForRoom(SeatRequest seatRequest) {
    //     Seat seat = movieMapper.toSeat(seatRequest);
    //     int seatsPerRow = 10;
    //     for (int i = 0; i < quantity; i++) {
    //         char row = (char) ('A' + (i / seatsPerRow));
    //         int col = (i % seatsPerRow) + 1;
    //         String seatCode = row + String.valueOf(col);
    //         Seat seat = new Seat();
    //         seat.setSeatCode(seatCode);
    //         seat.setCinemaRoom(cinemaRoom);
    //         // seat.setPrice(100000.0);
    //         // seat.setSeatStatus("AVAILABLE");
    //         seat.setSeatType("STANDARD");
    //         seatRepository.save(seat);
    //     }
    // }
}
