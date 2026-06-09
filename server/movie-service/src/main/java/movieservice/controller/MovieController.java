package movieservice.controller;

import java.util.List;
import java.util.Map;

import org.apache.catalina.startup.ClassLoaderFactory.Repository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import movieservice.dto.InforMovie;
import movieservice.dto.ShowTimeDTO;
import movieservice.dto.ShowtimeLookupRequest;
import movieservice.entity.Movie;
import movieservice.entity.ShowTime;
import movieservice.service.MovieService;
import vn.edu.fpt.commonservice.model.ErrorMessage;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/movie")
public class MovieController {
    @Autowired
    private MovieService movieService;

    @PostMapping("/role-not-member/create")
    public ResponseEntity<?> postMethodName(@RequestBody Movie movie) {

        try {
            return movieService.createMovie(movie);
        } catch (Exception e) {
            return ResponseEntity
                    .ok(new ErrorMessage("409", "Lỗi dữ liệu không hợp lệ!!!!.",e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR));

        }
    }

    @GetMapping("/find/{id}")
    public ResponseEntity<?> getMethodName(@PathVariable("id") String idMovie) {
        return movieService.getMovie(idMovie, "VIEW_MOVIE");
    }

    @GetMapping("/role-employee/delete")
    public ResponseEntity<?> getDelete(@RequestParam("id") String idMovie) {
        return movieService.deleteMovieDB(idMovie);
    }

    @GetMapping("/role-employee/check-booking")
    public Boolean checkBookingValid(
            @RequestParam("movieId") Integer movieId,
            @RequestParam("roomId") Integer roomId,
            @RequestParam("showTimeId") Integer showTimeId) {

        if (movieService.checkBookingValid(movieId, roomId, showTimeId) == null) {
            return true;
        }
        return false;

    }

    @GetMapping("/role-employee/find/showtime")
    public ShowTimeDTO getMethodName(@RequestParam("movieId") Long id, @RequestParam("roomId") Long filmId,
            @RequestParam("showTimeId") Long timeId) {
        return movieService.findShowTime(filmId, id, timeId);
    }

    @PostMapping("/role-employee/find/showtime/by-lists")
    public List<ShowTimeDTO> getShowTimesByLists(@RequestBody ShowtimeLookupRequest request) {
        // Gọi sang service xử lý tìm kiếm hàng loạt
        return movieService.findShowTimesByLists(
                request.getRoomIds(),
                request.getMovieIds(),
                request.getShowTimeIds());
    }

    @GetMapping("/role-employee/find-all")
    public List<Movie> getMethodName() {
        return movieService.findAllMovie();
    }

    @GetMapping("/role-employee/count")
    public ResponseEntity<?> getMethodName(@RequestParam("month") String monthData,
            @RequestParam("year") String yearData) {
        return movieService.countMovie(monthData, yearData);
    }

    @PostMapping("/role-employee/names-by-ids")
    public Map<Integer, String> getMovieNamesByIds(@RequestBody List<Integer> movieIds) {
        // Giả sử hàm này vào DB tìm theo list ID và convert thành Map<Id, Name>
        return movieService.getMovieNamesMap(movieIds);
    }

    @PostMapping("/role-employee/edit")
    public ResponseEntity<?> postMethodNameee(@RequestBody Movie movie) {
        return movieService.update(movie);
    }

}
