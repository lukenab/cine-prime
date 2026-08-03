package bookingservice.config;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Configuration
public class FeignClientInterceptor implements RequestInterceptor {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private final InternalServiceTokenProvider internalServiceTokenProvider;

    public FeignClientInterceptor(InternalServiceTokenProvider internalServiceTokenProvider) {
        this.internalServiceTokenProvider = internalServiceTokenProvider;
    }

    @Override
    public void apply(RequestTemplate template) {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes != null) {
            HttpServletRequest request = attributes.getRequest();
            String authorizationHeader = request.getHeader(AUTHORIZATION_HEADER);

            // Nếu request hiện tại có Authorization thì luôn chuyển tiếp đúng danh tính người dùng.
            if (authorizationHeader != null && !authorizationHeader.isEmpty()) {
                template.header(AUTHORIZATION_HEADER, authorizationHeader);
                return;
            }
        }

        // Scheduler/background task không có request gốc, nên dùng JWT nội bộ ngắn hạn.
        template.header(AUTHORIZATION_HEADER, "Bearer " + internalServiceTokenProvider.createToken());
    }
}
