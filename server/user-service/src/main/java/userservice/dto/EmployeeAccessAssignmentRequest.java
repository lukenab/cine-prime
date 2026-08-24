package userservice.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
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
    @Pattern(regexp = "^[1-9][0-9]*$", message = "Cinema ID must be the canonical numeric cluster ID")
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
            case COMMERCIAL_APPROVER -> department == EmployeeDepartment.COMMERCIAL
                    && position == EmployeePosition.COMMERCIAL_APPROVER && !hasCinema;
            case SECURITY_AUDITOR -> department == EmployeeDepartment.RISK_COMPLIANCE
                    && position == EmployeePosition.SECURITY_AUDITOR && !hasCinema;
            case SYSTEM_ADMIN -> department == EmployeeDepartment.INFORMATION_TECHNOLOGY
                    && position == EmployeePosition.SYSTEM_ADMINISTRATOR && !hasCinema;
            case BRANCH_MANAGER -> department == EmployeeDepartment.GENERAL_OPERATIONS
                    && position == EmployeePosition.CINEMA_MANAGER && hasCinema;
            case EMPLOYEE -> isFrontlineAssignment() && hasCinema;
        };
    }

    private boolean isFrontlineAssignment() {
        boolean frontlineDepartment = switch (department) {
            case GENERAL_OPERATIONS, BOX_OFFICE, FOOD_BEVERAGE, FLOOR_GUEST_SERVICES,
                    PROJECTION_TECHNICAL, FACILITIES_MAINTENANCE,
                    CONCESSION, FLOOR, PROJECTION, CUSTOMER_SERVICE, MANAGEMENT -> true;
            default -> false;
        };
        boolean frontlinePosition = switch (position) {
            case TEAM_MEMBER, SUPERVISOR, ASSISTANT_MANAGER, STAFF, MANAGER -> true;
            default -> false;
        };
        return frontlineDepartment && frontlinePosition;
    }
}
