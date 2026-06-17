package userservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.FieldNameConstants;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import userservice.entity.AuditLog;
import userservice.repository.AuditLogRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AuditLogService {
    AuditLogRepository auditLogRepository;
    ObjectMapper objectMapper;

    public void log (String entityName,
                     String entityId,
                     String action,
                     Object oldValue,
                     Object newValue,
                     String performBy){
        try {
            AuditLog auditLog = AuditLog.builder()
                    .entityName(entityName)
                    .entityId(entityId)
                    .action(action)
                    .oldValue(oldValue != null ?
                            objectMapper.writeValueAsString(oldValue) : null)
                    .newValue(newValue != null ?
                            objectMapper.writeValueAsString(newValue) : null)
                    .performBy(performBy)
                    .performAt(LocalDateTime.now())
                    .build();

            auditLogRepository.save(auditLog);
        } catch (JsonProcessingException e){
            log.error("Failed to save audit log for entity: {}, id: {}", entityName, entityId);
        }
    }
}
