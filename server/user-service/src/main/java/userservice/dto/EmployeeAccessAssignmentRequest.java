package userservice.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import userservice.enums.EmployeeDepartment;
import userservice.enums.EmployeePosition;
import userservice.enums.StaffAccessRole;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeAccessAssignmentRequest {
    @Size(max = 36, message = "Cinema ID must be at most 36 characters")
    private String cinemaId;

    @NotNull(message = "Primary work area is required")
    private EmployeeDepartment department;

    @NotNull(message = "Position is required")
    private EmployeePosition position;

    @NotNull(message = "Access role is required")
    private StaffAccessRole accessRole;

    @AssertTrue(message = "Job role, work area and system access role do not form a valid staff assignment")
    public boolean isValidAssignment() {
        if (accessRole == null || department == null || position == null) return true;
        boolean hasCinema = cinemaId != null && !cinemaId.isBlank();
        return switch (accessRole) {
            case PROGRAMMING_OPERATOR -> department == EmployeeDepartment.CONTENT_PROGRAMMING
                    && position == EmployeePosition.PROGRAMMING_OPERATOR && !hasCinema;
            case PROGRAMMING_APPROVER -> department == EmployeeDepartment.CONTENT_PROGRAMMING
                    && position == EmployeePosition.PROGRAMMING_APPROVER && !hasCinema;
            case FINANCE_OFFICER -> department == EmployeeDepartment.FINANCE
                    && position == EmployeePosition.FINANCE_OFFICER && !hasCinema;
            case FINANCE_APPROVER -> department == EmployeeDepartment.FINANCE
                    && position == EmployeePosition.FINANCE_APPROVER && !hasCinema;
            case COMMERCIAL_MANAGER -> department == EmployeeDepartment.COMMERCIAL
                    && position == EmployeePosition.COMMERCIAL_MANAGER && !hasCinema;
            case SECURITY_AUDITOR -> department == EmployeeDepartment.RISK_COMPLIANCE
                    && position == EmployeePosition.SECURITY_AUDITOR && !hasCinema;
            case SYSTEM_ADMIN -> department == EmployeeDepartment.INFORMATION_TECHNOLOGY
                    && position == EmployeePosition.SYSTEM_ADMINISTRATOR && !hasCinema;
            case BRANCH_MANAGER -> department == EmployeeDepartment.GENERAL_OPERATIONS
                    && position == EmployeePosition.CINEMA_MANAGER && hasCinema;
            case EMPLOYEE -> department != EmployeeDepartment.CONTENT_PROGRAMMING
                    && position != EmployeePosition.PROGRAMMING_OPERATOR
                    && position != EmployeePosition.PROGRAMMING_APPROVER
                    && position != EmployeePosition.CINEMA_MANAGER && hasCinema;
        };
    }
}
