package bookingservice.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TicketPassCodecTest {
    private TicketPassCodec codec;

    @BeforeEach
    void setUp() {
        TicketPassProperties properties = new TicketPassProperties();
        properties.setSecret("booking-ticket-pass-test-secret");
        codec = new TicketPassCodec(properties);
    }

    @Test
    void shouldEncryptAndDecryptOpaqueTicketPass() {
        String token = codec.generateToken();

        String ciphertext = codec.encrypt(token);

        assertThat(token).startsWith("ctp_");
        assertThat(ciphertext).isNotEqualTo(token);
        assertThat(codec.decrypt(ciphertext)).isEqualTo(token);
    }

    @Test
    void shouldProduceStableHashWithoutPersistingPlainToken() {
        String token = "ctp_known-token";

        assertThat(codec.hash(token))
                .isEqualTo(codec.hash(token))
                .doesNotContain(token);
    }
}
