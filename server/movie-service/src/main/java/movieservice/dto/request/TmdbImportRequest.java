package movieservice.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;

@Getter
public class TmdbImportRequest {

    @NotNull(message = "tmdbId is required")
    Integer tmdbId;
}
