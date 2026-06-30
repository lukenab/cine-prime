package userservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import userservice.enums.EmployeeDepartment;
import userservice.enums.EmployeePosition;
import userservice.enums.EmploymentType;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class EmployeeCreateRequest {

    @NotBlank(message = "Account ID is required")
    String accountId;

    @Size(max = 36, message = "Cinema ID must be at most 36 characters")
    String cinemaId;

    @NotNull(message = "Position is required")
    EmployeePosition position;

    @NotNull(message = "Department is required")
    EmployeeDepartment department;

    @NotNull(message = "Employment type is required")
    EmploymentType employmentType;

    @NotNull(message = "Hire date is required")
    @PastOrPresent(message = "Hire date cannot be in the future")
    LocalDate hireDate;
}
