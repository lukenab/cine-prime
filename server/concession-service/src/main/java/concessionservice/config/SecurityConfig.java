package concessionservice.config;

import movie.theater.common.security.JwtResourceServerSecuritySupport;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
public class SecurityConfig extends JwtResourceServerSecuritySupport {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/actuator/health/**", "/actuator/info").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/public/cinemas/*/concessions").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/public/concession-media/images/**").permitAll()
                        .requestMatchers("/api/internal/**").permitAll()
                        .requestMatchers("/api/admin/concession-products/**")
                            .hasAnyRole("BRANCH_MANAGER", "ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/admin/concession-skus/**")
                            .hasAnyRole("BRANCH_MANAGER", "ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/admin/concession-media/**")
                            .hasAnyRole("BRANCH_MANAGER", "ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/admin/cinemas/**")
                            .hasAnyRole("BRANCH_MANAGER", "ADMIN", "SUPER_ADMIN")
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                        // Method security applies the operation-specific capability;
                        // the HTTP layer only establishes an authenticated principal.
                        .requestMatchers("/api/employee/**").authenticated()
                        .anyRequest().authenticated());
        configureJwtResourceServer(http);
        return http.build();
    }
}
