package movieservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.PriceBookRequest;
import movieservice.dto.response.PriceBookResponse;
import movieservice.service.PriceBookService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/price-books")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class PriceBookController {

    private final PriceBookService priceBookService;

    @GetMapping
    public ApiResponse<List<PriceBookResponse>> listAll() {
        return ApiResponse.<List<PriceBookResponse>>builder()
                .code(HttpStatus.OK.value())
                .result(priceBookService.listAll())
                .build();
    }

    @GetMapping("/{priceBookId}")
    public ApiResponse<PriceBookResponse> getById(@PathVariable Long priceBookId) {
        return ApiResponse.<PriceBookResponse>builder()
                .code(HttpStatus.OK.value())
                .result(priceBookService.getById(priceBookId))
                .build();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PriceBookResponse> create(
            @Valid @RequestBody PriceBookRequest request,
            Authentication authentication) {
        return ApiResponse.<PriceBookResponse>builder()
                .code(HttpStatus.CREATED.value())
                .message("Price book created")
                .result(priceBookService.create(request, actor(authentication)))
                .build();
    }

    @PutMapping("/{priceBookId}")
    public ApiResponse<PriceBookResponse> update(
            @PathVariable Long priceBookId,
            @Valid @RequestBody PriceBookRequest request,
            Authentication authentication) {
        return ApiResponse.<PriceBookResponse>builder()
                .code(HttpStatus.OK.value())
                .message("Price book updated")
                .result(priceBookService.update(priceBookId, request, actor(authentication)))
                .build();
    }

    @PostMapping("/{priceBookId}/activate")
    public ApiResponse<PriceBookResponse> activate(
            @PathVariable Long priceBookId,
            Authentication authentication) {
        return ApiResponse.<PriceBookResponse>builder()
                .code(HttpStatus.OK.value())
                .message("Price book activated")
                .result(priceBookService.activate(priceBookId, actor(authentication)))
                .build();
    }

    @PostMapping("/{priceBookId}/archive")
    public ApiResponse<PriceBookResponse> archive(
            @PathVariable Long priceBookId,
            Authentication authentication) {
        return ApiResponse.<PriceBookResponse>builder()
                .code(HttpStatus.OK.value())
                .message("Price book archived")
                .result(priceBookService.archive(priceBookId, actor(authentication)))
                .build();
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
