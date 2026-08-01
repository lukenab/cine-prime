package concessionservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import concessionservice.dto.ConcessionModels.*;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

import static concessionservice.exception.ConcessionErrorCode.*;

@Service
@RequiredArgsConstructor
public class ConcessionService {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final Set<String> ORDER_TRANSITIONS = Set.of(
            "PAID->PREPARING", "PREPARING->READY", "READY->COLLECTED");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;

    @Value("${concession.reservation.ttl-seconds:600}")
    private long reservationTtlSeconds;

    public List<ProductResponse> products(String actor, boolean administrator) {
        return jdbc.query("""
                SELECT id,code,name,category,description,image_url,active,status,created_by,
                       submitted_by,submitted_at,reviewed_by,reviewed_at,rejection_reason
                FROM concession_product
                WHERE ? OR active OR created_by=?
                ORDER BY
                    CASE status
                        WHEN 'PENDING_APPROVAL' THEN 0
                        WHEN 'REJECTED' THEN 1
                        WHEN 'DRAFT' THEN 2
                        WHEN 'ACTIVE' THEN 3
                        ELSE 4
                    END,
                    updated_at DESC,name
                """, productMapper(), administrator, actor);
    }

    public List<ProductResponse> products() {
        return products("system", true);
    }

    @Transactional
    public ProductResponse createProduct(ProductRequest request, String actor) {
        Long id = jdbc.queryForObject("""
                INSERT INTO concession_product(
                    code,name,category,description,image_url,active,status,created_by)
                VALUES (?,?,?,?,?,FALSE,'DRAFT',?) RETURNING id
                """, Long.class, normalizedCode(request.code()), request.name().trim(),
                request.category().trim().toUpperCase(Locale.ROOT), request.description(),
                request.imageUrl(), actor);
        return product(id);
    }

    public ProductResponse createProduct(ProductRequest request) {
        return createProduct(request, "system");
    }

    @Transactional
    public ProductResponse updateProduct(
            Long id, ProductRequest request, String actor, boolean administrator) {
        ProductWorkflow workflow = productWorkflow(id, true);
        requireProductEditor(workflow, actor, administrator);
        if ("PENDING_APPROVAL".equals(workflow.status())) {
            throw new AppException(PRODUCT_WORKFLOW_INVALID);
        }

        boolean remainsActive = administrator && "ACTIVE".equals(workflow.status());
        String nextStatus = remainsActive ? "ACTIVE" : "DRAFT";
        int changed = jdbc.update("""
                UPDATE concession_product
                SET code=?,name=?,category=?,description=?,image_url=?,active=?,status=?,
                    submitted_by=CASE WHEN ?='DRAFT' THEN NULL ELSE submitted_by END,
                    submitted_at=CASE WHEN ?='DRAFT' THEN NULL ELSE submitted_at END,
                    reviewed_by=CASE WHEN ?='DRAFT' THEN NULL ELSE reviewed_by END,
                    reviewed_at=CASE WHEN ?='DRAFT' THEN NULL ELSE reviewed_at END,
                    rejection_reason=NULL,updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """, normalizedCode(request.code()), request.name().trim(),
                request.category().trim().toUpperCase(Locale.ROOT), request.description(),
                request.imageUrl(), remainsActive, nextStatus,
                nextStatus, nextStatus, nextStatus, nextStatus, id);
        requireChanged(changed);
        return product(id);
    }

    public ProductResponse updateProduct(Long id, ProductRequest request) {
        return updateProduct(id, request, "system", true);
    }

    @Transactional
    public ProductResponse submitProduct(Long id, String actor, boolean administrator) {
        ProductWorkflow workflow = productWorkflow(id, true);
        requireProductEditor(workflow, actor, administrator);
        if (!Set.of("DRAFT", "REJECTED").contains(workflow.status())) {
            throw new AppException(PRODUCT_WORKFLOW_INVALID);
        }
        Boolean hasVariant = jdbc.query(
                "SELECT EXISTS(SELECT 1 FROM concession_sku WHERE product_id=? AND active)",
                rs -> rs.next() && rs.getBoolean(1), id);
        if (!Boolean.TRUE.equals(hasVariant)) {
            throw new AppException(PRODUCT_VARIANT_REQUIRED);
        }
        jdbc.update("""
                UPDATE concession_product
                SET status='PENDING_APPROVAL',active=FALSE,submitted_by=?,
                    submitted_at=CURRENT_TIMESTAMP,reviewed_by=NULL,reviewed_at=NULL,
                    rejection_reason=NULL,updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """, actor, id);
        return product(id);
    }

    @Transactional
    public ProductResponse approveProduct(Long id, String reviewer) {
        ProductWorkflow workflow = productWorkflow(id, true);
        if (!"PENDING_APPROVAL".equals(workflow.status())) {
            throw new AppException(PRODUCT_WORKFLOW_INVALID);
        }
        jdbc.update("""
                UPDATE concession_product
                SET status='ACTIVE',active=TRUE,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,
                    rejection_reason=NULL,updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """, reviewer, id);
        return product(id);
    }

    @Transactional
    public ProductResponse rejectProduct(Long id, String reason, String reviewer) {
        if (reason == null || reason.isBlank()) {
            throw new AppException(REJECTION_REASON_REQUIRED);
        }
        ProductWorkflow workflow = productWorkflow(id, true);
        if (!"PENDING_APPROVAL".equals(workflow.status())) {
            throw new AppException(PRODUCT_WORKFLOW_INVALID);
        }
        jdbc.update("""
                UPDATE concession_product
                SET status='REJECTED',active=FALSE,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,
                    rejection_reason=?,updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """, reviewer, reason.trim(), id);
        return product(id);
    }

    @Transactional
    public void deleteProduct(Long id) {
        requireChanged(jdbc.update("""
                UPDATE concession_product
                SET active=FALSE,status='ARCHIVED',updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """, id));
    }

    private ProductResponse product(Long id) {
        return one(jdbc.query("""
                SELECT id,code,name,category,description,image_url,active,status,created_by,
                       submitted_by,submitted_at,reviewed_by,reviewed_at,rejection_reason
                FROM concession_product WHERE id=?
                """, productMapper(), id));
    }

    private RowMapper<ProductResponse> productMapper() {
        return (rs, n) -> new ProductResponse(
                rs.getLong("id"), rs.getString("code"), rs.getString("name"),
                rs.getString("category"), rs.getString("description"),
                rs.getString("image_url"), rs.getBoolean("active"),
                rs.getString("status"), rs.getString("created_by"),
                rs.getString("submitted_by"), offset(rs, "submitted_at"),
                rs.getString("reviewed_by"), offset(rs, "reviewed_at"),
                rs.getString("rejection_reason"));
    }

