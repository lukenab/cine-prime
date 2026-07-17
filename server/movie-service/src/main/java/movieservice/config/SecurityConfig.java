package movieservice.config;

import movie.theater.common.security.JwtResourceServerSecuritySupport;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig extends JwtResourceServerSecuritySupport {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/movies/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/genres/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/cinema-rooms/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/cinema-room-master-data").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/seats/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/schedules/**").permitAll()
                        // Cinema clusters — GET public (controller filters by role internally)
                        // Audit log is further protected via @PreAuthorize on the method
                        .requestMatchers(HttpMethod.GET, "/api/cinema-clusters/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/schedules").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/schedules/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/schedules/**").hasRole("ADMIN")
                        .anyRequest().authenticated());

        configureJwtResourceServer(http);

        return http.build();
    }
}
