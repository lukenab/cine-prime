package authservice.aspect;

import authservice.annotation.Auditable;
import authservice.service.AuditLogService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.util.Map;

@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AuditAspect {

    AuditLogService auditLogService;

    @Around("@annotation(auditable)")
    public Object audit(ProceedingJoinPoint pjp, Auditable auditable) throws Throwable {
        Map<String, Object> meta = extractMetadata(pjp.getArgs());

        try {
            Object result = pjp.proceed();
            auditLogService.success(auditable.action(), null, auditable.successMessage(), meta);
            return result;

        } catch (AppException e) {
            auditLogService.failed(auditable.action(), null, e.getMessage(), meta);
            throw e;

        } catch (Exception e) {
            log.error("Unexpected error during [{}]", auditable.action(), e);
            auditLogService.failed(auditable.action(), null, "Unexpected error", meta);
            throw e;
        }
    }

    private Map<String, Object> extractMetadata(Object[] args) {
        Map<String, Object> meta = new java.util.LinkedHashMap<>();
        for (Object arg : args) {
            if (arg == null) continue;
            tryExtract(arg, "getUsername", "username", meta);
            tryExtract(arg, "getEmail",    "email",    meta);
        }
        return meta.isEmpty() ? null : meta;
    }

    private void tryExtract(Object obj, String methodName, String key,
                            Map<String, Object> meta) {
        try {
            Object value = obj.getClass().getMethod(methodName).invoke(obj);
            if (value != null) meta.put(key, value);
        } catch (Exception ignored) {
        }
    }
}