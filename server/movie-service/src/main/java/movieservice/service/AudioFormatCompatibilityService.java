package movieservice.service;

import movieservice.entity.AudioFormat;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

/**
 * Checks whether an auditorium audio system can reproduce a screening
 * version's supplied audio mix.
 */
@Component
public class AudioFormatCompatibilityService {

    public boolean supports(AudioFormat roomSystem, AudioFormat contentMix) {
        if (contentMix == null) {
            // Backward compatibility for versions created before V42.
            return true;
        }
        if (roomSystem == null || !Boolean.TRUE.equals(roomSystem.getActive())) {
            return false;
        }

        String roomCode = normalize(roomSystem.getFormatCode());
        String contentCode = normalize(contentMix.getFormatCode());
        if (roomCode.equals(contentCode)) {
            return true;
        }

        return switch (roomCode) {
            case "DOLBY_ATMOS" -> Set.of("DOLBY_7_1", "DOLBY_5_1").contains(contentCode);
            case "DOLBY_7_1" -> "DOLBY_5_1".equals(contentCode);
            default -> false;
        };
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
