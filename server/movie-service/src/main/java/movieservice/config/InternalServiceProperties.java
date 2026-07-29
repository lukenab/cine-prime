package movieservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "internal-service")
public class InternalServiceProperties {

    /**
     * Shared only between trusted services. Production environments must
     * override the development default through INTERNAL_SERVICE_KEY.
     */
    private String key;
}
