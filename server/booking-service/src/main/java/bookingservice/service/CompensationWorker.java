package bookingservice.service;

import bookingservice.client.MovieInventoryClient;
import bookingservice.dto.request.ConfirmMovieSeatHoldRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CompensationWorker {
    private final CompensationStateService stateService;
    private final MovieInventoryClient movieInventoryClient;

    @Value("${movie-service.internal-key}")
    private String movieServiceInternalKey;

    @Scheduled(fixedDelayString = "${booking.compensation.fixed-delay-ms:5000}")
    public void processDueTasks() {
        stateService.dueTaskIds().forEach(this::processOne);
    }

    void processOne(String taskId) {
        CompensationStateService.CompensationInstruction instruction =
                stateService.claim(taskId);
        if (instruction == null) {
            return;
        }
        try {
            switch (instruction.operation()) {
                case "CONFIRM_SEAT_HOLD" -> movieInventoryClient.confirmHold(
                        instruction.showtimeId(),
                        instruction.holdId(),
                        movieServiceInternalKey,
                        instruction.ownerId(),
                        new ConfirmMovieSeatHoldRequest(instruction.bookingId()));
                case "RELEASE_SEAT_HOLD", "RELEASE_EXPIRED_SEAT_HOLD" ->
                        movieInventoryClient.releaseHold(
                                instruction.showtimeId(),
                                instruction.holdId(),
                                movieServiceInternalKey,
                                instruction.ownerId());
                default -> throw new IllegalArgumentException(
                        "Unsupported compensation operation: " + instruction.operation());
            }
            stateService.complete(instruction);
        } catch (RuntimeException exception) {
            stateService.fail(instruction, exception);
        }
    }
}
