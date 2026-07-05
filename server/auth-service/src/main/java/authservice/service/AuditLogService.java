package authservice.service;

import authservice.entity.AuditLog;
import authservice.repository.AuthAuditLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AuditLogService {
    AuthAuditLogRepository authAuditLogRepository;
    ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void success(String action, String targetAccountId, String message, Map<String, Object> metadata) {
        log(action, "SUCCESS", targetAccountId, message, metadata);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void failed(String action, String targetAccountId, String message, Map<String, Object> metadata) {
        log(action, "FAILED", targetAccountId, message, metadata);
    }

    public Map<String, Object> metadata(Object... keyValues) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            metadata.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
        }
        return metadata;
    }

    private void log(String action, String status, String targetAccountId, String message, Map<String, Object> metadata) {
        try {
            HttpServletRequest request = currentRequest();

            authAuditLogRepository.save(AuditLog.builder()
                    .actorAccountId(currentActorAccountId())
                    .targetAccountId(targetAccountId)
                    .action(action)
                    .status(status)
                    .message(message)
                    .ipAddress(resolveIpAddress(request))
                    .userAgent(request != null ? request.getHeader("User-Agent") : null)
                    .metadata(toJson(metadata))
                    .build());
        } catch (Exception e) {
            log.warn("Failed to write auth audit log for action {}: {}", action, e.getMessage());
        }
    }

    private String currentActorAccountId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return null;
        }
        if (authentication.getPrincipal() instanceof Jwt jwt) {
            String accountId = jwt.getClaimAsString("accountId");
            return accountId != null ? accountId : jwt.getSubject();
        }
        return authentication.getName();
    }

    private HttpServletRequest currentRequest() {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attrs != null ? attrs.getRequest() : null;
    }

    private String resolveIpAddress(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String toJson(Map<String, Object> metadata) throws JsonProcessingException {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        return objectMapper.writeValueAsString(metadata);
    }
}
