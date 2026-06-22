package userservice.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class UserUpdateRequest {
    @Size(max = 50, message = "Full name must not exceed 50 characters")
    String fullName;

    @Pattern(regexp = "^(0|\\+84)[0-9]{9,10}$", message = "Invalid phone number format")
    String phoneNumber;

    LocalDate dateOfBirth;

    @Pattern(regexp = "^(Male|Female|Other)$", message = "Gender must be Male, Female, or Other")
    String gender;

    @Size(max = 255, message = "Address must not exceed 255 characters")
    String address;

    String avatarUrl;

    @Pattern(regexp = "^[0-9]{12}$", message = "Identity card must contain exactly 12 digits")
    String identityCard;

}
