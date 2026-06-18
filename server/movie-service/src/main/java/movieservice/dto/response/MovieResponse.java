package movieservice.dto.response;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class MovieResponse {

    private Long movieId;

    private String actor;

    private String content;

    private String director;

    private Integer duration;

    private String movieProductionCompany;

    private String version;

    private String movieNameEnglish;

    private String movieNameVn;

    private String largeImage;

    private String smallImage;

    private Boolean status;

    private List<String> movieType;

    private List<ShowTimeResponse> showTimes;

    private LocalDateTime createAt;
}