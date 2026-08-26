package movieservice.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BulkReleasePlanDecisionResponse {
    String operationKey;
    List<MovieAvailabilityResponse> succeeded;
    List<Failure> failed;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Failure {
        Long availabilityId;
        int code;
        String reason;
    }
}
