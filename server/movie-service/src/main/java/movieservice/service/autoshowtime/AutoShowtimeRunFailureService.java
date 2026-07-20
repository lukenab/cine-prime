package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.ShowtimeGenerationRun;
import movieservice.enums.GenerationRunStatus;
import movieservice.repository.ShowtimeGenerationRunRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AutoShowtimeRunFailureService {

    private final ShowtimeGenerationRunRepository generationRunRepository;

    /// Persist FAILED ở transaction riêng vì transaction execute trước đó đã rollback do lỗi không mong muốn.
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long generationRunId, Throwable exception) {
        ShowtimeGenerationRun run = generationRunRepository.findById(generationRunId).orElse(null);
        /// Nếu execute transaction rollback thì status trong DB quay lại ACCEPTED.
        /// Vì vậy failure handler phải nhận cả ACCEPTED lẫn RUNNING để không retry vô hạn run lỗi.
        if (run == null || (run.getStatus() != GenerationRunStatus.ACCEPTED
                && run.getStatus() != GenerationRunStatus.RUNNING)) {
            return;
        }

        run.setStatus(GenerationRunStatus.FAILED);
        run.setCompletedAt(LocalDateTime.now());
        run.setFailureDetail(buildFailureDetail(exception));
    }

    /// Giới hạn message để failure_detail hữu ích nhưng không biến thành stack trace quá lớn trong database.
    private String buildFailureDetail(Throwable exception) {
        String detail = exception.getClass().getSimpleName() + ": " + exception.getMessage();
        return detail.length() <= 2000 ? detail : detail.substring(0, 2000);
    }
}
