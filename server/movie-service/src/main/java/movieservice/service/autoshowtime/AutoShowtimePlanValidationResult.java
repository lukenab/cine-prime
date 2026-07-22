package movieservice.service.autoshowtime;

import java.util.List;

public record AutoShowtimePlanValidationResult(List<String> blockers) {
    public AutoShowtimePlanValidationResult {
        blockers = List.copyOf(blockers);
    }

    public boolean valid() { return blockers.isEmpty(); }
    public String summary() { return String.join("\n", blockers); }
}
