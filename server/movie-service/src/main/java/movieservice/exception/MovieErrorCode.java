package movieservice.exception;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.experimental.FieldDefaults;
import movie.theater.common.exception.BaseErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@AllArgsConstructor
public enum MovieErrorCode implements BaseErrorCode {

        MOVIE_TYPE_NOT_FOUND(2001, "Movie genre not found with the provided ID.", HttpStatus.NOT_FOUND),
        MOVIE_NOT_FOUND(2002, "Movie not found.", HttpStatus.NOT_FOUND),

        CINEMA_ROOM_NOT_FOUND(2003, "Cinema room does not exist.", HttpStatus.NOT_FOUND),
        CINEMA_ROOM_NAME_EXISTED(2004, "Room name already exists!!!", HttpStatus.CONFLICT),

        MOVIE_TYPE_NAME_EXISTED(2005, "Movie type name already exists!!!", HttpStatus.CONFLICT),

        INVALID_SHOWTIME(2006,
                        "Invalid showtime! The cinema only operates from 8:00 AM to 11:00 PM",
                        HttpStatus.BAD_REQUEST),

        SHOWTIME_CONFLICT_IN_REQUEST(2007,
                        "Conflict: A movie schedule already exists in this room",
                        HttpStatus.CONFLICT),

        INVALID_SHOWDATE(2008,
                        "Invalid showdate! Showtimes must be scheduled at least 3 days in advance from today.",
                        HttpStatus.BAD_REQUEST),

        SHOWTIME_CONFLICT_IN_DATABASE(2009,
                        "The room has been booked for another showtime.",
                        HttpStatus.CONFLICT),
        UPLOAD_IMAGE_FAILED(5001, "Failed to upload image to Cloudinary", HttpStatus.INTERNAL_SERVER_ERROR),
        INVALID_IMAGE_FILE(5002, "Invalid image file. Please upload a JPG, PNG, or WebP image up to 5MB.",
                        HttpStatus.BAD_REQUEST),

        INTERNAL_SERVER_ERROR(5000,
                        "Internal server error",
                        HttpStatus.INTERNAL_SERVER_ERROR),


    GENRE_NOT_FOUND(2010, "Movie genre not found.", HttpStatus.NOT_FOUND),
    ACTIVE_SHOWTIMES_EXIST(2011, "Cannot delete movie because it still has upcoming showtimes.", HttpStatus.CONFLICT),

    SEAT_NOT_FOUND(2012, "Seat not found.", HttpStatus.NOT_FOUND),

    SEAT_QUANTITY_EXCEEDS_LIMIT(2013,
            "Seat quantity exceeds the maximum allowed for this room type.",
            HttpStatus.BAD_REQUEST);

    int code;
    String message;
    HttpStatusCode statusCode;
}
