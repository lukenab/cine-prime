package concessionservice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public final class ConcessionModels {
    private ConcessionModels() {}

    public record ProductRequest(
            @NotBlank String code,
            @NotBlank String name,
            @NotBlank String category,
            String description,
            String imageUrl,
            Boolean active) {}

    public record ProductResponse(
            Long id, String code, String name, String category,
            String description, String imageUrl, boolean active,
            String status, String createdBy, String submittedBy,
            OffsetDateTime submittedAt, String reviewedBy,
            OffsetDateTime reviewedAt, String rejectionReason) {}

    public record ProductReviewRequest(
            @Size(max = 500) String reason) {}

    public record SkuRequest(
            @NotNull Long productId,
            @NotBlank String skuCode,
            String size,
            String flavor,
            Map<String, Object> attributes,
            Boolean active) {}

    public record SkuResponse(
            Long id, Long productId, String productName, String skuCode,
            String size, String flavor, Map<String, Object> attributes, boolean active) {}

    public record ComboComponentRequest(
            @NotBlank String groupCode,
            @NotNull Long allowedSkuId,
            @NotNull @Min(1) Integer quantity,
            @NotNull @Min(0) Integer minSelect,
            @NotNull @Min(1) Integer maxSelect) {}

    public record ComboRequest(
            @NotBlank String code,
            @NotBlank String name,
            String description,
            String imageUrl,
            Boolean active,
            @NotEmpty List<@Valid ComboComponentRequest> components) {}

    public record ComboComponentResponse(
            String groupCode, Long allowedSkuId, String skuCode, String label,
            int quantity, int minSelect, int maxSelect, Integer availableCount) {}

    public record ComboResponse(
            Long id, String code, String name, String description, String imageUrl,
            boolean active, List<ComboComponentResponse> components) {}

    public record OfferRequest(
            @NotNull @DecimalMin("0.00") BigDecimal price,
            @Pattern(regexp = "[A-Za-z]{3}") String currency,
            Boolean available,
            OffsetDateTime effectiveFrom,
            OffsetDateTime effectiveTo) {}

    public record OfferResponse(
            Long id, Long cinemaClusterId, String sellableType, Long sellableId,
            BigDecimal price, String currency, boolean available,
            OffsetDateTime effectiveFrom, OffsetDateTime effectiveTo) {}

    public record OfferBulkItemRequest(
            @NotBlank String sellableType,
            @NotNull Long sellableId,
            @NotNull @DecimalMin("0.00") BigDecimal price,
            @Pattern(regexp = "[A-Za-z]{3}") String currency,
            Boolean available,
            OffsetDateTime effectiveFrom,
            OffsetDateTime effectiveTo) {}

    public record BulkOfferRequest(@NotEmpty List<@Valid OfferBulkItemRequest> offers) {}

    public record CopyOffersRequest(
            @NotNull Long sourceClusterId,
            Boolean overwriteExisting) {}

    public record OfferAuditResponse(
            Long id,
            Long cinemaClusterId,
            String sellableType,
            Long sellableId,
            String sellableCode,
            String sellableName,
            String operation,
            BigDecimal oldPrice,
            BigDecimal newPrice,
            String currency,
            Boolean oldAvailable,
            boolean newAvailable,
            OffsetDateTime oldEffectiveFrom,
            OffsetDateTime newEffectiveFrom,
            OffsetDateTime oldEffectiveTo,
            OffsetDateTime newEffectiveTo,
            Long sourceClusterId,
            String changedBy,
            OffsetDateTime changedAt) {}

    public record MediaUploadResponse(
            String url,
            String filename,
            String contentType,
            long size) {}

    public record InventoryRequest(@NotNull @Min(0) Integer onHand) {}

    public record InventoryResponse(
            Long cinemaClusterId, Long skuId, String skuCode,
            int onHand, int reserved, long version) {}

    public record CatalogItemResponse(
            String sellableType, Long sellableId, String code, String name,
            String category, String description, String imageUrl,
            BigDecimal price, String currency, String availability,
            String size, String flavor, List<ComboComponentResponse> components) {}

    public record SelectionRequest(
            @NotBlank String groupCode,
            @NotEmpty List<@NotNull Long> skuIds) {}

    public record ReservationItemRequest(
            @NotBlank String sellableType,
            @NotNull Long sellableId,
            @NotNull @Min(1) @Max(20) Integer quantity,
            List<@Valid SelectionRequest> selections) {}

    public record ReservationRequest(
            @NotBlank String bookingId,
            @NotBlank String customerId,
            @NotNull Long cinemaClusterId,
            @NotEmpty List<@Valid ReservationItemRequest> items,
            @NotBlank String idempotencyKey,
            OffsetDateTime checkoutExpiresAt) {}

    public record ReservationLineResponse(
            String itemCode, String itemName, String options,
            int quantity, BigDecimal unitPrice, BigDecimal discountAmount,
            BigDecimal finalAmount) {}

    public record ReservationResponse(
            String reservationId, String bookingId, Long cinemaClusterId,
            String status, OffsetDateTime expiresAt, BigDecimal total,
            String currency, boolean replayed, List<ReservationLineResponse> items) {}

    public record ConfirmRequest(String paymentId, OffsetDateTime paidAt) {}

    public record OrderResponse(
            String orderId, String bookingId, String paymentId, Long cinemaClusterId,
            String pickupCode, String status, OffsetDateTime paidAt,
            OffsetDateTime readyAt, OffsetDateTime collectedAt,
            BigDecimal total, String currency, List<ReservationLineResponse> items) {}
}