    public List<SkuResponse> skus(String actor, boolean administrator) {
        return jdbc.query("""
                SELECT s.id,s.product_id,p.name product_name,s.sku_code,s.size,s.flavor,
                       s.attributes_json::text attributes_json,s.active
                FROM concession_sku s JOIN concession_product p ON p.id=s.product_id
                WHERE ? OR p.active OR p.created_by=?
                ORDER BY p.name,s.size,s.flavor
                """, skuMapper(), administrator, actor);
    }

    public List<SkuResponse> skus() {
        return skus("system", true);
    }

    @Transactional
    public SkuResponse createSku(
            SkuRequest request, String actor, boolean administrator) {
        requireEditableProduct(request.productId(), actor, administrator);
        Long id = jdbc.queryForObject("""
                INSERT INTO concession_sku(product_id,sku_code,size,flavor,attributes_json,active)
                VALUES (?,?,?,?,?::jsonb,?) RETURNING id
                """, Long.class, request.productId(), normalizedCode(request.skuCode()),
                blankToNull(request.size()), blankToNull(request.flavor()),
                json(request.attributes() == null ? Map.of() : request.attributes()), active(request.active()));
        return sku(id);
    }

    public SkuResponse createSku(SkuRequest request) {
        return createSku(request, "system", true);
    }

    @Transactional
    public SkuResponse updateSku(
            Long id, SkuRequest request, String actor, boolean administrator) {
        requireEditableProduct(request.productId(), actor, administrator);
        requireSku(id);
        Long existingProductId = jdbc.queryForObject(
                "SELECT product_id FROM concession_sku WHERE id=?", Long.class, id);
        requireEditableProduct(existingProductId, actor, administrator);
        int changed = jdbc.update("""
                UPDATE concession_sku SET product_id=?,sku_code=?,size=?,flavor=?,
                    attributes_json=?::jsonb,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
                """, request.productId(), normalizedCode(request.skuCode()),
                blankToNull(request.size()), blankToNull(request.flavor()),
                json(request.attributes() == null ? Map.of() : request.attributes()),
                active(request.active()), id);
        requireChanged(changed);
        return sku(id);
    }

    public SkuResponse updateSku(Long id, SkuRequest request) {
        return updateSku(id, request, "system", true);
    }

    @Transactional
    public void deleteSku(Long id, String actor, boolean administrator) {
        requireSku(id);
        Long productId = jdbc.queryForObject(
                "SELECT product_id FROM concession_sku WHERE id=?", Long.class, id);
        requireEditableProduct(productId, actor, administrator);
        requireChanged(jdbc.update(
                "UPDATE concession_sku SET active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id=?", id));
    }

    public void deleteSku(Long id) {
        deleteSku(id, "system", true);
    }

    private SkuResponse sku(Long id) {
        return one(jdbc.query("""
                SELECT s.id,s.product_id,p.name product_name,s.sku_code,s.size,s.flavor,
                       s.attributes_json::text attributes_json,s.active
                FROM concession_sku s JOIN concession_product p ON p.id=s.product_id WHERE s.id=?
                """, skuMapper(), id));
    }

    private RowMapper<SkuResponse> skuMapper() {
        return (rs, n) -> new SkuResponse(
                rs.getLong("id"), rs.getLong("product_id"), rs.getString("product_name"),
                rs.getString("sku_code"), rs.getString("size"), rs.getString("flavor"),
                readMap(rs.getString("attributes_json")), rs.getBoolean("active"));
    }

    public List<ComboResponse> combos() {
        return jdbc.query("""
                SELECT id,code,name,description,image_url,active
                FROM concession_combo ORDER BY name
                """, (rs, n) -> comboFromRow(rs));
    }

    @Transactional
    public ComboResponse createCombo(ComboRequest request) {
        Long id = jdbc.queryForObject("""
                INSERT INTO concession_combo(code,name,description,image_url,active)
                VALUES (?,?,?,?,?) RETURNING id
                """, Long.class, normalizedCode(request.code()), request.name().trim(),
                request.description(), request.imageUrl(), active(request.active()));
        replaceComponents(id, request.components());
        return combo(id);
    }

    @Transactional
    public ComboResponse updateCombo(Long id, ComboRequest request) {
        requireChanged(jdbc.update("""
                UPDATE concession_combo SET code=?,name=?,description=?,image_url=?,active=?,
                    updated_at=CURRENT_TIMESTAMP WHERE id=?
                """, normalizedCode(request.code()), request.name().trim(), request.description(),
                request.imageUrl(), active(request.active()), id));
        replaceComponents(id, request.components());
        return combo(id);
    }

    @Transactional
    public void deleteCombo(Long id) {
        requireChanged(jdbc.update(
                "UPDATE concession_combo SET active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id=?", id));
    }

    private ComboResponse combo(Long id) {
        List<ComboResponse> rows = jdbc.query("""
                SELECT id,code,name,description,image_url,active
                FROM concession_combo WHERE id=?
                """, (rs, n) -> comboFromRow(rs), id);
        return one(rows);
    }

    private ComboResponse comboFromRow(ResultSet rs) throws SQLException {
        long id = rs.getLong("id");
        return new ComboResponse(id, rs.getString("code"), rs.getString("name"),
                rs.getString("description"), rs.getString("image_url"), rs.getBoolean("active"),
                components(id));
    }

    private List<ComboComponentResponse> components(long comboId) {
        return jdbc.query("""
                SELECT c.group_code,c.allowed_sku_id,s.sku_code,
                       CONCAT(p.name,
                           CASE WHEN s.size IS NULL THEN '' ELSE ' '||s.size END,
                           CASE WHEN s.flavor IS NULL THEN '' ELSE ' · '||s.flavor END) label,
                       c.quantity,c.min_select,c.max_select
                FROM concession_combo_component c
                JOIN concession_sku s ON s.id=c.allowed_sku_id
                JOIN concession_product p ON p.id=s.product_id
                WHERE c.combo_id=? ORDER BY c.group_code,s.sku_code
                """, (rs, n) -> new ComboComponentResponse(
                rs.getString("group_code"), rs.getLong("allowed_sku_id"),
                rs.getString("sku_code"), rs.getString("label"), rs.getInt("quantity"),
                rs.getInt("min_select"), rs.getInt("max_select"), null), comboId);
    }

