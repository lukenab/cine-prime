package bookingservice.config;

import com.nimbusds.jwt.SignedJWT;
import feign.RequestTemplate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static org.assertj.core.api.Assertions.assertThat;

class FeignClientInterceptorTest {

    private static final String SIGNER_KEY = "873bcf3b6023c6cfac735831cc01cbd59c6f64c2341050f12e5f0224d7edea62";

    @AfterEach
    void clearRequestContext() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void appliesOriginalUserTokenWhenRequestContextExists() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer user-token");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        RequestTemplate template = new RequestTemplate();
        new FeignClientInterceptor(new InternalServiceTokenProvider(SIGNER_KEY, 60)).apply(template);

        assertThat(template.headers().get("Authorization")).containsExactly("Bearer user-token");
    }

    @Test
    void createsShortLivedServiceTokenWhenSchedulerHasNoRequestContext() throws Exception {
        RequestTemplate template = new RequestTemplate();
        new FeignClientInterceptor(new InternalServiceTokenProvider(SIGNER_KEY, 60)).apply(template);

        String authorization = template.headers().get("Authorization").iterator().next();
        SignedJWT token = SignedJWT.parse(authorization.substring("Bearer ".length()));
        assertThat(token.getJWTClaimsSet().getSubject()).isEqualTo("booking-service");
        assertThat(token.getJWTClaimsSet().getStringClaim("scope")).isEqualTo("ROLE_SERVICE");
        assertThat(token.getJWTClaimsSet().getExpirationTime()).isAfter(token.getJWTClaimsSet().getIssueTime());
    }
}
