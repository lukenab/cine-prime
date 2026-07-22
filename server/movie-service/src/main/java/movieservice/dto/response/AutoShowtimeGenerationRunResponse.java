package movieservice.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;

/// DTO cho API GET generation run: vừa cho client poll trạng thái, vừa trả danh sách kết quả đã persist.
public record AutoShowtimeGenerationRunResponse(
        Long generationRunId,
        String status,
        LocalDate startDate,
        LocalDate endDate,
        Summary summary,
        List<MovieResult> movieResults,
        ShowtimePage showtimes,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        String failureDetail
) {

    /// Tóm tắt toàn bộ candidate của run để UI/QA nhìn nhanh kết quả allocation.
    public record Summary(
            Integer candidateCount,
            Integer createdCount,
            Integer skippedCount
    ) {
    }

    /// Thống kê candidate theo từng phim trong scope của run.
    public record MovieResult(
            Long movieId,
            String movieTitle,
            String demandTier,
            Integer candidateCount,
            Integer createdCount,
            Integer skippedCount
    ) {
    }

    /// Kết quả ShowTime đã được tạo thật trong DB; không bao gồm candidate bị skip.
    public record GeneratedShowtime(
            Long showtimeId,
            Long movieId,
            String movieTitle,
            Long cinemaClusterId,
            Long cinemaRoomId,
            String cinemaRoomName,
            Integer formatId,
            String formatName,
            LocalDate showDate,
            LocalTime startTime,
            LocalTime endTime,
            OffsetDateTime startAt,
            OffsetDateTime endAt,
            String status,
            String generationReason
    ) {
    }

    /// Phân trang danh sách showtime để một run lớn không trả payload quá nặng.
    public record ShowtimePage(
            List<GeneratedShowtime> items,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
    }

}
