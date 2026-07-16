package movieservice.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PersonRequest {

    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 255, message = "Full name must be 2-255 characters")
    String fullName;

    String nationality;

    LocalDate birthDate;

    @Size(max = 500, message = "Photo URL too long")
    String photoUrl;

    String biography;

    Integer tmdbId;

    @Size(max = 10, message = "Gender too long")
    String gender;

    @Size(max = 50, message = "Known-for department too long")
    String knownForDepartment;

    LocalDate deathDate;

    @Size(max = 255, message = "Place of birth too long")
    String placeOfBirth;
}
