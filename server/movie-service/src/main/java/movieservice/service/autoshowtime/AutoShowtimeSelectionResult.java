package movieservice.service.autoshowtime;

import java.util.List;

/// Kết quả của bước allocation: candidate được chọn và candidate bị loại có audit reason.
public record AutoShowtimeSelectionResult(
        List<ShowtimeCandidate> selectedCandidates,
        List<AutoShowtimeCandidateRejection> rejectedCandidates
) {

    public AutoShowtimeSelectionResult {
        /// Không cho caller sửa trực tiếp kết quả selection sau khi selector đã tính quota.
        selectedCandidates = List.copyOf(selectedCandidates);
        rejectedCandidates = List.copyOf(rejectedCandidates);
    }
}
