package userservice.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import userservice.enums.EmployeeDepartment;
import userservice.enums.EmployeePosition;
import userservice.enums.EmploymentType;
import userservice.enums.StaffAccessRole;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class EmployeeInvitationRequestValidationTest {

    private static ValidatorFactory validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        validatorFactory.close();
    }

    @Test
    void acceptsFutureStartDateForBranchTeamMember() {
        var request = validRequest()
                .hireDate(LocalDate.now().plusDays(14))
                .build();

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void acceptsHeadOfficeProgrammingPresetWithoutBranch() {
        var request = validRequest()
                .cinemaId(null)
                .department(EmployeeDepartment.CONTENT_PROGRAMMING)
                .position(EmployeePosition.PROGRAMMING_OPERATOR)
                .accessRole(StaffAccessRole.PROGRAMMING_OPERATOR)
                .build();

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void acceptsFinanceApproverWithoutBranch() {
        var request = validRequest()
                .cinemaId(null)
                .department(EmployeeDepartment.FINANCE)
                .position(EmployeePosition.FINANCE_APPROVER)
                .accessRole(StaffAccessRole.FINANCE_APPROVER)
                .build();

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void acceptsCommercialApproverWithoutBranch() {
        var request = validRequest()
                .cinemaId(null)
                .department(EmployeeDepartment.COMMERCIAL)
                .position(EmployeePosition.COMMERCIAL_APPROVER)
                .accessRole(StaffAccessRole.COMMERCIAL_APPROVER)
                .build();

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsCommercialMakerWithApproverAccess() {
        var request = validRequest()
                .cinemaId(null)
                .department(EmployeeDepartment.COMMERCIAL)
                .position(EmployeePosition.COMMERCIAL_MANAGER)
                .accessRole(StaffAccessRole.COMMERCIAL_APPROVER)
                .build();

        assertThat(validator.validate(request))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("jobAssignmentValid"));
    }

    @Test
    void rejectsFinanceOfficerWithApproverAccess() {
        var request = validRequest()
                .cinemaId(null)
                .department(EmployeeDepartment.FINANCE)
                .position(EmployeePosition.FINANCE_OFFICER)
                .accessRole(StaffAccessRole.FINANCE_APPROVER)
                .build();

        assertThat(validator.validate(request))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("jobAssignmentValid"));
    }

    @Test
    void rejectsProgrammingPositionWithEmployeeAccess() {
        var request = validRequest()
                .department(EmployeeDepartment.CONTENT_PROGRAMMING)
                .position(EmployeePosition.PROGRAMMING_OPERATOR)
                .accessRole(StaffAccessRole.EMPLOYEE)
                .build();

        assertThat(validator.validate(request))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("jobAssignmentValid"));
    }

    @Test
    void rejectsBranchManagerAccessForNonManagerPosition() {
        var request = validRequest()
                .department(EmployeeDepartment.FOOD_BEVERAGE)
                .position(EmployeePosition.TEAM_MEMBER)
                .accessRole(StaffAccessRole.BRANCH_MANAGER)
                .build();

        assertThat(validator.validate(request))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("jobAssignmentValid"));
    }

    private static EmployeeInvitationRequest.EmployeeInvitationRequestBuilder validRequest() {
        return EmployeeInvitationRequest.builder()
                .fullName("Nguyen Van Staff")
                .email("staff@cineprime.vn")
                .phoneNumber("0901234567")
                .cinemaId("81")
                .department(EmployeeDepartment.FOOD_BEVERAGE)
                .position(EmployeePosition.TEAM_MEMBER)
                .employmentType(EmploymentType.FULL_TIME)
                .hireDate(LocalDate.now())
                .accessRole(StaffAccessRole.EMPLOYEE);
    }
}
