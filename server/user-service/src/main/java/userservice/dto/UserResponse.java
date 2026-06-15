package userservice.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@AllArgsConstructor
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class UserResponse {
    String accountId;
    String fullName;
    String phoneNumber;
    LocalDate dateOfBirth;
    String gender;
    String address;
    String identityCard;
    String avatarUrl;
    LocalDateTime createdAt;
}