    private void replaceComponents(Long comboId, List<ComboComponentRequest> components) {
        if (components == null || components.isEmpty()) throw new AppException(INVALID_REQUEST);
        jdbc.update("DELETE FROM concession_combo_component WHERE combo_id=?", comboId);
        for (ComboComponentRequest component : components) {
            if (component.maxSelect() < component.minSelect()) throw new AppException(INVALID_REQUEST);
            requireSku(component.allowedSkuId());
            jdbc.update("""
                    INSERT INTO concession_combo_component
                        (combo_id,group_code,allowed_sku_id,quantity,min_select,max_select)
                    VALUES (?,?,?,?,?,?)
                    """, comboId, normalizedCode(component.groupCode()), component.allowedSkuId(),
                    component.quantity(), component.minSelect(), component.maxSelect());
        }
    }

    public List<OfferResponse> offers(Long clusterId) {
        return jdbc.query("""
                SELECT id,cinema_cluster_id,sellable_type,sellable_id,price,currency,available,
                       effective_from,effective_to
                FROM cluster_concession_offer WHERE cinema_cluster_id=?
                ORDER BY sellable_type,sellable_id
                """, offerMapper(), clusterId);
    }

    @Transactional
    public OfferResponse upsertOffer(
            Long clusterId, String type, Long sellableId, OfferRequest request) {
        return upsertOffer(clusterId, type, sellableId, request, "system");
    }

    @Transactional
    public OfferResponse upsertOffer(
            Long clusterId, String type, Long sellableId, OfferRequest request, String actor) {
        return upsertOfferInternal(clusterId, type, sellableId, request, actor, null, null);
    }

    @Transactional
    public List<OfferResponse> bulkUpsertOffers(
            Long clusterId, BulkOfferRequest request, String actor) {
        List<OfferResponse> result = new ArrayList<>();
        for (OfferBulkItemRequest item : request.offers()) {
            OfferRequest offer = new OfferRequest(
                    item.price(), item.currency(), item.available(),
                    item.effectiveFrom(), item.effectiveTo());
            result.add(upsertOfferInternal(
                    clusterId, item.sellableType(), item.sellableId(), offer,
                    actor, "BULK_UPDATE", null));
        }
        return result;
    }

    @Transactional
    public List<OfferResponse> copyOffers(
            Long targetClusterId, CopyOffersRequest request, String actor) {
        if (targetClusterId.equals(request.sourceClusterId())) {
            throw new AppException(INVALID_REQUEST);
        }
        List<OfferResponse> sourceOffers = offers(request.sourceClusterId());
        boolean overwrite = Boolean.TRUE.equals(request.overwriteExisting());
        List<OfferResponse> result = new ArrayList<>();
        for (OfferResponse source : sourceOffers) {
            if (!overwrite && findOffer(targetClusterId, source.sellableType(), source.sellableId()).isPresent()) {
                continue;
            }
            OfferRequest offer = new OfferRequest(
                    source.price(), source.currency(), source.available(),
                    source.effectiveFrom(), source.effectiveTo());
            result.add(upsertOfferInternal(
                    targetClusterId, source.sellableType(), source.sellableId(), offer,
                    actor, "COPY", request.sourceClusterId()));
        }
        return result;
    }

    public List<OfferAuditResponse> offerAudit(Long clusterId, int requestedLimit) {
        int limit = Math.max(1, Math.min(requestedLimit, 200));
        return jdbc.query("""
                SELECT a.id,a.cinema_cluster_id,a.sellable_type,a.sellable_id,
                       CASE WHEN a.sellable_type='SKU' THEN s.sku_code ELSE c.code END sellable_code,
                       CASE WHEN a.sellable_type='SKU' THEN p.name ELSE c.name END sellable_name,
                       a.operation,a.old_price,a.new_price,a.currency,
                       a.old_available,a.new_available,
                       a.old_effective_from,a.new_effective_from,
                       a.old_effective_to,a.new_effective_to,
                       a.source_cluster_id,a.changed_by,a.changed_at
                FROM concession_offer_audit a
                LEFT JOIN concession_sku s
                    ON a.sellable_type='SKU' AND s.id=a.sellable_id
                LEFT JOIN concession_product p ON p.id=s.product_id
                LEFT JOIN concession_combo c
                    ON a.sellable_type='COMBO' AND c.id=a.sellable_id
                WHERE a.cinema_cluster_id=?
                ORDER BY a.changed_at DESC,a.id DESC
                LIMIT ?
                """, (rs, n) -> new OfferAuditResponse(
                rs.getLong("id"), rs.getLong("cinema_cluster_id"),
                rs.getString("sellable_type"), rs.getLong("sellable_id"),
                rs.getString("sellable_code"), rs.getString("sellable_name"),
                rs.getString("operation"), rs.getBigDecimal("old_price"),
                rs.getBigDecimal("new_price"), rs.getString("currency"),
                nullableBoolean(rs, "old_available"), rs.getBoolean("new_available"),
                offset(rs, "old_effective_from"), offset(rs, "new_effective_from"),
                offset(rs, "old_effective_to"), offset(rs, "new_effective_to"),
                nullableLong(rs, "source_cluster_id"), rs.getString("changed_by"),
                offset(rs, "changed_at")), clusterId, limit);
    }

