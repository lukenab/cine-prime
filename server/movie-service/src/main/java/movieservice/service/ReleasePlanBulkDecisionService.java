package movieservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.BulkReleasePlanDecisionRequest;
import movieservice.dto.response.BulkReleasePlanDecisionResponse;
import movieservice.dto.response.MovieAvailabilityResponse;
import movieservice.exception.MovieErrorCode;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReleasePlanBulkDecisionService {
    private final MovieAvailabilityService availabilityService;
    private final ReleasePlanBulkDecisionOperationStore operationStore;
    private final ObjectMapper objectMapper;

    public BulkReleasePlanDecisionResponse decide(
            BulkReleasePlanDecisionRequest request,
            String actor,
            String idempotencyKey) {
        String key = normalizeKey(idempotencyKey);
        String requestHash = fingerprint(request);
        ReleasePlanBulkDecisionOperationStore.Claim claim = operationStore.claim(actor, key, requestHash);
        if (claim.replay()) return readResponse(claim.replayJson());

        List<MovieAvailabilityResponse> succeeded = new ArrayList<>();
        List<BulkReleasePlanDecisionResponse.Failure> failed = new ArrayList<>();

        for (BulkReleasePlanDecisionRequest.PlanVersion plan : request.getPlans()) {
            try {
                succeeded.add(availabilityService.approve(
                        plan.getAvailabilityId(), plan.getExpectedVersion(), actor, request.getNote()));
            } catch (AppException failure) {
                failed.add(BulkReleasePlanDecisionResponse.Failure.builder()
                        .availabilityId(plan.getAvailabilityId())
                        .code(failure.getErrorCode().getCode())
                        .reason(failure.getErrorCode().getMessage())
                        .build());
            } catch (RuntimeException failure) {
                failed.add(BulkReleasePlanDecisionResponse.Failure.builder()
                        .availabilityId(plan.getAvailabilityId())
                        .code(1003)
                        .reason("The release plan could not be approved.")
                        .build());
            }
        }

        BulkReleasePlanDecisionResponse response = BulkReleasePlanDecisionResponse.builder()
                .operationKey(key)
                .succeeded(succeeded)
                .failed(failed)
                .build();
        operationStore.complete(claim.operationId(), writeResponse(response));
        return response;
    }

    private String normalizeKey(String key) {
        if (key == null || key.isBlank() || key.length() > 128) {
            throw new AppException(MovieErrorCode.RELEASE_PLAN_BULK_IDEMPOTENCY_KEY_REQUIRED);
        }
        return key.trim();
    }

    private String fingerprint(BulkReleasePlanDecisionRequest request) {
        String plans = request.getPlans().stream()
                .sorted(Comparator.comparing(BulkReleasePlanDecisionRequest.PlanVersion::getAvailabilityId))
                .map(plan -> plan.getAvailabilityId() + ":" + plan.getExpectedVersion())
                .reduce((left, right) -> left + "," + right)
                .orElse("");
        String canonical = request.getDecision().name() + "|" + plans + "|" + (request.getNote() == null ? "" : request.getNote().trim());
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private String writeResponse(BulkReleasePlanDecisionResponse response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException("Cannot persist bulk decision response", failure);
        }
    }

    private BulkReleasePlanDecisionResponse readResponse(String json) {
        try {
            return objectMapper.readValue(json, BulkReleasePlanDecisionResponse.class);
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException("Cannot replay bulk decision response", failure);
        }
    }
}
