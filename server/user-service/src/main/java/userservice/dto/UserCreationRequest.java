package userservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
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
public class UserCreationRequest {

    @NotBlank(message = "Account ID must not be blank")
    String accountId;

    @NotBlank(message = "Full name must not be blank")
    @Size(max = 100, message = "Full name must not exceed 100 characters")

    String fullName;

    @NotBlank(message = "Phone number must not be blank")
    @Pattern(
        regexp = "^(0|\\+84)[0-9]{9,10}$",
        message = "Invalid phone number format"
    )
    String phoneNumber;

    @NotNull(message = "Date of birth must not be null")
    @Past(message = "Date of birth must be in the past")
    LocalDate dateOfBirth;

    @NotBlank(message = "Gender must not be blank")
    @Pattern(
        regexp = "^(Male|Female|Other)$",
        message = "Gender must be Male, Female, or Other"
    )
    String gender;

    @NotBlank(message = "Address must not be blank")
    @Size(max = 255, message = "Address must not exceed 255 characters")
    String address;

    @NotBlank(message = "Identity card must not be blank")
    @Pattern(
        regexp = "^[0-9]{12}$",
        message = "Identity card must contain exactly 12 digits"
    )
    String identityCard;
}