    private OfferResponse upsertOfferInternal(
            Long clusterId,
            String type,
            Long sellableId,
            OfferRequest request,
            String actor,
            String requestedOperation,
            Long sourceClusterId) {
        String normalizedType = sellableType(type);
        requireSellable(normalizedType, sellableId);
        if (request.effectiveFrom() != null && request.effectiveTo() != null
                && !request.effectiveTo().isAfter(request.effectiveFrom())) {
            throw new AppException(INVALID_REQUEST);
        }
        Optional<OfferResponse> previous = findOffer(clusterId, normalizedType, sellableId);
        Long id = jdbc.queryForObject("""
                INSERT INTO cluster_concession_offer
                    (cinema_cluster_id,sellable_type,sellable_id,price,currency,available,
                     effective_from,effective_to)
                VALUES (?,?,?,?,?,?,?,?)
                ON CONFLICT (cinema_cluster_id,sellable_type,sellable_id)
                DO UPDATE SET price=EXCLUDED.price,currency=EXCLUDED.currency,
                    available=EXCLUDED.available,effective_from=EXCLUDED.effective_from,
                    effective_to=EXCLUDED.effective_to,updated_at=CURRENT_TIMESTAMP
                RETURNING id
                """, Long.class, clusterId, normalizedType, sellableId, request.price(),
                currency(request.currency()), active(request.available()),
                request.effectiveFrom(), request.effectiveTo());
        OfferResponse saved = one(jdbc.query("""
                SELECT id,cinema_cluster_id,sellable_type,sellable_id,price,currency,available,
                       effective_from,effective_to
                FROM cluster_concession_offer WHERE id=?
                """, offerMapper(), id));
        OfferResponse old = previous.orElse(null);
        String operation = requestedOperation != null
                ? requestedOperation
                : old == null ? "CREATE" : "UPDATE";
        jdbc.update("""
                INSERT INTO concession_offer_audit(
                    cinema_cluster_id,sellable_type,sellable_id,operation,
                    old_price,new_price,currency,old_available,new_available,
                    old_effective_from,new_effective_from,old_effective_to,new_effective_to,
                    source_cluster_id,changed_by)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, clusterId, normalizedType, sellableId, operation,
                old == null ? null : old.price(), saved.price(), saved.currency(),
                old == null ? null : old.available(), saved.available(),
                old == null ? null : old.effectiveFrom(), saved.effectiveFrom(),
                old == null ? null : old.effectiveTo(), saved.effectiveTo(),
                sourceClusterId, actor == null || actor.isBlank() ? "system" : actor);
        return saved;
    }

    private Optional<OfferResponse> findOffer(Long clusterId, String type, Long sellableId) {
        List<OfferResponse> rows = jdbc.query("""
                SELECT id,cinema_cluster_id,sellable_type,sellable_id,price,currency,available,
                       effective_from,effective_to
                FROM cluster_concession_offer
                WHERE cinema_cluster_id=? AND sellable_type=? AND sellable_id=?
                """, offerMapper(), clusterId, type, sellableId);
        return rows.stream().findFirst();
    }

    private RowMapper<OfferResponse> offerMapper() {
        return (rs, n) -> new OfferResponse(
                rs.getLong("id"), rs.getLong("cinema_cluster_id"),
                rs.getString("sellable_type"), rs.getLong("sellable_id"),
                rs.getBigDecimal("price"), rs.getString("currency"), rs.getBoolean("available"),
                offset(rs, "effective_from"), offset(rs, "effective_to"));
    }

    public List<InventoryResponse> inventory(Long clusterId) {
        return jdbc.query("""
                SELECT i.cinema_cluster_id,i.sku_id,s.sku_code,i.on_hand,i.reserved,i.version
                FROM cluster_inventory i JOIN concession_sku s ON s.id=i.sku_id
                WHERE i.cinema_cluster_id=? ORDER BY s.sku_code
                """, inventoryMapper(), clusterId);
    }

    @Transactional
    public InventoryResponse setInventory(Long clusterId, Long skuId, InventoryRequest request) {
        requireSku(skuId);
        Integer reserved = jdbc.query("""
                SELECT reserved FROM cluster_inventory WHERE cinema_cluster_id=? AND sku_id=?
                """, rs -> rs.next() ? rs.getInt(1) : 0, clusterId, skuId);
        if (request.onHand() < reserved) throw new AppException(INVALID_REQUEST);
        jdbc.update("""
                INSERT INTO cluster_inventory(cinema_cluster_id,sku_id,on_hand,reserved)
                VALUES (?,?,?,0)
                ON CONFLICT (cinema_cluster_id,sku_id)
                DO UPDATE SET on_hand=EXCLUDED.on_hand,version=cluster_inventory.version+1,
                    updated_at=CURRENT_TIMESTAMP
                """, clusterId, skuId, request.onHand());
        return one(jdbc.query("""
                SELECT i.cinema_cluster_id,i.sku_id,s.sku_code,i.on_hand,i.reserved,i.version
                FROM cluster_inventory i JOIN concession_sku s ON s.id=i.sku_id
                WHERE i.cinema_cluster_id=? AND i.sku_id=?
                """, inventoryMapper(), clusterId, skuId));
    }

    private RowMapper<InventoryResponse> inventoryMapper() {
        return (rs, n) -> new InventoryResponse(
                rs.getLong("cinema_cluster_id"), rs.getLong("sku_id"),
                rs.getString("sku_code"), rs.getInt("on_hand"),
                rs.getInt("reserved"), rs.getLong("version"));
    }

    public List<CatalogItemResponse> catalog(Long clusterId) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<CatalogItemResponse> result = new ArrayList<>();
        result.addAll(jdbc.query("""
                SELECT 'SKU' sellable_type,s.id sellable_id,s.sku_code code,p.name,p.category,
                       p.description,p.image_url,o.price,o.currency,s.size,s.flavor,
                       COALESCE(i.on_hand-i.reserved,0) available_count
                FROM cluster_concession_offer o
                JOIN concession_sku s ON o.sellable_type='SKU' AND s.id=o.sellable_id
                JOIN concession_product p ON p.id=s.product_id
                LEFT JOIN cluster_inventory i
                    ON i.cinema_cluster_id=o.cinema_cluster_id AND i.sku_id=s.id
                WHERE o.cinema_cluster_id=? AND o.available AND s.active AND p.active
                  AND (o.effective_from IS NULL OR o.effective_from<=?)
                  AND (o.effective_to IS NULL OR o.effective_to>?)
                ORDER BY p.category,p.name,s.size,s.flavor
                """, (rs, n) -> new CatalogItemResponse(
                "SKU", rs.getLong("sellable_id"), rs.getString("code"), rs.getString("name"),
                rs.getString("category"), rs.getString("description"), rs.getString("image_url"),
                rs.getBigDecimal("price"), rs.getString("currency"),
                availability(rs.getInt("available_count")), rs.getString("size"),
                rs.getString("flavor"), List.of()), clusterId, now, now));

        List<Map<String, Object>> comboRows = jdbc.queryForList("""
                SELECT c.id sellable_id,c.code,c.name,c.description,c.image_url,o.price,o.currency
                FROM cluster_concession_offer o
                JOIN concession_combo c ON o.sellable_type='COMBO' AND c.id=o.sellable_id
                WHERE o.cinema_cluster_id=? AND o.available AND c.active
                  AND (o.effective_from IS NULL OR o.effective_from<=?)
                  AND (o.effective_to IS NULL OR o.effective_to>?)
                ORDER BY c.name
                """, clusterId, now, now);
        for (Map<String, Object> row : comboRows) {
            Long comboId = ((Number) row.get("sellable_id")).longValue();
            List<ComboComponentResponse> components = catalogComponents(comboId, clusterId);
            int available = comboAvailability(clusterId, components);
            result.add(new CatalogItemResponse(
                    "COMBO", comboId, (String) row.get("code"), (String) row.get("name"),
                    "COMBOS", (String) row.get("description"), (String) row.get("image_url"),
                    (BigDecimal) row.get("price"), (String) row.get("currency"),
                    availability(available), null, null, components));
        }
        result.sort(Comparator.comparing(CatalogItemResponse::category)
                .thenComparing(CatalogItemResponse::name));
        return result;
    }

    private List<ComboComponentResponse> catalogComponents(long comboId, Long clusterId) {
        return jdbc.query("""
                SELECT c.group_code,c.allowed_sku_id,s.sku_code,
                       CONCAT(p.name,
                           CASE WHEN s.size IS NULL THEN '' ELSE ' '||s.size END,
                           CASE WHEN s.flavor IS NULL THEN '' ELSE ' · '||s.flavor END) label,
                       c.quantity,c.min_select,c.max_select,
                       COALESCE(i.on_hand-i.reserved,0) available_count
                FROM concession_combo_component c
                JOIN concession_sku s ON s.id=c.allowed_sku_id
                JOIN concession_product p ON p.id=s.product_id
                LEFT JOIN cluster_inventory i
                    ON i.cinema_cluster_id=? AND i.sku_id=c.allowed_sku_id
                WHERE c.combo_id=? ORDER BY c.group_code,s.sku_code
                """, (rs, n) -> new ComboComponentResponse(
                rs.getString("group_code"), rs.getLong("allowed_sku_id"),
                rs.getString("sku_code"), rs.getString("label"), rs.getInt("quantity"),
                rs.getInt("min_select"), rs.getInt("max_select"),
                rs.getInt("available_count")), clusterId, comboId);
    }

    private int comboAvailability(Long clusterId, List<ComboComponentResponse> components) {
        int result = Integer.MAX_VALUE;
        Map<String, List<ComboComponentResponse>> groups = components.stream()
                .collect(Collectors.groupingBy(ComboComponentResponse::groupCode));
        for (List<ComboComponentResponse> group : groups.values()) {
            int required = Math.max(1, group.getFirst().minSelect());
            int selectableUnits = group.stream().mapToInt(component -> {
                int availableCount = component.availableCount() == null
                        ? jdbc.query("""
                            SELECT COALESCE(on_hand-reserved,0) FROM cluster_inventory
                            WHERE cinema_cluster_id=? AND sku_id=?
                            """, rs -> rs.next() ? rs.getInt(1) : 0,
                            clusterId, component.allowedSkuId())
                        : component.availableCount();
                return availableCount / Math.max(1, component.quantity());
            }).sum();
            result = Math.min(result, selectableUnits / required);
        }
        return result == Integer.MAX_VALUE ? 0 : result;
    }

    @Transactional
    public ReservationResponse reserve(ReservationRequest request) {
        acquireTransactionLock("idempotency:" + request.idempotencyKey());
        acquireTransactionLock("booking:" + request.bookingId());
        String requestHash = sha256(json(request));
        List<String> existing = jdbc.query("""
                SELECT id,request_hash FROM concession_reservation WHERE idempotency_key=?
                """, (rs, n) -> rs.getString("id") + "|" + rs.getString("request_hash"),
                request.idempotencyKey());
        if (!existing.isEmpty()) {
            String[] parts = existing.getFirst().split("\\|", 2);
            if (!parts[1].equals(requestHash)) throw new AppException(IDEMPOTENCY_CONFLICT);
            return reservation(parts[0], true);
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        OffsetDateTime expiresAt = now.plusSeconds(reservationTtlSeconds);
        if (request.checkoutExpiresAt() != null && request.checkoutExpiresAt().isBefore(expiresAt)) {
            expiresAt = request.checkoutExpiresAt();
        }
        if (!expiresAt.isAfter(now)) throw new AppException(EXPIRED);

        List<PreparedLine> lines = new ArrayList<>();
        Map<Long, Integer> stock = new TreeMap<>();
        String reservationCurrency = null;
        for (ReservationItemRequest item : request.items()) {
            PreparedLine line = prepareLine(request.cinemaClusterId(), item, now, stock);
            if (reservationCurrency == null) reservationCurrency = line.currency();
            if (!reservationCurrency.equals(line.currency())) throw new AppException(INVALID_REQUEST);
            lines.add(line);
        }

        lockAndReserveStock(request.cinemaClusterId(), stock);
        String reservationId = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO concession_reservation
                    (id,booking_id,customer_id,cinema_cluster_id,status,expires_at,
                     idempotency_key,request_hash,currency)
                VALUES (?,?,?,?, 'RESERVED', ?,?,?,?)
                """, reservationId, request.bookingId(), request.customerId(),
                request.cinemaClusterId(), expiresAt, request.idempotencyKey(),
                requestHash, reservationCurrency);
        for (PreparedLine line : lines) {
            jdbc.update("""
                    INSERT INTO concession_reservation_item
                        (reservation_id,item_code_snapshot,item_name_snapshot,options_snapshot,
                         quantity,unit_price_snapshot,discount_amount,final_amount)
                    VALUES (?,?,?,?,?,?,0,?)
                    """, reservationId, line.code(), line.name(), line.options(),
                    line.quantity(), line.unitPrice(), line.finalAmount());
        }
        stock.forEach((skuId, quantity) -> jdbc.update("""
                INSERT INTO concession_reservation_stock(reservation_id,sku_id,quantity)
                VALUES (?,?,?)
                """, reservationId, skuId, quantity));
        return reservation(reservationId, false);
    }

