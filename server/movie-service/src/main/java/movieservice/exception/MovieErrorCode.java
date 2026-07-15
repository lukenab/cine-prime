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
    INVALID_SEAT_STATUS(4001, "Invalid seat status", HttpStatus.BAD_REQUEST),

    SEAT_QUANTITY_EXCEEDS_LIMIT(2013,
            "Seat quantity exceeds the maximum allowed for this room type.",
            HttpStatus.BAD_REQUEST),

    MOVIE_ALREADY_EXISTS(2014, "A movie with this Vietnamese title and format already exists.", HttpStatus.CONFLICT),

    SHOWTIME_NOT_FOUND(2015, "Showtime not found.", HttpStatus.NOT_FOUND),

    AGE_RATING_NOT_FOUND(2016, "Age rating not found.", HttpStatus.NOT_FOUND),
    COMPANY_NOT_FOUND(2017, "Production company not found.", HttpStatus.NOT_FOUND),
    FORMAT_NOT_FOUND(2018, "Screening format not found.", HttpStatus.NOT_FOUND),
    PERSON_NOT_FOUND(2019, "Person (cast member) not found.", HttpStatus.NOT_FOUND),
    INVALID_STATUS_TRANSITION(2020, "This status transition is not allowed.", HttpStatus.BAD_REQUEST),
    TMDB_MOVIE_ALREADY_EXISTS(2021, "This TMDB movie has already been imported.", HttpStatus.CONFLICT),
    TMDB_API_ERROR(2022, "Failed to connect to TMDB API. Check your API key or network.", HttpStatus.BAD_GATEWAY),

    CLUSTER_NOT_FOUND(2023, "Cinema cluster not found.", HttpStatus.NOT_FOUND),
    CLUSTER_HAS_ROOMS(2024, "Cannot delete cluster that still has cinema rooms.", HttpStatus.CONFLICT),
    INVALID_CLUSTER_STATUS(2025, "Invalid status. Accepted values: DRAFT, PENDING_REVIEW, ACTIVE, INACTIVE", HttpStatus.BAD_REQUEST),
    CLUSTER_INVALID_TRANSITION(2026, "Invalid status transition. Check the cluster's current status and use the correct workflow endpoint.", HttpStatus.BAD_REQUEST),
    CLUSTER_NAME_EXISTED(2027, "Cluster name already exists!!!", HttpStatus.CONFLICT),

    CINEMA_ROOM_HAS_SHOWTIMES(2028, "Cannot delete cinema room that still has showtimes.", HttpStatus.CONFLICT),
    CLUSTER_NOT_ACTIVE(2029, "Cannot create a room in a cluster that is not ACTIVE.", HttpStatus.BAD_REQUEST),

    SEAT_ROW_LIMIT_EXCEEDED(2030,
            "Seat quantity for this room type produces too many rows to lay out safely.",
            HttpStatus.BAD_REQUEST),

    SEAT_QUANTITY_TOO_SMALL(2031,
            "numberOfRows x seatsPerRow is below the minimum room capacity (10).",
            HttpStatus.BAD_REQUEST),

    SEAT_ROW_ALLOCATION_INVALID(2032,
            "standardRowCount + vipRowCount + coupleRowCount must equal numberOfRows, with at least one Standard or VIP row.",
            HttpStatus.BAD_REQUEST),

    COUPLE_ROW_REQUIRES_EVEN_SEATS(2033,
            "seatsPerRow must be even when the room contains Couple rows.",
            HttpStatus.BAD_REQUEST);

    int code;
    String message;
    HttpStatusCode statusCode;
}
