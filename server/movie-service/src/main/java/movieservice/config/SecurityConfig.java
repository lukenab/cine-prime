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
                        .requestMatchers(HttpMethod.GET, "/actuator/health/**", "/actuator/info").permitAll()
                        // `[Backend] Separate public and internal movie catalog APIs`: only the
                        // public catalog is open at the filter-chain level. Internal detail/list
                        // (and TMDB search/import) rely on @PreAuthorize alone before this fix -
                        // narrowing the matcher makes the security boundary explicit instead of
                        // depending on every future endpoint under /api/movies remembering to add one.
                        .requestMatchers(HttpMethod.GET, "/api/movies/public", "/api/movies/public/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/genres/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/cinema-rooms/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/cinema-room-master-data").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/seats/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/schedules/**").permitAll()
                        // Seat map for a showtime - customer browsing before booking (profile
                        // gate lives in the booking flow itself, not here). Locking seats
                        // (PUT .../lock) stays behind .anyRequest().authenticated() below -
                        // any signed-in customer may hold seats for their own booking.
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/showtimes/*/seats",
                                "/api/showtimes/*/seat-map",
                                "/api/showtimes/seat-hold-policy")
                        .permitAll()
                        .requestMatchers("/api/internal/showtimes/**").permitAll()
                        .requestMatchers("/ws/seat-inventory/**").permitAll()
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
