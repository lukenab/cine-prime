package authservice.service;

import authservice.entity.Account;
import authservice.entity.Role;
import authservice.repository.AuthTokenRepository;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import authservice.enums.StaffProvisioningRole;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JwtServiceBranchScopeTest {
    private final StaffAccessProjectionService projections = mock(StaffAccessProjectionService.class);
    private JwtService service;

    @BeforeEach
    void setUp() {
        service = new JwtService(mock(AuthTokenRepository.class), projections);
        ReflectionTestUtils.setField(service, "SIGNER_KEY", "a".repeat(64));
        ReflectionTestUtils.setField(service, "VALID_DURATION", 1800L);
        ReflectionTestUtils.setField(service, "REFRESHABLE_DURATION", 36000L);
    }

    @Test
    void loginUsesLocalProjectionWhenUserServiceIsUnavailable() throws Exception {
        Account manager = account("ACC-MANAGER", "BRANCH_MANAGER");
        when(projections.resolve(manager)).thenReturn(new StaffAccessProjectionService.StaffAuthorization(
                true, true, "BRANCH_MANAGER", "NOT_APPLICABLE", List.of("81"), Set.of()));

        SignedJWT token = SignedJWT.parse(service.generateToken(manager));

        assertThat(token.getJWTClaimsSet().getStringListClaim("cinemaClusterIds"))
                .containsExactly("81");
        assertThat(token.getJWTClaimsSet().getStringClaim("scope"))
                .contains("ROLE_BRANCH_MANAGER");
        assertThat(token.getJWTClaimsSet().getBooleanClaim("staffAssignmentActive")).isTrue();
    }

    @Test
    void missingOrDisabledAssignmentFailsClosed() throws Exception {
        Account employee = account("ACC-EMPLOYEE", "EMPLOYEE");
        when(projections.resolve(employee)).thenReturn(
                new StaffAccessProjectionService.StaffAuthorization(
                        true, false, null, null, List.of(), Set.of()));

        SignedJWT token = SignedJWT.parse(service.generateToken(employee));

        assertThat(token.getJWTClaimsSet().getStringClaim("scope"))
                .doesNotContain("ROLE_EMPLOYEE");
        assertThat(token.getJWTClaimsSet().getStringListClaim("cinemaClusterIds")).isEmpty();
        assertThat(token.getJWTClaimsSet().getBooleanClaim("staffAssignmentActive")).isFalse();
    }

    @Test
    void memberTokenIsUnaffectedByStaffProjection() throws Exception {
        Account member = account("ACC-MEMBER", "MEMBER");
        when(projections.resolve(member)).thenReturn(
                new StaffAccessProjectionService.StaffAuthorization(
                        false, true, null, null, List.of(), Set.of()));

        SignedJWT token = SignedJWT.parse(service.generateToken(member));

        assertThat(token.getJWTClaimsSet().getStringClaim("scope")).contains("ROLE_MEMBER");
        assertThat(token.getJWTClaimsSet().getClaim("staffAssignmentActive")).isNull();
        assertThat(token.getJWTClaimsSet().getClaim("cinemaClusterIds")).isNull();
    }

    @Test
    void employeeTokenContainsOnlyCapabilitiesFromProjectedProfile() throws Exception {
        Account employee = account("ACC-BOX-OFFICE", "EMPLOYEE");
        when(projections.resolve(employee)).thenReturn(new StaffAccessProjectionService.StaffAuthorization(
                true,
                true,
                "EMPLOYEE",
                "BOX_OFFICE",
                List.of("43"),
                Set.of("WORKFORCE_SELF_READ", "TICKET_SELL", "BOOKING_READ")));

        SignedJWT token = SignedJWT.parse(service.generateToken(employee));

        assertThat(token.getJWTClaimsSet().getStringClaim("staffAccessProfile")).isEqualTo("BOX_OFFICE");
        assertThat(token.getJWTClaimsSet().getStringListClaim("cinemaClusterIds")).containsExactly("43");
        assertThat(token.getJWTClaimsSet().getStringClaim("scope"))
                .contains("ROLE_EMPLOYEE", "WORKFORCE_SELF_READ", "TICKET_SELL", "BOOKING_READ")
                .doesNotContain("CONCESSION_FULFILLMENT_READ");
    }

    @ParameterizedTest
    @EnumSource(StaffProvisioningRole.class)
    void everyProvisionedStaffRoleCanIssueTokenFromLocalProjection(StaffProvisioningRole role) throws Exception {
        Account staff = account("ACC-" + role.name(), role.name());
        when(projections.resolve(staff)).thenReturn(new StaffAccessProjectionService.StaffAuthorization(
                true, true, role.name(), "NOT_APPLICABLE", List.of(), Set.of()));

        SignedJWT token = SignedJWT.parse(service.generateToken(staff));

        assertThat(token.getJWTClaimsSet().getStringClaim("scope")).contains("ROLE_" + role.name());
        assertThat(token.getJWTClaimsSet().getBooleanClaim("staffAssignmentActive")).isTrue();
    }

    private Account account(String id, String role) {
        return Account.builder()
                .accountId(id)
                .username(id.toLowerCase())
                .email(id.toLowerCase() + "@example.test")
                .passwordHash("not-used")
                .roles(Set.of(Role.builder().roleName(role).permissions(Set.of()).build()))
                .build();
    }
}
