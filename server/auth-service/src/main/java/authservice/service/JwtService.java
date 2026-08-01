package authservice.service;

import authservice.client.UserBranchScopeClient;
import authservice.dto.InternalBranchScopeResponse;
import authservice.entity.Account;
import authservice.entity.AuthToken;
import authservice.repository.AuthTokenRepository;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movie.theater.common.exception.GlobalErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.StringJoiner;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class JwtService {
    private final AuthTokenRepository authTokenRepository;
    private final UserBranchScopeClient userBranchScopeClient;
    @NonFinal
    @Value("${jwt.signerKey}")
    private String SIGNER_KEY;

    @NonFinal
    @Value("${jwt.valid-duration}")
    private long VALID_DURATION;

    @NonFinal
    @Value("${jwt.refreshable-duration}")
    private long REFRESHABLE_DURATION;

    @NonFinal
    @Value("${app.internal-service-key}")
    private String internalServiceKey;

    public String generateToken(Account account) {
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);

        JWTClaimsSet.Builder claimsBuilder = new JWTClaimsSet.Builder()
                .subject(account.getUsername())
                .issueTime(new Date())
                .expirationTime(
                        new Date(Instant.now().plus(VALID_DURATION, ChronoUnit.SECONDS).toEpochMilli())
                )
                .issuer("cineprime.com")
                .claim("accountId", account.getAccountId())
                .claim("scope", buildScope(account))
                .jwtID(UUID.randomUUID().toString());
        if (isBranchScopedStaff(account)) {
            claimsBuilder.claim("cinemaClusterIds", resolveBranchScope(account));
        }
        JWTClaimsSet claimsSet = claimsBuilder.build();

        Payload payload = new Payload(claimsSet.toJSONObject());

        JWSObject jwsObject = new JWSObject(header, payload);
        try {
            jwsObject.sign(new MACSigner(SIGNER_KEY.getBytes(StandardCharsets.UTF_8)));
            return jwsObject.serialize();
        } catch (JOSEException e) {
            log.error("Fail to generate token", e);
            throw new AppException(GlobalErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    private String buildScope(Account account) {
        StringJoiner stringJoiner = new StringJoiner(" ");
        if (!CollectionUtils.isEmpty(account.getRoles())) {
            account.getRoles().forEach(role -> {
                stringJoiner.add("ROLE_" + role.getRoleName());
                if (!CollectionUtils.isEmpty(role.getPermissions())) {
                    role.getPermissions().forEach(
                            permission -> stringJoiner.add(permission.getName()));
                }
            });
        }
        return stringJoiner.toString();
    }

    private boolean isBranchScopedStaff(Account account) {
        return !CollectionUtils.isEmpty(account.getRoles())
                && account.getRoles().stream()
                .anyMatch(role -> "BRANCH_MANAGER".equals(role.getRoleName())
                        || "EMPLOYEE".equals(role.getRoleName()));
    }

    private List<String> resolveBranchScope(Account account) {
        try {
            var response = userBranchScopeClient.getBranchScope(
                    account.getAccountId(), internalServiceKey);
            InternalBranchScopeResponse scope = response == null ? null : response.getResult();
            return scope == null || scope.cinemaClusterIds() == null
                    ? List.of()
                    : scope.cinemaClusterIds().stream()
                    .filter(value -> value != null && !value.isBlank())
                    .map(String::trim)
                    .distinct()
                    .toList();
        } catch (RuntimeException exception) {
            log.error("Cannot resolve branch assignments for account {}", account.getAccountId(), exception);
            throw new AppException(GlobalErrorCode.UNCATEGORIZED_EXCEPTION);
        }
    }

    public SignedJWT parseAndVerifySignature(String token) throws ParseException, JOSEException {
        JWSVerifier verifier = new MACVerifier(SIGNER_KEY.getBytes(StandardCharsets.UTF_8));
        SignedJWT signedJWT = SignedJWT.parse(token);
        if (!signedJWT.verify(verifier)) {
            throw new AppException(GlobalErrorCode.UNAUTHENTICATED);
        }
        return signedJWT;
    }

    public SignedJWT verifyToken(String token, boolean isRefresh) throws ParseException, JOSEException {
        JWSVerifier verifier = new MACVerifier(SIGNER_KEY.getBytes(StandardCharsets.UTF_8));

        SignedJWT signedJWT = SignedJWT.parse(token);
        Date expiryTime = isRefresh ?
                new Date(signedJWT.getJWTClaimsSet().getIssueTime().toInstant().plus(REFRESHABLE_DURATION, ChronoUnit.SECONDS).toEpochMilli()) :
                signedJWT.getJWTClaimsSet().getExpirationTime();

        var verify = signedJWT.verify(verifier);

        if (!verify || expiryTime.before(new Date())) {
            throw new AppException(GlobalErrorCode.UNAUTHENTICATED);
        }

        AuthToken authToken = authTokenRepository
                .findByJwtId(signedJWT.getJWTClaimsSet().getJWTID())
                .orElseThrow(() -> new AppException(GlobalErrorCode.UNAUTHENTICATED));
        if (Boolean.TRUE.equals(authToken.getIsRevoked()))
            throw new AppException(GlobalErrorCode.UNAUTHENTICATED);

        return signedJWT;
    }
}
