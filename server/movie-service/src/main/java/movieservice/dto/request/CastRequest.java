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

    /** Person.personId — must exist in DB */
    @NotNull
    Long personId;

    /** ACTOR | DIRECTOR | WRITER | PRODUCER | COMPOSER */
    @NotBlank
    String roleType;

    /** Nullable — only meaningful for actors */
    String characterName;

    /** Display order in credits */
    Integer billingOrder;
}
