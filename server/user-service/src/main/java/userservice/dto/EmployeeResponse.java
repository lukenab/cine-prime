package userservice.dto;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import userservice.enums.EmployeeDepartment;
import userservice.enums.EmployeePosition;
import userservice.enums.EmployeeStatus;
import userservice.enums.EmploymentType;
import userservice.enums.StaffAccessRole;

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
    String employeeCode;
    String cinemaId;
    EmployeePosition position;
    EmployeeDepartment department;
    EmploymentType employmentType;
    LocalDate hireDate;
    EmployeeStatus status;
    StaffAccessRole accessRole;
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
