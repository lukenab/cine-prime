package movieservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .components(new Components())
                .info(new Info()
                        .title("Movie Service API")
                        .version("1.0.0")
                        .description("API cho movie-service — mô tả chi tiết các endpoint và dữ liệu trả về")
                        .contact(new Contact().name("Movie Service Team").email("devteam@example.com"))
                        .license(new License().name("MIT").url("https://opensource.org/licenses/MIT")));
    }
}
