package movieservice.dto.response;

public record ShowtimeAllocationFormatPriorityResponse(
        Integer formatId,
        String formatCode,
        String formatName,
        Integer allocationPriority
) {
}