    private PreparedLine prepareLine(
            Long clusterId,
            ReservationItemRequest item,
            OffsetDateTime now,
            Map<Long, Integer> stock) {
        String type = sellableType(item.sellableType());
        OfferSnapshot offer = offer(clusterId, type, item.sellableId(), now);
        if ("SKU".equals(type)) {
            SkuSnapshot sku = skuSnapshot(item.sellableId());
            stock.merge(sku.id(), item.quantity(), Integer::sum);
            String options = StreamText.options(sku.size(), sku.flavor());
            return new PreparedLine(sku.code(), sku.productName(), options, item.quantity(),
                    offer.price(), offer.price().multiply(BigDecimal.valueOf(item.quantity())),
                    offer.currency());
        }

        ComboSnapshot combo = comboSnapshot(item.sellableId());
        List<ComboComponentResponse> allowed = components(item.sellableId());
        Map<String, List<ComboComponentResponse>> byGroup = allowed.stream()
                .collect(Collectors.groupingBy(ComboComponentResponse::groupCode));
        Map<String, List<Long>> selected = (item.selections() == null ? List.<SelectionRequest>of() : item.selections())
                .stream().collect(Collectors.toMap(
                        selection -> normalizedCode(selection.groupCode()),
                        SelectionRequest::skuIds,
                        (a, b) -> { throw new AppException(INVALID_REQUEST); }));
        List<String> optionLabels = new ArrayList<>();
        for (Map.Entry<String, List<ComboComponentResponse>> group : byGroup.entrySet()) {
            int min = group.getValue().getFirst().minSelect();
            int max = group.getValue().getFirst().maxSelect();
            List<Long> choices = selected.getOrDefault(group.getKey(), List.of());
            if (choices.size() < min || choices.size() > max) throw new AppException(INVALID_REQUEST);
            Map<Long, ComboComponentResponse> permitted = group.getValue().stream()
                    .collect(Collectors.toMap(ComboComponentResponse::allowedSkuId, component -> component));
            for (Long skuId : choices) {
                ComboComponentResponse component = permitted.get(skuId);
                if (component == null) throw new AppException(INVALID_REQUEST);
                int units = component.quantity() * item.quantity();
                stock.merge(skuId, units, Integer::sum);
                optionLabels.add(group.getKey() + ": " + component.label());
            }
        }
        if (!selected.keySet().equals(byGroup.keySet())) throw new AppException(INVALID_REQUEST);
        return new PreparedLine(combo.code(), combo.name(), String.join(", ", optionLabels),
                item.quantity(), offer.price(),
                offer.price().multiply(BigDecimal.valueOf(item.quantity())), offer.currency());
    }

