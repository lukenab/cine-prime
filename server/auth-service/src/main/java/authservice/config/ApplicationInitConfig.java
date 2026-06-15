package authservice.config;

import authservice.entity.Account;
import authservice.enums.Role;
import authservice.repository.AccountRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.HashSet;

@Slf4j
@Configuration
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@RequiredArgsConstructor
public class ApplicationInitConfig {
    AccountRepository accountRepository;
    PasswordEncoder passwordEncoder;

    @Bean
    ApplicationRunner applicationRunner(){
        return args -> {
            if(accountRepository.findByUsername("admin").isEmpty()){

                var roles = new HashSet<String>();
                roles.add(Role.ADMIN.name());

                Account account = Account.builder()
                        .username("admin")
                        .email("admin@gmail.com")
                        .passwordHash(passwordEncoder.encode("admin"))
//                        .roles(roles)
                        .build();

                accountRepository.save(account);
                log.warn("Default admin user has been created with default password: admin.");
            }
        };
    }
}
