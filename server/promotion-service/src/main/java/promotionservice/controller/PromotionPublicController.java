package promotionservice.controller;

import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import promotionservice.dto.response.PublicPromotionOfferResponse;
import promotionservice.service.PromotionPublicQueryService;

import java.util.List;

@RestController
@RequestMapping("/api/public/promotions")
@RequiredArgsConstructor
public class PromotionPublicController {
    private final PromotionPublicQueryService service;

    @GetMapping
    public ApiResponse<List<PublicPromotionOfferResponse>> activeOffers() {
        return ApiResponse.<List<PublicPromotionOfferResponse>>builder()
                .code(200)
                .result(service.activeOffers())
                .build();
    }
}
