package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.ProductionCompanyRequest;
import movieservice.dto.response.ProductionCompanyResponse;
import movieservice.entity.ProductionCompany;
import movie.theater.common.exception.AppException;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.ProductionCompanyRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/companies")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProductionCompanyController {

    ProductionCompanyRepository productionCompanyRepository;
    MovieMapper movieMapper;

    @GetMapping
    public ApiResponse<List<ProductionCompanyResponse>> getAll(
            @RequestParam(required = false) String q) {
        List<ProductionCompanyResponse> result = q != null && !q.isBlank()
                ? movieMapper.toProductionCompanyResponseList(
                        productionCompanyRepository.findByNameContainingIgnoreCase(q))
                : movieMapper.toProductionCompanyResponseList(
                        productionCompanyRepository.findAll());
        return ApiResponse.<List<ProductionCompanyResponse>>builder()
                .code(200).result(result).build();
    }

    @GetMapping("/{id}")
    public ApiResponse<ProductionCompanyResponse> getById(@PathVariable Long id) {
        ProductionCompany entity = productionCompanyRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.COMPANY_NOT_FOUND));
        return ApiResponse.<ProductionCompanyResponse>builder()
                .code(200).result(movieMapper.toProductionCompanyResponse(entity)).build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ApiResponse<ProductionCompanyResponse> create(@Valid @RequestBody ProductionCompanyRequest req) {
        ProductionCompany entity = ProductionCompany.builder()
                .name(req.getName().trim())
                .country(req.getCountry())
                .logoUrl(req.getLogoUrl())
                .websiteUrl(req.getWebsiteUrl())
                .createdAt(LocalDateTime.now())
                .build();
        return ApiResponse.<ProductionCompanyResponse>builder()
                .code(201)
                .result(movieMapper.toProductionCompanyResponse(productionCompanyRepository.save(entity)))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ApiResponse<ProductionCompanyResponse> update(@PathVariable Long id,
                                                          @Valid @RequestBody ProductionCompanyRequest req) {
        ProductionCompany entity = productionCompanyRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.COMPANY_NOT_FOUND));
        entity.setName(req.getName().trim());
        entity.setCountry(req.getCountry());
        entity.setLogoUrl(req.getLogoUrl());
        entity.setWebsiteUrl(req.getWebsiteUrl());
        return ApiResponse.<ProductionCompanyResponse>builder()
                .code(200)
                .result(movieMapper.toProductionCompanyResponse(productionCompanyRepository.save(entity)))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        if (!productionCompanyRepository.existsById(id))
            throw new AppException(MovieErrorCode.COMPANY_NOT_FOUND);
        productionCompanyRepository.deleteById(id);
        return ApiResponse.<Void>builder().code(200).message("Deleted").build();
    }
}
