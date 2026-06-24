package movieservice.dto.response;

import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.List;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieResponse {

    Long movieId;

    String actor;

    String content;

    String director;

    Integer duration;

    String movieProductionCompany;

    String version;

    String movieNameEnglish;

    String movieNameVn;

    String largeImage;

    String smallImage;

    Boolean status;

    List<String> movieType;

    List<ShowTimeResponse> showTimes;

    LocalDateTime createAt;
}