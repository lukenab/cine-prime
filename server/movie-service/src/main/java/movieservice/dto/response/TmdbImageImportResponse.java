package movieservice.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class TmdbImageImportResponse {
    int importedCount;
    int skippedDuplicateCount;
    List<MovieImageResponse> images;
    List<String> warnings;
}
