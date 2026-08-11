package authservice.service;

import authservice.exception.AuthErrorCode;
import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Set;

@Service
public class GoogleIdentityTokenVerifier {
    private static final Set<String> GOOGLE_ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");

    private final String clientId;
    private final JwtDecoder decoder;

    public GoogleIdentityTokenVerifier(
            @Value("${google.auth.client-id:}") String clientId,
            @Value("${google.auth.jwk-set-uri:https://www.googleapis.com/oauth2/v3/certs}") String jwkSetUri
    ) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.decoder = StringUtils.hasText(this.clientId) ? createDecoder(jwkSetUri) : null;
    }

    public GooglePrincipal verify(String credential) {
        if (!StringUtils.hasText(clientId) || decoder == null) {
            throw new AppException(AuthErrorCode.GOOGLE_AUTH_NOT_CONFIGURED);
        }

        try {
            Jwt jwt = decoder.decode(credential);
            String subject = jwt.getSubject();
            String email = jwt.getClaimAsString("email");
            Boolean emailVerified = jwt.getClaim("email_verified");

            if (!StringUtils.hasText(subject) || !StringUtils.hasText(email)) {
                throw new AppException(AuthErrorCode.GOOGLE_TOKEN_INVALID);
            }
            if (!Boolean.TRUE.equals(emailVerified)) {
                throw new AppException(AuthErrorCode.GOOGLE_EMAIL_NOT_VERIFIED);
            }

            return new GooglePrincipal(
                    subject,
                    email.trim().toLowerCase(),
                    jwt.getClaimAsString("name"),
                    jwt.getClaimAsString("picture")
            );
        } catch (AppException exception) {
            throw exception;
        } catch (JwtException | IllegalArgumentException exception) {
            throw new AppException(AuthErrorCode.GOOGLE_TOKEN_INVALID);
        }
    }

    private JwtDecoder createDecoder(String jwkSetUri) {
        NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        OAuth2TokenValidator<Jwt> timestamp = new JwtTimestampValidator();
        OAuth2TokenValidator<Jwt> issuer = token -> GOOGLE_ISSUERS.contains(token.getIssuer() == null ? "" : token.getIssuer().toString())
                ? OAuth2TokenValidatorResult.success()
                : failure("invalid_issuer", "The Google token issuer is invalid");
        OAuth2TokenValidator<Jwt> audience = token -> {
            List<String> audiences = token.getAudience();
            return audiences != null && audiences.contains(clientId)
                    ? OAuth2TokenValidatorResult.success()
                    : failure("invalid_audience", "The Google token audience is invalid");
        };
        jwtDecoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(timestamp, issuer, audience));
        return jwtDecoder;
    }

    private OAuth2TokenValidatorResult failure(String code, String description) {
        return OAuth2TokenValidatorResult.failure(new OAuth2Error(code, description, null));
    }

    public record GooglePrincipal(String subject, String email, String fullName, String pictureUrl) {}
}
