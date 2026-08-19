package authservice.dto.request;

import authservice.enums.StaffProvisioningRole;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

class InternalStaffInvitationRequestTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @ParameterizedTest
    @EnumSource(StaffProvisioningRole.class)
    void deserializesEverySupportedStaffRole(StaffProvisioningRole role) throws Exception {
        String json = """
                {
                  "fullName": "Staff Test",
                  "email": "staff@cineprime.vn",
                  "phoneNumber": "0901234567",
                  "role": "%s"
                }
                """.formatted(role.name());

        InternalStaffInvitationRequest request =
                objectMapper.readValue(json, InternalStaffInvitationRequest.class);

        assertThat(request.getRole()).isEqualTo(role);
    }
}
