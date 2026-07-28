package movieservice.dto.response;

import movieservice.enums.PriceBookStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record PriceBookResponse(
        Long priceBookId,
        Long clusterId,
        String clusterName,
        String code,
        String name,
        String currencyCode,
        LocalDate validFrom,
        LocalDate validTo,
        Integer priority,
        PriceBookStatus status,
        List<PriceRateResponse> rates,
        String createdBy,
        String updatedBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
