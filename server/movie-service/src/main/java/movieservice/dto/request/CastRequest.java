package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CastRequest {
    @NotNull
    Long personId;

    @NotBlank
    String roleType;
    String characterName;
    Integer billingOrder;
}
