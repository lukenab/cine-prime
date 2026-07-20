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

    // ADMIN + EMPLOYEE - a production company is added inline while creating/editing a movie
    // in MovieEditorPage (both roles use it, same rationale as PersonController's create/update),
    // not a standalone governance action like genre creation.
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PostMapping
    public ApiResponse<ProductionCompanyResponse> create(@Valid @RequestBody ProductionCompanyRequest req) {
        // If this exact TMDB company was already created (e.g. a concurrent save, or the same
        // TMDB pick added on two different movies before either had a companyId yet), reuse the
        // existing row instead of hitting the unique constraint on tmdb_company_id.
        if (req.getTmdbCompanyId() != null) {
            ProductionCompany existing = productionCompanyRepository.findByTmdbCompanyId(req.getTmdbCompanyId()).orElse(null);
            if (existing != null) {
                return ApiResponse.<ProductionCompanyResponse>builder()
                        .code(201)
                        .result(movieMapper.toProductionCompanyResponse(existing))
                        .build();
            }
        }
        ProductionCompany entity = ProductionCompany.builder()
                .name(req.getName().trim())
                .country(req.getCountry())
                .logoUrl(req.getLogoUrl())
                .websiteUrl(req.getWebsiteUrl())
                .tmdbCompanyId(req.getTmdbCompanyId())
                .createdAt(LocalDateTime.now())
                .build();
        return ApiResponse.<ProductionCompanyResponse>builder()
                .code(201)
                .result(movieMapper.toProductionCompanyResponse(productionCompanyRepository.save(entity)))
                .build();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
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

    // DELETE /api/companies/{id} - ADMIN only, more consequential than create/update (a company
    // may be referenced as production company on several movies).
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        if (!productionCompanyRepository.existsById(id))
            throw new AppException(MovieErrorCode.COMPANY_NOT_FOUND);
        productionCompanyRepository.deleteById(id);
        return ApiResponse.<Void>builder().code(200).message("Deleted").build();
    }
}
