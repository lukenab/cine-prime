package movieservice.service.autoshowtime;

import movieservice.enums.GenerationSkipReason;

/// Lưu lý do candidate không được chọn để bước sau persist vào showtime_generation_skip.
public record AutoShowtimeCandidateRejection(
        ShowtimeCandidate candidate,
        GenerationSkipReason reason,
        String detail
) {
}
