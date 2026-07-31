package concessionservice.controller;

import concessionservice.dto.ConcessionModels.*;
import concessionservice.service.ConcessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminConcessionController {
    private final ConcessionService service;

    @GetMapping("/concession-products")
    @PreAuthorize("hasAnyRole('BRANCH_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<List<ProductResponse>> products(Authentication authentication) {
        return result(service.products(actor(authentication), administrator(authentication)));
    }

    @PostMapping("/concession-products")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('BRANCH_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<ProductResponse> createProduct(
            @Valid @RequestBody ProductRequest request,
            Authentication authentication) {
        return result(service.createProduct(request, actor(authentication)));
    }

    @PutMapping("/concession-products/{id}")
    @PreAuthorize("hasAnyRole('BRANCH_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<ProductResponse> updateProduct(
            @PathVariable Long id,
            @Valid @RequestBody ProductRequest request,
            Authentication authentication) {
        return result(service.updateProduct(
                id, request, actor(authentication), administrator(authentication)));
    }

    @PostMapping("/concession-products/{id}/submit")
    @PreAuthorize("hasAnyRole('BRANCH_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<ProductResponse> submitProduct(
            @PathVariable Long id,
            Authentication authentication) {
        return result(service.submitProduct(
                id, actor(authentication), administrator(authentication)));
    }

    @PostMapping("/concession-products/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ApiResponse<ProductResponse> approveProduct(
            @PathVariable Long id,
            Authentication authentication) {
        return result(service.approveProduct(id, actor(authentication)));
    }

    @PostMapping("/concession-products/{id}/reject")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ApiResponse<ProductResponse> rejectProduct(
            @PathVariable Long id,
            @Valid @RequestBody ProductReviewRequest request,
            Authentication authentication) {
        return result(service.rejectProduct(
                id, request.reason(), actor(authentication)));
    }

    @DeleteMapping("/concession-products/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public void deleteProduct(@PathVariable Long id) {
        service.deleteProduct(id);
    }

    @GetMapping("/concession-skus")
    @PreAuthorize("hasAnyRole('BRANCH_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<List<SkuResponse>> skus(Authentication authentication) {
        return result(service.skus(actor(authentication), administrator(authentication)));
    }

    @PostMapping("/concession-skus")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('BRANCH_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<SkuResponse> createSku(
            @Valid @RequestBody SkuRequest request,
            Authentication authentication) {
        return result(service.createSku(
                request, actor(authentication), administrator(authentication)));
    }

    @PutMapping("/concession-skus/{id}")
    @PreAuthorize("hasAnyRole('BRANCH_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<SkuResponse> updateSku(
            @PathVariable Long id,
            @Valid @RequestBody SkuRequest request,
            Authentication authentication) {
        return result(service.updateSku(
                id, request, actor(authentication), administrator(authentication)));
    }

    @DeleteMapping("/concession-skus/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('BRANCH_MANAGER','ADMIN','SUPER_ADMIN')")
    public void deleteSku(@PathVariable Long id, Authentication authentication) {
        service.deleteSku(id, actor(authentication), administrator(authentication));
    }

    @GetMapping("/concession-combos")
    public ApiResponse<List<ComboResponse>> combos() {
        return result(service.combos());
    }

    @PostMapping("/concession-combos")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ComboResponse> createCombo(@Valid @RequestBody ComboRequest request) {
        return result(service.createCombo(request));
    }

    @PutMapping("/concession-combos/{id}")
    public ApiResponse<ComboResponse> updateCombo(
            @PathVariable Long id, @Valid @RequestBody ComboRequest request) {
        return result(service.updateCombo(id, request));
    }

    @DeleteMapping("/concession-combos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCombo(@PathVariable Long id) {
        service.deleteCombo(id);
    }

    @GetMapping("/cinemas/{clusterId}/concession-offers")
    public ApiResponse<List<OfferResponse>> offers(@PathVariable Long clusterId) {
        return result(service.offers(clusterId));
    }

    @PutMapping("/cinemas/{clusterId}/concession-offers/{type}/{sellableId}")
    public ApiResponse<OfferResponse> upsertOffer(
            @PathVariable Long clusterId,
            @PathVariable String type,
            @PathVariable Long sellableId,
            @Valid @RequestBody OfferRequest request,
            Authentication authentication) {
        return result(service.upsertOffer(
                clusterId, type, sellableId, request, actor(authentication)));
    }

    @PutMapping("/cinemas/{clusterId}/concession-offers/bulk")
    public ApiResponse<List<OfferResponse>> bulkUpsertOffers(
            @PathVariable Long clusterId,
            @Valid @RequestBody BulkOfferRequest request,
            Authentication authentication) {
        return result(service.bulkUpsertOffers(clusterId, request, actor(authentication)));
    }

    @PostMapping("/cinemas/{clusterId}/concession-offers/copy")
    public ApiResponse<List<OfferResponse>> copyOffers(
            @PathVariable Long clusterId,
            @Valid @RequestBody CopyOffersRequest request,
            Authentication authentication) {
        return result(service.copyOffers(clusterId, request, actor(authentication)));
    }

    @GetMapping("/cinemas/{clusterId}/concession-offers/audit")
    public ApiResponse<List<OfferAuditResponse>> offerAudit(
            @PathVariable Long clusterId,
            @RequestParam(defaultValue = "100") int limit) {
        return result(service.offerAudit(clusterId, limit));
    }

    @GetMapping("/cinemas/{clusterId}/concession-inventory")
    public ApiResponse<List<InventoryResponse>> inventory(@PathVariable Long clusterId) {
        return result(service.inventory(clusterId));
    }

    @PutMapping("/cinemas/{clusterId}/concession-inventory/{skuId}")
    public ApiResponse<InventoryResponse> setInventory(
            @PathVariable Long clusterId,
            @PathVariable Long skuId,
            @Valid @RequestBody InventoryRequest request) {
        return result(service.setInventory(clusterId, skuId, request));
    }

    private <T> ApiResponse<T> result(T value) {
        return ApiResponse.<T>builder().result(value).build();
    }

    private String actor(Authentication authentication) {
        return authentication == null || authentication.getName() == null
                ? "system"
                : authentication.getName();
    }

    private boolean administrator(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority())
                        || "ROLE_SUPER_ADMIN".equals(authority.getAuthority()));
    }
}