    private void lockAndReserveStock(Long clusterId, Map<Long, Integer> stock) {
        for (Map.Entry<Long, Integer> entry : stock.entrySet()) {
            List<int[]> rows = jdbc.query("""
                    SELECT on_hand,reserved FROM cluster_inventory
                    WHERE cinema_cluster_id=? AND sku_id=? FOR UPDATE
                    """, (rs, n) -> new int[]{rs.getInt("on_hand"), rs.getInt("reserved")},
                    clusterId, entry.getKey());
            if (rows.isEmpty() || rows.getFirst()[0] - rows.getFirst()[1] < entry.getValue()) {
                throw new AppException(NOT_AVAILABLE);
            }
        }
        stock.forEach((skuId, quantity) -> jdbc.update("""
                UPDATE cluster_inventory SET reserved=reserved+?,version=version+1,
                    updated_at=CURRENT_TIMESTAMP
                WHERE cinema_cluster_id=? AND sku_id=?
                """, quantity, clusterId, skuId));
    }

    @Transactional(readOnly = true)
    public ReservationResponse reservation(String id, boolean replayed) {
        Map<String, Object> reservation = oneMap("""
                SELECT id,booking_id,cinema_cluster_id,status,expires_at,currency
                FROM concession_reservation WHERE id=?
                """, id);
        List<ReservationLineResponse> lines = lines(
                "concession_reservation_item", "reservation_id", id);
        return new ReservationResponse(
                (String) reservation.get("id"), (String) reservation.get("booking_id"),
                ((Number) reservation.get("cinema_cluster_id")).longValue(),
                (String) reservation.get("status"),
                ((java.sql.Timestamp) reservation.get("expires_at")).toInstant().atOffset(ZoneOffset.UTC),
                total(lines), (String) reservation.get("currency"), replayed, lines);
    }

    @Transactional(readOnly = true)
    public void requireReservationOwner(String reservationId, String accountId) {
        Integer owned = jdbc.queryForObject("""
                SELECT COUNT(*) FROM concession_reservation
                WHERE id=? AND customer_id=?
                """, Integer.class, reservationId, accountId);
        if (owned == null || owned == 0) {
            throw new AppException(RESERVATION_ACCESS_DENIED);
        }
    }

    @Transactional
    public OrderResponse confirm(String reservationId, ConfirmRequest request) {
        Map<String, Object> reservation = lockedReservation(reservationId);
        String status = (String) reservation.get("status");
        if ("CONFIRMED".equals(status)) return orderByReservation(reservationId);
        if (!"RESERVED".equals(status)) throw new AppException(INVALID_STATE);
        OffsetDateTime expiresAt = ((java.sql.Timestamp) reservation.get("expires_at"))
                .toInstant().atOffset(ZoneOffset.UTC);
        if (!expiresAt.isAfter(OffsetDateTime.now(ZoneOffset.UTC))) {
            releaseLocked(reservation, "EXPIRED");
            throw new AppException(EXPIRED);
        }

        Long clusterId = ((Number) reservation.get("cinema_cluster_id")).longValue();
        List<Map<String, Object>> stock = jdbc.queryForList("""
                SELECT sku_id,quantity FROM concession_reservation_stock WHERE reservation_id=?
                ORDER BY sku_id
                """, reservationId);
        for (Map<String, Object> row : stock) {
            jdbc.update("""
                    UPDATE cluster_inventory
                    SET on_hand=on_hand-?,reserved=reserved-?,version=version+1,
                        updated_at=CURRENT_TIMESTAMP
                    WHERE cinema_cluster_id=? AND sku_id=? AND reserved>=? AND on_hand>=?
                    """, row.get("quantity"), row.get("quantity"), clusterId, row.get("sku_id"),
                    row.get("quantity"), row.get("quantity"));
        }
        jdbc.update("""
                UPDATE concession_reservation SET status='CONFIRMED',updated_at=CURRENT_TIMESTAMP
                WHERE id=?
                """, reservationId);
        String orderId = UUID.randomUUID().toString();
        OffsetDateTime paidAt = request != null && request.paidAt() != null
                ? request.paidAt() : OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("""
                INSERT INTO concession_order
                    (id,reservation_id,booking_id,payment_id,cinema_cluster_id,pickup_code,
                     status,currency,paid_at)
                VALUES (?,?,?,?,?,?,'PAID',?,?)
                """, orderId, reservationId, reservation.get("booking_id"),
                request == null ? null : request.paymentId(), clusterId, pickupCode(),
                reservation.get("currency"), paidAt);
        jdbc.update("""
                INSERT INTO concession_order_item
                    (order_id,item_code_snapshot,item_name_snapshot,options_snapshot,quantity,
                     unit_price,discount_amount,final_amount)
                SELECT ?,item_code_snapshot,item_name_snapshot,options_snapshot,quantity,
                       unit_price_snapshot,discount_amount,final_amount
                FROM concession_reservation_item WHERE reservation_id=?
                """, orderId, reservationId);
        return order(orderId);
    }

    @Transactional
    public ReservationResponse release(String reservationId, boolean expired) {
        Map<String, Object> reservation = lockedReservation(reservationId);
        String status = (String) reservation.get("status");
        if ("RELEASED".equals(status) || "EXPIRED".equals(status)) {
            return reservation(reservationId, true);
        }
        if (!"RESERVED".equals(status)) throw new AppException(INVALID_STATE);
        releaseLocked(reservation, expired ? "EXPIRED" : "RELEASED");
        return reservation(reservationId, false);
    }

