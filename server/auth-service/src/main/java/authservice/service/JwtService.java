package authservice.service;

import authservice.entity.Account;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
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
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.StringJoiner;

@Service
@RequiredArgsConstructor
@Slf4j
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class JwtService {
    @NonFinal
    @Value("${jwt.signerKey}")
    private String SIGNER_KEY;

    public String generateToken(Account account){
        JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);

        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                .subject(account.getUsername())
                .issueTime(new Date())
                .expirationTime(
                        new Date(Instant.now().plus(30, ChronoUnit.MINUTES).toEpochMilli())
                )
                .issuer("cineprime.com")
                .claim("accountId", account.getAccountId())
                .claim("scope", buildScope(account))
                .claim("role", buildScope(account))
                .build();

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
//
//    private String buildScope(Account account){
//        StringJoiner stringJoiner = new StringJoiner(" ");
//        if(account.getRole() != null){
//            stringJoiner.add(account.getRole().getRoleName());
//        }
//        return stringJoiner.toString();
//    }

    private String buildScope(Account account){
        StringJoiner stringJoiner = new StringJoiner(" ");
//        if(!CollectionUtils.isEmpty(account.getRoles())){
//            account.getRoles().forEach((stringJoiner::add));
//        }

        return stringJoiner.toString();
    }
}
