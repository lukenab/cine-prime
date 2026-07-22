package movieservice.service.autoshowtime;

import java.util.List;

public record SchedulingEligibilityResult(boolean eligible, List<String> reasonCodes) {
    public static SchedulingEligibilityResult allowed() {
        return new SchedulingEligibilityResult(true, List.of());
    }

    public static SchedulingEligibilityResult denied(List<String> reasonCodes) {
        return new SchedulingEligibilityResult(false, List.copyOf(reasonCodes));
    }
}
