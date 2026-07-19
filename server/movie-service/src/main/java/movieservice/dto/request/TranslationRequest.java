package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TranslationRequest {

    /** ISO 639-1 language code, e.g. "vi", "en" */
    @NotBlank
    @Size(min = 2, max = 2)
    String languageCode;

    @NotBlank
    @Size(max = 500)
    String title;

    String synopsis;

    @Size(max = 500)
    String tagline;
}