    private void releaseLocked(Map<String, Object> reservation, String status) {
        String reservationId = (String) reservation.get("id");
        Long clusterId = ((Number) reservation.get("cinema_cluster_id")).longValue();
        jdbc.update("""
                UPDATE cluster_inventory i
                SET reserved=i.reserved-s.quantity,version=i.version+1,updated_at=CURRENT_TIMESTAMP
                FROM concession_reservation_stock s
                WHERE s.reservation_id=? AND i.cinema_cluster_id=? AND i.sku_id=s.sku_id
                  AND i.reserved>=s.quantity
                """, reservationId, clusterId);
        jdbc.update("""
                UPDATE concession_reservation SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
                """, status, reservationId);
    }

    @Scheduled(fixedDelayString = "${concession.reservation.expiry-delay-ms:30000}")
    public void expireReservations() {
        List<String> due = jdbc.query("""
                SELECT id FROM concession_reservation
                WHERE status='RESERVED' AND expires_at<=CURRENT_TIMESTAMP
                ORDER BY expires_at LIMIT 100
                """, (rs, n) -> rs.getString(1));
        for (String id : due) {
            try {
                transactionTemplate.executeWithoutResult(status -> release(id, true));
            } catch (RuntimeException ignored) {
                // Another request may have confirmed/released the row after this scan.
            }
        }
    }

    private void acquireTransactionLock(String key) {
        jdbc.query(
                "SELECT pg_advisory_xact_lock(hashtext(?))",
                resultSet -> null,
                key);
    }

    public List<OrderResponse> orders(Long clusterId, String status) {
        String normalized = status == null || status.isBlank()
                ? null : status.trim().toUpperCase(Locale.ROOT);
        List<String> ids = normalized == null
                ? jdbc.query("""
                    SELECT id FROM concession_order WHERE cinema_cluster_id=?
                    ORDER BY paid_at,id
                    """, (rs, n) -> rs.getString(1), clusterId)
                : jdbc.query("""
                    SELECT id FROM concession_order WHERE cinema_cluster_id=? AND status=?
                    ORDER BY paid_at,id
                    """, (rs, n) -> rs.getString(1), clusterId, normalized);
        return ids.stream().map(this::order).toList();
    }

    @Transactional
    public OrderResponse transitionOrder(String orderId, String action, Long authorizedClusterId) {
        Map<String, Object> current = oneMap("""
                SELECT id,cinema_cluster_id,status FROM concession_order WHERE id=? FOR UPDATE
                """, orderId);
        Long clusterId = ((Number) current.get("cinema_cluster_id")).longValue();
        if (authorizedClusterId != null && !authorizedClusterId.equals(clusterId)) {
            throw new AppException(CLUSTER_ACCESS_DENIED);
        }
        String next = switch (action.toLowerCase(Locale.ROOT)) {
            case "prepare" -> "PREPARING";
            case "ready" -> "READY";
            case "collect" -> "COLLECTED";
            default -> throw new AppException(INVALID_REQUEST);
        };
        String transition = current.get("status") + "->" + next;
        if (!ORDER_TRANSITIONS.contains(transition)) throw new AppException(INVALID_STATE);
        jdbc.update("""
                UPDATE concession_order SET status=?,ready_at=CASE WHEN ?='READY'
                    THEN CURRENT_TIMESTAMP ELSE ready_at END,
                    collected_at=CASE WHEN ?='COLLECTED' THEN CURRENT_TIMESTAMP ELSE collected_at END,
                    updated_at=CURRENT_TIMESTAMP WHERE id=?
                """, next, next, next, orderId);
        return order(orderId);
    }

    public OrderResponse order(String id) {
        Map<String, Object> order = oneMap("""
                SELECT id,booking_id,payment_id,cinema_cluster_id,pickup_code,status,currency,
                       paid_at,ready_at,collected_at
                FROM concession_order WHERE id=?
                """, id);
        List<ReservationLineResponse> lines = lines("concession_order_item", "order_id", id);
        return new OrderResponse(
                (String) order.get("id"), (String) order.get("booking_id"),
                (String) order.get("payment_id"),
                ((Number) order.get("cinema_cluster_id")).longValue(),
                (String) order.get("pickup_code"), (String) order.get("status"),
                mapOffset(order.get("paid_at")), mapOffset(order.get("ready_at")),
                mapOffset(order.get("collected_at")), total(lines),
                (String) order.get("currency"), lines);
    }

    private OrderResponse orderByReservation(String reservationId) {
        List<String> ids = jdbc.query(
                "SELECT id FROM concession_order WHERE reservation_id=?",
                (rs, n) -> rs.getString(1), reservationId);
        return ids.isEmpty() ? throwNotFound() : order(ids.getFirst());
    }

    private List<ReservationLineResponse> lines(String table, String foreignKey, String id) {
        String unitColumn = table.equals("concession_order_item") ? "unit_price" : "unit_price_snapshot";
        String sql = "SELECT item_code_snapshot,item_name_snapshot,options_snapshot,quantity,"
                + unitColumn + " AS unit_price,discount_amount,final_amount FROM "
                + table + " WHERE " + foreignKey + "=? ORDER BY id";
        return jdbc.query(sql, (rs, n) -> new ReservationLineResponse(
                rs.getString("item_code_snapshot"), rs.getString("item_name_snapshot"),
                rs.getString("options_snapshot"), rs.getInt("quantity"),
                rs.getBigDecimal("unit_price"), rs.getBigDecimal("discount_amount"),
                rs.getBigDecimal("final_amount")), id);
    }

    private OfferSnapshot offer(Long clusterId, String type, Long id, OffsetDateTime now) {
        List<OfferSnapshot> rows = jdbc.query("""
                SELECT price,currency FROM cluster_concession_offer
                WHERE cinema_cluster_id=? AND sellable_type=? AND sellable_id=? AND available
                  AND (effective_from IS NULL OR effective_from<=?)
                  AND (effective_to IS NULL OR effective_to>?)
                """, (rs, n) -> new OfferSnapshot(
                rs.getBigDecimal("price"), rs.getString("currency")),
                clusterId, type, id, now, now);
        return rows.isEmpty() ? throwUnavailable() : rows.getFirst();
    }

