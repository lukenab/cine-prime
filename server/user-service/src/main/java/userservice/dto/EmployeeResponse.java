package userservice.dto;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import userservice.entity.EmployeeStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class EmployeeResponse {
    // Employee fields
    String employeeId;
    String position;
    LocalDate hireDate;
    EmployeeStatus status;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;

    // User profile fields (from linked User entity)
    String accountId;
    String fullName;
    String phoneNumber;
    LocalDate dateOfBirth;
    String gender;
    String address;
    String identityCard;
    String avatarUrl;
}
