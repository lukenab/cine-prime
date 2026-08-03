package userservice.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import userservice.enums.EmployeeDepartment;
import userservice.enums.EmployeePosition;
import userservice.enums.EmploymentType;
import userservice.enums.StaffAccessRole;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeInvitationRequest {
    @NotBlank(message = "Full name is required")
    @Size(max = 100, message = "Full name must be at most 100 characters")
    private String fullName;

    @NotBlank(message = "Work email is required")
    @Email(message = "Invalid work email format")
    private String email;

    @Pattern(regexp = "^(0|\\+84)[0-9]{9,10}$", message = "Invalid phone number format")
    private String phoneNumber;

    @Size(max = 36, message = "Cinema ID must be at most 36 characters")
    private String cinemaId;

    @NotNull(message = "Primary work area is required")
    private EmployeeDepartment department;

    @NotNull(message = "Position is required")
    private EmployeePosition position;

    @NotNull(message = "Employment type is required")
    private EmploymentType employmentType;

    @NotNull(message = "Hire date is required")
    private LocalDate hireDate;

    @NotNull(message = "Access role is required")
    private StaffAccessRole accessRole;

    @AssertTrue(message = "Branch is required for cinema-based staff")
    public boolean isBranchAssignmentValid() {
        return accessRole == StaffAccessRole.PROGRAMMING_OPERATOR
                || (cinemaId != null && !cinemaId.isBlank());
    }

    @AssertTrue(message = "Job role, work area and system access role do not form a valid staff assignment")
    public boolean isJobAssignmentValid() {
        if (accessRole == null || department == null || position == null) {
            return true;
        }
        return switch (accessRole) {
            case PROGRAMMING_OPERATOR -> department == EmployeeDepartment.CONTENT_PROGRAMMING
                    && position == EmployeePosition.PROGRAMMING_OPERATOR
                    && (cinemaId == null || cinemaId.isBlank());
            case BRANCH_MANAGER -> department == EmployeeDepartment.GENERAL_OPERATIONS
                    && position == EmployeePosition.CINEMA_MANAGER
                    && cinemaId != null && !cinemaId.isBlank();
            case EMPLOYEE -> department != EmployeeDepartment.CONTENT_PROGRAMMING
                    && position != EmployeePosition.PROGRAMMING_OPERATOR
                    && position != EmployeePosition.CINEMA_MANAGER
                    && cinemaId != null && !cinemaId.isBlank();
        };
    }
}
