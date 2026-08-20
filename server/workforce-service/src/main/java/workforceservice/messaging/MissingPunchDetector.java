package workforceservice.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import workforceservice.service.WorkforceApplicationService;

@Slf4j @Component @RequiredArgsConstructor
public class MissingPunchDetector {
    private final WorkforceApplicationService service;

    @Scheduled(fixedDelayString = "${workforce.missing-punch-detection-ms:60000}")
    public void detect() {
        int count = service.detectMissingPunches();
        if (count > 0) log.info("Created missing-punch exceptions for {} ended shifts", count);
    }
}
