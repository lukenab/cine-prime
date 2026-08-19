package authservice.service;

import authservice.dto.response.AuditEventResponse;
import authservice.entity.AuditLog;
import authservice.repository.AuthAuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuditEventQueryService {
    private final AuthAuditLogRepository repository;

    public Page<AuditEventResponse> search(String action, String status, String actorAccountId,
                                           String targetAccountId, LocalDateTime from,
                                           LocalDateTime to, String metadataContains, Pageable pageable) {
        Specification<AuditLog> spec = Specification.where(null);
        if (StringUtils.hasText(action)) spec = spec.and(eq("action", action.trim().toUpperCase()));
        if (StringUtils.hasText(status)) spec = spec.and(eq("status", status.trim().toUpperCase()));
        if (StringUtils.hasText(actorAccountId)) spec = spec.and(eq("actorAccountId", actorAccountId.trim()));
        if (StringUtils.hasText(targetAccountId)) spec = spec.and(eq("targetAccountId", targetAccountId.trim()));
        if (from != null) spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from));
        if (to != null) spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), to));
        if (StringUtils.hasText(metadataContains)) {
            String pattern = "%" + metadataContains.trim().toLowerCase() + "%";
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("metadata")), pattern));
        }
        return repository.findAll(spec, pageable).map(this::response);
    }

    public AuditEventResponse get(String id) {
        return repository.findById(id).map(this::response)
                .orElseThrow(() -> new movie.theater.common.exception.AppException(
                        authservice.exception.AuthErrorCode.AUDIT_EVENT_NOT_FOUND));
    }

    private Specification<AuditLog> eq(String field, String value) {
        return (root, query, cb) -> cb.equal(root.get(field), value);
    }

    private AuditEventResponse response(AuditLog item) {
        return AuditEventResponse.builder().auditId(item.getAuditId())
                .actorAccountId(item.getActorAccountId()).targetAccountId(item.getTargetAccountId())
                .action(item.getAction()).status(item.getStatus()).message(item.getMessage())
                .ipAddress(item.getIpAddress()).userAgent(item.getUserAgent()).metadata(item.getMetadata())
                .createdAt(item.getCreatedAt()).build();
    }
}
