package movieservice.exception;

import lombok.Getter;
import movieservice.dto.response.AutoShowtimeIneligibleMovie;

import java.util.List;

/// Exception riÃªng Ä‘á»ƒ response preflight cÃ³ thá»ƒ tráº£ danh sÃ¡ch movie thiáº¿u candidate,
/// trong khi AppException chung chá»‰ há»— trá»£ code vÃ  message cá»‘ Ä‘á»‹nh.
@Getter
public class AutoShowtimePreflightException extends RuntimeException {

    private final MovieErrorCode errorCode;
    private final List<AutoShowtimeIneligibleMovie> ineligibleMovies;

    public AutoShowtimePreflightException(
            MovieErrorCode errorCode,
            List<AutoShowtimeIneligibleMovie> ineligibleMovies
    ) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.ineligibleMovies = ineligibleMovies;
    }
}
