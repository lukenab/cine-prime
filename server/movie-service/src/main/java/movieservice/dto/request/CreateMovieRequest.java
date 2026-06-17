package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.List;

@Data
public class CreateMovieRequest {

    @NotBlank(message = "Vietnamese movie name cannot be blank")
    @Size(max = 255, message = "Vietnamese movie name must not exceed 255 characters")
    private String movieNameVn;

    @NotBlank(message = "English movie name cannot be blank")
    @Size(max = 255, message = "English movie name must not exceed 255 characters")
    private String movieNameEnglish;

    @NotBlank(message = "Director cannot be blank")
    private String director;

    @NotBlank(message = "Actors cannot be blank")
    private String actor;

    @NotNull(message = "Duration cannot be null")
    private Integer duration;

    @NotBlank(message = "Content cannot be blank")
    private String content;

    @NotBlank(message = "Version cannot be blank")
    private String version;

    @NotNull(message = "Status cannot be null")
    private Boolean status;

    @NotBlank(message = "Movie production company cannot be blank")
    private String movieProductionCompany;

    @NotBlank(message = "Large image URL must not be blank")
    private String largeImage;

    @NotBlank(message = "Small image URL must not be blank")
    private String smallImage;

    @NotEmpty(message = "At least one type ID must be selected")
    private List<Long> typeIds;

    @Valid
    @NotEmpty(message = "Show times list must not be empty")
    private List<ShowTimeRequest> showTimes;
}