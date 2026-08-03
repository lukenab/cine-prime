package bookingservice.config;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSObject;
import com.nimbusds.jose.Payload;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import movie.theater.common.exception.AppException;
import movie.theater.common.exception.GlobalErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Tạo JWT ngắn hạn cho lời gọi nội bộ không có HTTP request của người dùng,
 * ví dụ scheduler tự động hết hạn booking. JWT dùng cùng signer key với các
 * service nên Promotion Service vẫn xác thực như một service-to-service call.
 */
@Component
public class InternalServiceTokenProvider {

    private final String signerKey;
    private final long ttlSeconds;

    public InternalServiceTokenProvider(
            @Value("${jwt.signerKey}") String signerKey,
            @Value("${booking.internal-auth.token-ttl-seconds:60}") long ttlSeconds) {
        this.signerKey = signerKey;
        this.ttlSeconds = ttlSeconds;
    }

    public String createToken() {
        Instant now = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("booking-service")
                .issuer("cineprime.com")
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(ttlSeconds)))
                .claim("accountId", "booking-service")
                .claim("scope", "ROLE_SERVICE")
                .jwtID(UUID.randomUUID().toString())
                .build();

        JWSObject signedJwt = new JWSObject(new JWSHeader(JWSAlgorithm.HS512), new Payload(claims.toJSONObject()));
        try {
            signedJwt.sign(new MACSigner(signerKey.getBytes(StandardCharsets.UTF_8)));
            return signedJwt.serialize();
        } catch (JOSEException exception) {
            throw new AppException(GlobalErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }
}
