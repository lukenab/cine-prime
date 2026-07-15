package movieservice.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class TmdbImportResponse {
    Long movieId;
    Integer tmdbId;
    String originalTitle;
    String status;
    int importedCastCount;
    int importedCompanyCount;
    List<String> warnings;
}
