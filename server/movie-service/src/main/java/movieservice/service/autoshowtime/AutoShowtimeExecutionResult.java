package movieservice.service.autoshowtime;

/// Summary được trả về sau một lần executor xử lý generation run.
public record AutoShowtimeExecutionResult(
        Long generationRunId,
        String status,
        int candidateCount,
        int createdCount,
        int skippedCount
) {
}
