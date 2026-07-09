package movieservice.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class TmdbImportResponse {
    Long movieId;
    Integer tmdbId;
    String originalTitle;
    String status;
    int importedCastCount;
    int importedCompanyCount;
}
