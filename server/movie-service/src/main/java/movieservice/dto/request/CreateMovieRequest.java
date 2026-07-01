package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CreateMovieRequest {

    @NotBlank(message = "Vietnamese movie name cannot be blank")
    @Size(max = 255, message = "Vietnamese movie name must not exceed 255 characters")
    String movieNameVn;

    @NotBlank(message = "English movie name cannot be blank")
    @Size(max = 255, message = "English movie name must not exceed 255 characters")
    String movieNameEnglish;

    @NotBlank(message = "Director cannot be blank")
    String director;

    @NotBlank(message = "Actors cannot be blank")
    String actor;

    @NotNull(message = "Duration cannot be null")
    Integer duration;

    @NotBlank(message = "Content cannot be blank")
    String content;

    @NotBlank(message = "Version cannot be blank")
    String version;

    @NotNull(message = "Status cannot be null")
    Boolean status;

    @NotBlank(message = "Movie production company cannot be blank")
    String movieProductionCompany;

    @NotBlank(message = "Large image URL must not be blank")
    String largeImage;

    @NotBlank(message = "Small image URL must not be blank")
    String smallImage;

    @NotEmpty(message = "At least one type ID must be selected")
    List<Long> typeIds;

    // Optional: showtimes are scheduled separately via Showtime Management.
    @Valid
    List<ShowTimeRequest> showTimes;
}