package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

/** A checker action over several independently versioned release plans. */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BulkReleasePlanDecisionRequest {

    @NotNull
    Decision decision;

    @NotEmpty
    @Size(max = 100)
    List<@Valid PlanVersion> plans;

    @Size(max = 500)
    String note;

    public enum Decision {
        APPROVE
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PlanVersion {
        @NotNull
        Long availabilityId;

        @NotNull
        @PositiveOrZero
        Long expectedVersion;
    }
}
