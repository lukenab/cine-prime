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

    DUPLICATE_TRANSLATION_LANGUAGE(2034,
            "Duplicate languageCode found in translations request.",
            HttpStatus.BAD_REQUEST),

    DUPLICATE_CAST_ENTRY(2035,
            "Duplicate (personId, roleType) combination found in cast request.",
            HttpStatus.BAD_REQUEST),

    BULK_SHOWTIME_REQUEST_TOO_LARGE(2037,
            "Bulk showtime request exceeds the allowed date range or candidate limit.",
            HttpStatus.BAD_REQUEST),

    MISSING_RUNTIME(2038,
            "TMDB did not provide a runtime for this movie. Provide confirmedRuntimeMinutes to import.",
            HttpStatus.BAD_REQUEST),

    UNRESOLVED_GENRE_MAPPING(2039,
            "One or more TMDB genres are unmapped. Map, create as pending review, or ignore them before importing.",
            HttpStatus.BAD_REQUEST),

    GENRE_PENDING_REVIEW(2040,
            "Cannot submit for review while the movie has a genre still PENDING_REVIEW.",
            HttpStatus.BAD_REQUEST),

    INVALID_MOVIE_DATE_RANGE(2036,
            "releaseDate must be on or before endDate.",
            HttpStatus.BAD_REQUEST),

    MOVIE_NOT_READY_FOR_REVIEW(2041, "Movie is not ready for review.", HttpStatus.BAD_REQUEST),
    MOVIE_NOT_READY_FOR_APPROVAL(2042, "Movie is not ready for approval.", HttpStatus.BAD_REQUEST),
    MOVIE_NOT_READY_FOR_RELEASE(2043, "Movie is not ready for release.", HttpStatus.BAD_REQUEST),

    // ── Cinema Room creation wizard / seat layout versioning ────────────────

    ROOM_LAYOUT_NOT_FOUND(2044, "Room layout version not found.", HttpStatus.NOT_FOUND),
    ROOM_LAYOUT_INVALID_TRANSITION(2045,
            "Invalid layout status transition. Check the layout's current status and use the correct workflow endpoint.",
            HttpStatus.BAD_REQUEST),
    ROOM_LAYOUT_NOT_EDITABLE(2046,
            "Only a DRAFT layout can be edited. Clone this version to create a new editable draft.",
            HttpStatus.BAD_REQUEST),
    ROOM_LAYOUT_POSITION_DUPLICATE_COORDINATE(2047,
            "Two or more positions share the same row/column coordinate.", HttpStatus.BAD_REQUEST),
    ROOM_LAYOUT_POSITION_DUPLICATE_SEAT_CODE(2048,
            "Two or more seat positions share the same seat code.", HttpStatus.BAD_REQUEST),
    ROOM_LAYOUT_COUPLE_GROUP_INVALID(2049,
            "Each Couple group must contain exactly two adjacent seat positions in the same row.",
            HttpStatus.BAD_REQUEST),
    ROOM_LAYOUT_EMPTY(2050, "Cannot submit a layout with no positions.", HttpStatus.BAD_REQUEST),
    ROOM_LAYOUT_HAS_FUTURE_SHOWTIMES(2051,
            "Cannot activate this layout version: the room has upcoming scheduled/on-sale showtimes on the current active layout.",
            HttpStatus.CONFLICT),
    ROOM_SCREEN_EXCEEDS_ROOM_DIMENSIONS(2052,
            "Screen width/height cannot exceed the room's width/clear height.", HttpStatus.BAD_REQUEST),
    AUDITORIUM_CLASS_NOT_FOUND(2053, "Auditorium class not found or inactive.", HttpStatus.NOT_FOUND),
    PROJECTION_TECHNOLOGY_NOT_FOUND(2054, "Projection technology not found or inactive.", HttpStatus.NOT_FOUND),
    RESOLUTION_NOT_FOUND(2055, "Resolution not found or inactive.", HttpStatus.NOT_FOUND),
    AUDIO_FORMAT_NOT_FOUND(2056, "Audio format not found or inactive.", HttpStatus.NOT_FOUND),
    ROOM_INVALID_TRANSITION(2057,
            "Invalid room status transition. Check the room's current status and use the correct workflow endpoint.",
            HttpStatus.BAD_REQUEST),
    ROOM_CODE_ALREADY_EXISTS(2058, "Room code already exists in this cluster!!!", HttpStatus.CONFLICT),
    ROOM_NOT_DRAFT(2059,
            "Room details can only be edited while the room is DRAFT.", HttpStatus.BAD_REQUEST),
    ROOM_LAYOUT_POSITION_FIELDS_INVALID(2060,
            "AISLE/EXIT/EMPTY_SPACE positions must not carry seat fields; SEAT positions must.",
            HttpStatus.BAD_REQUEST),
    ROOM_CODE_REQUIRED(2061, "Room code is required when creating a room through the wizard.",
            HttpStatus.BAD_REQUEST),
    ROOM_DIMENSION_INVALID(2062, "Room length/width/clear height must be greater than 0.",
            HttpStatus.BAD_REQUEST),
    ROOM_LAYOUT_EXCEEDS_ROOM_ENVELOPE(2063,
            "The seat layout exceeds the room capacity envelope derived from area, volume, seat width, row pitch, or screen clearance.",
            HttpStatus.BAD_REQUEST),
    ROOM_PRESENTATION_FORMAT_REQUIRED(2064,
            "At least one presentation format (2D or 3D) must be supported.",
            HttpStatus.BAD_REQUEST),
    CLUSTER_CODE_EXISTED(2065, "Cluster code already exists.", HttpStatus.CONFLICT),
    CLUSTER_CODE_IMMUTABLE(2066, "Cluster code cannot be changed after the cluster leaves DRAFT.", HttpStatus.BAD_REQUEST),
    CLUSTER_OPERATING_HOURS_INVALID(2067,
            "Operating hours must contain each day exactly once and use valid local times.", HttpStatus.BAD_REQUEST),
    CLUSTER_TIMEZONE_INVALID(2068, "Timezone must be a valid IANA timezone identifier.", HttpStatus.BAD_REQUEST),

    // ── Movie content/exhibition lifecycle separation (MOV-LC-04/06) ────────

    MOVIE_NOT_EDITABLE(2069,
            "Only a DRAFT movie can be edited directly. Start a revision first if changes were requested.",
            HttpStatus.CONFLICT),
    MOVIE_HAS_ACTIVE_AVAILABILITY(2071,
            "Cannot archive a movie that still has a PLANNED or OPEN availability window. Close them first.",
            HttpStatus.CONFLICT),

    AVAILABILITY_NOT_FOUND(2072, "Movie availability not found.", HttpStatus.NOT_FOUND),
    AVAILABILITY_INVALID_TRANSITION(2073,
            "Invalid availability status transition. Check the current status and use the correct command.",
            HttpStatus.CONFLICT),
    AVAILABILITY_MOVIE_NOT_APPROVED(2075,
            "An availability window can only be created for a movie whose content status is APPROVED.",
            HttpStatus.CONFLICT),
    AVAILABILITY_CLUSTER_NOT_ACTIVE(2076,
            "Cannot create an availability window at a cluster that is not ACTIVE.", HttpStatus.BAD_REQUEST),
    AVAILABILITY_DATE_RANGE_INVALID(2077,
            "showingEndDate must be on or after showingStartDate.", HttpStatus.BAD_REQUEST),
    AVAILABILITY_WINDOW_ALREADY_EXISTS(2078,
            "An availability window for this movie, cluster and showingStartDate already exists.",
            HttpStatus.CONFLICT),
    AVAILABILITY_NOT_EDITABLE(2079,
            "Only a PLANNED availability window can be edited directly.", HttpStatus.CONFLICT),

    CLUSTER_SELF_APPROVAL_FORBIDDEN(2080,
            "You cannot approve or reject a cluster you created yourself. Another admin must review it.",
            HttpStatus.FORBIDDEN),
    CLUSTER_NOT_OWNER(2081,
            "Only the cluster's creator or an admin can submit it for review.", HttpStatus.FORBIDDEN);

    int code;
    String message;
    HttpStatusCode statusCode;
}
