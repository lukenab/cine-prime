package authservice.dto.request;

import authservice.enums.AccountProvisioningRole;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CreateAccountRequestBoundaryTest {
    @Test
    void publicAccountProvisioningOnlyAllowsMembers() {
        assertThat(AccountProvisioningRole.values())
                .containsExactly(AccountProvisioningRole.MEMBER);
    }
}
