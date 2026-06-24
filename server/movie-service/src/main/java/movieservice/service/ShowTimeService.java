package movieservice.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.stereotype.Service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.ShowTimeRequest;
import movieservice.entity.ShowTime;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.ShowTimeRepository;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ShowTimeService {
    ShowTimeRepository showTimeRepository;

    public void validateStartTimes(List<ShowTimeRequest> requests) {
        LocalTime openingTime = LocalTime.of(8, 0);
        LocalTime closingTime = LocalTime.of(23, 0);

        for (ShowTimeRequest stReq : requests) {
            LocalTime startTime = stReq.getStartTime();
            if (startTime.isBefore(openingTime) || startTime.isAfter(closingTime)) {
                throw new AppException(MovieErrorCode.INVALID_SHOWTIME);
            }

        }
    }

    public void validateLocalRequests(List<ShowTimeRequest> requests,
            int duration) {
        for (int i = 0; i < requests.size(); i++) {
            ShowTimeRequest current = requests.get(i);
            LocalTime currentStart = current.getStartTime();
            LocalTime currentEnd = currentStart.plusMinutes(duration);

            for (int j = i + 1; j < requests.size(); j++) {
                ShowTimeRequest next = requests.get(j);

                if (current.getCinemaRoomId().equals(next.getCinemaRoomId())
                        && current.getShowDate().equals(next.getShowDate())) {

                    LocalTime nextStart = next.getStartTime();
                    LocalTime nextEnd = nextStart.plusMinutes(duration);

                    if (currentStart.isBefore(nextEnd) && currentEnd.isAfter(nextStart)) {
                        throw new AppException(MovieErrorCode.SHOWTIME_CONFLICT_IN_REQUEST);
                    }
                }
            }
        }
    }

    public void validateShowDates(List<ShowTimeRequest> requests) {
        LocalDate minAllowedDate = LocalDate.now().plusDays(3);

        for (ShowTimeRequest stReq : requests) {
            if (stReq.getShowDate().isBefore(minAllowedDate)) {
                throw new AppException(MovieErrorCode.INVALID_SHOWDATE);
            }
        }
    }

    public void validateWithDatabase(List<ShowTimeRequest> requests, int duration) {
        for (ShowTimeRequest stReq : requests) {

            LocalTime startTime = stReq.getStartTime();
            LocalTime endTime = startTime.plusMinutes(duration);

            boolean isOverlapped = showTimeRepository.existsByCinemaRoomAndOverlappingTime(
                    stReq.getCinemaRoomId(),
                    stReq.getShowDate(),
                    startTime,
                    endTime);

            if (isOverlapped) {
                throw new AppException(MovieErrorCode.SHOWTIME_CONFLICT_IN_DATABASE);
            }
        }
    }
    public Boolean existsMovie(Long movieId, LocalDate currentDate, LocalTime currentTime) {
        return showTimeRepository.existsByMovieMovieIdAndFutureShowTime(movieId, currentDate, currentTime);
    }

    public List<ShowTime> saveSchedule(List<ShowTime> showTimes) {
        return showTimeRepository.saveAll(showTimes);
    }
}
