package movieservice.service;

import movieservice.entity.AudioFormat;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AudioFormatCompatibilityServiceTest {

    private final AudioFormatCompatibilityService service = new AudioFormatCompatibilityService();

    @Test
    void atmosRoomCanPlayAtmosAndLowerDolbyMixes() {
        AudioFormat room = format("DOLBY_ATMOS");

        assertThat(service.supports(room, format("DOLBY_ATMOS"))).isTrue();
        assertThat(service.supports(room, format("DOLBY_7_1"))).isTrue();
        assertThat(service.supports(room, format("DOLBY_5_1"))).isTrue();
    }

    @Test
    void lowerCapabilityRoomCannotPlayAtmosMix() {
        assertThat(service.supports(format("DOLBY_7_1"), format("DOLBY_ATMOS"))).isFalse();
        assertThat(service.supports(format("DOLBY_5_1"), format("DOLBY_7_1"))).isFalse();
    }

    @Test
    void legacyVersionWithoutAudioMixUsesBackwardCompatibleReadPath() {
        assertThat(service.supports(format("DOLBY_5_1"), null)).isTrue();
    }

    private AudioFormat format(String code) {
        return AudioFormat.builder()
                .formatCode(code)
                .formatName(code)
                .active(true)
                .build();
    }
}