    private SkuSnapshot skuSnapshot(Long id) {
        List<SkuSnapshot> rows = jdbc.query("""
                SELECT s.id,s.sku_code,s.size,s.flavor,p.name
                FROM concession_sku s JOIN concession_product p ON p.id=s.product_id
                WHERE s.id=? AND s.active AND p.active
                """, (rs, n) -> new SkuSnapshot(
                rs.getLong("id"), rs.getString("sku_code"), rs.getString("name"),
                rs.getString("size"), rs.getString("flavor")), id);
        return rows.isEmpty() ? throwUnavailable() : rows.getFirst();
    }

    private ComboSnapshot comboSnapshot(Long id) {
        List<ComboSnapshot> rows = jdbc.query("""
                SELECT code,name FROM concession_combo WHERE id=? AND active
                """, (rs, n) -> new ComboSnapshot(rs.getString("code"), rs.getString("name")), id);
        return rows.isEmpty() ? throwUnavailable() : rows.getFirst();
    }

    private Map<String, Object> lockedReservation(String id) {
        return oneMap("""
                SELECT id,booking_id,cinema_cluster_id,status,expires_at,currency
                FROM concession_reservation WHERE id=? FOR UPDATE
                """, id);
    }

    private Map<String, Object> oneMap(String sql, Object... args) {
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        if (rows.isEmpty()) throw new AppException(NOT_FOUND);
        return rows.getFirst();
    }

    private void requireProduct(Long id) {
        if (Boolean.FALSE.equals(jdbc.query(
                "SELECT EXISTS(SELECT 1 FROM concession_product WHERE id=?)",
                rs -> rs.next() && rs.getBoolean(1), id))) throw new AppException(NOT_FOUND);
    }

    private ProductWorkflow productWorkflow(Long id, boolean lock) {
        String sql = """
                SELECT status,created_by
                FROM concession_product
                WHERE id=?
                """ + (lock ? " FOR UPDATE" : "");
        List<ProductWorkflow> rows = jdbc.query(
                sql,
                (rs, n) -> new ProductWorkflow(
                        rs.getString("status"), rs.getString("created_by")),
                id);
        if (rows.isEmpty()) throw new AppException(NOT_FOUND);
        return rows.getFirst();
    }

    private void requireProductEditor(
            ProductWorkflow workflow, String actor, boolean administrator) {
        if (!administrator && !Objects.equals(workflow.createdBy(), actor)) {
            throw new AppException(CATALOG_ACCESS_DENIED);
        }
        if ("ARCHIVED".equals(workflow.status())) {
            throw new AppException(PRODUCT_WORKFLOW_INVALID);
        }
    }

    private void requireEditableProduct(
            Long productId, String actor, boolean administrator) {
        ProductWorkflow workflow = productWorkflow(productId, false);
        requireProductEditor(workflow, actor, administrator);
        if ("PENDING_APPROVAL".equals(workflow.status())
                || "ARCHIVED".equals(workflow.status())
                || (!administrator && "ACTIVE".equals(workflow.status()))) {
            throw new AppException(PRODUCT_WORKFLOW_INVALID);
        }
    }

    private void requireSku(Long id) {
        if (Boolean.FALSE.equals(jdbc.query(
                "SELECT EXISTS(SELECT 1 FROM concession_sku WHERE id=?)",
                rs -> rs.next() && rs.getBoolean(1), id))) throw new AppException(NOT_FOUND);
    }

    private void requireSellable(String type, Long id) {
        if ("SKU".equals(type)) requireSku(id);
        else if (jdbc.query(
                "SELECT EXISTS(SELECT 1 FROM concession_combo WHERE id=?)",
                rs -> rs.next() && rs.getBoolean(1), id).equals(Boolean.FALSE)) {
            throw new AppException(NOT_FOUND);
        }
    }

    private void requireChanged(int changed) {
        if (changed == 0) throw new AppException(NOT_FOUND);
    }

    private <T> T one(List<T> rows) {
        if (rows.isEmpty()) throw new AppException(NOT_FOUND);
        return rows.getFirst();
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new AppException(INVALID_REQUEST);
        }
    }

    private Map<String, Object> readMap(String json) {
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (JsonProcessingException exception) {
            return Map.of();
        }
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private String pickupCode() {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder value = new StringBuilder("CP-");
            for (int i = 0; i < 6; i++) {
                value.append(alphabet.charAt(java.util.concurrent.ThreadLocalRandom.current()
                        .nextInt(alphabet.length())));
            }
            Boolean exists = jdbc.query(
                    "SELECT EXISTS(SELECT 1 FROM concession_order WHERE pickup_code=?)",
                    rs -> rs.next() && rs.getBoolean(1), value.toString());
            if (!Boolean.TRUE.equals(exists)) return value.toString();
        }
        return "CP-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);
    }

    private String normalizedCode(String value) {
        return value.trim().toUpperCase(Locale.ROOT).replace(' ', '-');
    }

    private String sellableType(String value) {
        String normalized = normalizedCode(value);
        if (!Set.of("SKU", "COMBO").contains(normalized)) throw new AppException(INVALID_REQUEST);
        return normalized;
    }

    private String currency(String value) {
        return value == null || value.isBlank() ? "VND" : value.trim().toUpperCase(Locale.ROOT);
    }

    private boolean active(Boolean value) {
        return value == null || value;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String availability(int count) {
        if (count <= 0) return "SOLD_OUT";
        return count <= 5 ? "LOW_AVAILABILITY" : "AVAILABLE";
    }

    private BigDecimal total(List<ReservationLineResponse> lines) {
        return lines.stream().map(ReservationLineResponse::finalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private OffsetDateTime offset(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, OffsetDateTime.class);
    }

    private Boolean nullableBoolean(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, Boolean.class);
    }

    private Long nullableLong(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, Long.class);
    }

    private OffsetDateTime mapOffset(Object value) {
        return value == null ? null
                : ((java.sql.Timestamp) value).toInstant().atOffset(ZoneOffset.UTC);
    }

    private <T> T throwUnavailable() {
        throw new AppException(NOT_AVAILABLE);
    }

    private <T> T throwNotFound() {
        throw new AppException(NOT_FOUND);
    }

    private record OfferSnapshot(BigDecimal price, String currency) {}
    private record ProductWorkflow(String status, String createdBy) {}
    private record SkuSnapshot(Long id, String code, String productName, String size, String flavor) {}
    private record ComboSnapshot(String code, String name) {}
    private record PreparedLine(
            String code, String name, String options, int quantity,
            BigDecimal unitPrice, BigDecimal finalAmount, String currency) {}

    private static final class StreamText {
        private static String options(String size, String flavor) {
            return java.util.stream.Stream.of(size, flavor)
                    .filter(Objects::nonNull).filter(value -> !value.isBlank())
                    .collect(Collectors.joining(" · "));
        }
    }
}
