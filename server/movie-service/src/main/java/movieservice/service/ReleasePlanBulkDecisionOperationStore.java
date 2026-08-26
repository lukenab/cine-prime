package movieservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.entity.ReleasePlanBulkDecisionOperation;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.ReleasePlanBulkDecisionOperationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ReleasePlanBulkDecisionOperationStore {
    private final ReleasePlanBulkDecisionOperationRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Claim claim(String actor, String key, String requestHash) {
        repository.acquireIdempotencyLock(actor, key);
        Optional<ReleasePlanBulkDecisionOperation> existing = repository.findByActorAndIdempotencyKey(actor, key);
        if (existing.isPresent()) return resolve(existing.get(), requestHash);

        ReleasePlanBulkDecisionOperation created = repository.saveAndFlush(
                ReleasePlanBulkDecisionOperation.builder()
                        .actor(actor)
                        .idempotencyKey(key)
                        .requestHash(requestHash)
                        .status("PENDING")
                        .createdAt(LocalDateTime.now())
                        .build());
        return new Claim(created.getOperationId(), null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(Long operationId, String responseJson) {
        ReleasePlanBulkDecisionOperation operation = repository.findById(operationId).orElseThrow();
        operation.setStatus("COMPLETED");
        operation.setResponseJson(responseJson);
        operation.setCompletedAt(LocalDateTime.now());
        repository.save(operation);
    }

    private Claim resolve(ReleasePlanBulkDecisionOperation operation, String requestHash) {
        if (!operation.getRequestHash().equals(requestHash)) {
            throw new AppException(MovieErrorCode.RELEASE_PLAN_BULK_IDEMPOTENCY_CONFLICT);
        }
        if (!"COMPLETED".equals(operation.getStatus()) || operation.getResponseJson() == null) {
            throw new AppException(MovieErrorCode.RELEASE_PLAN_BULK_OPERATION_IN_PROGRESS);
        }
        return new Claim(operation.getOperationId(), operation.getResponseJson());
    }

    public record Claim(Long operationId, String replayJson) {
        public boolean replay() { return replayJson != null; }
    }
}
