package concessionservice.controller;

import concessionservice.dto.ConcessionModels.CatalogItemResponse;
import concessionservice.service.ConcessionService;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public/cinemas/{clusterId}/concessions")
@RequiredArgsConstructor
public class CatalogController {
    private final ConcessionService service;

    @GetMapping
    public ApiResponse<List<CatalogItemResponse>> catalog(
            @PathVariable Long clusterId,
            @RequestParam(required = false) Long showtimeId) {
        return ApiResponse.<List<CatalogItemResponse>>builder()
                .result(service.catalog(clusterId))
                .build();
    }
}
