package movieservice.dto.response;

import lombok.Builder;
import lombok.Getter;

/** A single unmet readiness rule, e.g. {field: "ageRating", rule: "REQUIRED_FOR_APPROVAL"}. */
@Getter
@Builder
public class ReadinessViolation {
    String field;
    String rule;
}
