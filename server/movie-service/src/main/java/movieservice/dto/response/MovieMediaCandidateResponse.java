package movieservice.dto.response;

import lombok.Builder;
import lombok.Getter;

/** One TMDB image candidate, normalized for the frontend to preview/select from. */
@Getter
@Builder
public class MovieMediaCandidateResponse {
    String filePath;
    String url;
    Integer width;
    Integer height;
    Double aspectRatio;
    String languageCode;
    Double voteAverage;
    boolean recommended;
}
