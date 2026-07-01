package authservice.config;

import authservice.service.JwtService;
import movie.theater.common.exception.AppException;
import com.nimbusds.jose.JOSEException;
import jakarta.annotation.PostConstruct;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;

@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CustomJwtDecoder implements JwtDecoder {

    @Value("${jwt.signerKey}")
    @NonFinal
    String signerKey;

    JwtService jwtService;

    @NonFinal
    NimbusJwtDecoder nimbusJwtDecoder;

    @PostConstruct
    void init() {
        SecretKeySpec secretKeySpec = new SecretKeySpec(signerKey.getBytes(StandardCharsets.UTF_8), "HS512");
        nimbusJwtDecoder = NimbusJwtDecoder
                .withSecretKey(secretKeySpec)
                .macAlgorithm(MacAlgorithm.HS512)
                .build();
    }

    @Override
    public Jwt decode(String token) throws JwtException {
        try {
            // Verify signature + expiry + not revoked/logged-out
            jwtService.verifyToken(token, false);
        } catch (ParseException | JOSEException e) {
            throw new JwtException(e.getMessage());
        } catch (AppException e) {
            throw new JwtException("Token is invalid or has been logged out");
        }

        return nimbusJwtDecoder.decode(token);
    }
}
