package userservice.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import userservice.dto.EmployeeCreateRequest;
import userservice.entity.Employee;
import userservice.entity.User;
import userservice.repository.EmployeeRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EmployeeAccessPolicyTest {

    @Test
    void branchManagerCanOnlyCreateEmployeesForOwnCinema() {
        EmployeeRepository repository = mock(EmployeeRepository.class);
        Employee manager = Employee.builder().cinemaId("CP-023")
                .user(User.builder().accountId("manager-account").build()).build();
        when(repository.findByUser_AccountId("manager-account")).thenReturn(Optional.of(manager));
        EmployeeAccessPolicy policy = new EmployeeAccessPolicy(repository);

        Jwt jwt = Jwt.withTokenValue("token").header("alg", "HS512")
                .subject("manager").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60))
                .claim("accountId", "manager-account").build();
        var authentication = new TestingAuthenticationToken(
                jwt, null, List.of(new SimpleGrantedAuthority("ROLE_BRANCH_MANAGER")));

        assertThat(policy.canCreate(EmployeeCreateRequest.builder().cinemaId("CP-023").build(), authentication)).isTrue();
        assertThat(policy.canCreate(EmployeeCreateRequest.builder().cinemaId("CP-999").build(), authentication)).isFalse();
    }

    @Test
    void administratorIsNotRestrictedToACinema() {
        EmployeeAccessPolicy policy = new EmployeeAccessPolicy(mock(EmployeeRepository.class));
        var authentication = new TestingAuthenticationToken(
                "admin", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        assertThat(policy.canCreate(EmployeeCreateRequest.builder().cinemaId("any").build(), authentication)).isTrue();
    }
}
