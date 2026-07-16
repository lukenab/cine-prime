package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PersonResponse {
    Long personId;
    String fullName;
    String photoUrl;
    String nationality;
    LocalDate birthDate;
    String biography;
    Integer tmdbId;
    String gender;
    String knownForDepartment;
    LocalDate deathDate;
    String placeOfBirth;
    LocalDateTime createdAt;
}
