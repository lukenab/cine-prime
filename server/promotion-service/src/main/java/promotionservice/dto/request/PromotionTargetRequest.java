package promotionservice.dto.request;

import promotionservice.enums.PromotionTargetType;

public record PromotionTargetRequest(PromotionTargetType targetType, Long movieId, Long showtimeId) {}
