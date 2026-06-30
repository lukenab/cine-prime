package movieservice.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movieservice.entity.MovieActionLog;
import movieservice.repository.MovieActionLogRepository;
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class AuditLogService {

    MovieActionLogRepository movieActionLogRepository;

    public void logAction(String accountId, String actor, String note, String content) {
        // Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        // String actor = authentication.getName();
        MovieActionLog log = new MovieActionLog();
        log.setAccountId(accountId);
        log.setActor(actor);
        log.setNote(note);
        log.setActionDescription(content);
        log.setTimestamp(LocalDateTime.now());
        movieActionLogRepository.save(log);
    }
}
