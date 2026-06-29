package userservice.dto;

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
public class EmployeeUpdateRequest {
    @Size(max = 36, message = "Cinema ID must be at most 36 characters")
    String cinemaId;

    EmployeePosition position;

    EmployeeDepartment department;

    EmploymentType employmentType;

    @PastOrPresent(message = "Hire date cannot be in the future")
    LocalDate hireDate;
}
