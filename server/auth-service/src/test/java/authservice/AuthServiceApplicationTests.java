package authservice;

import authservice.repository.AccountRepository;
import authservice.repository.RoleRepository;
import authservice.repository.StaffAccessProjectionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
		"JWT_SIGNER_KEY=test-only-signing-key-with-at-least-sixty-four-characters-1234567890",
		"app.demo-staff.enabled=true",
		"app.demo-staff.password=12345678",
		"app.demo-staff.publish-profiles=false",
		"app.branch-manager.password=12345678"
})
class AuthServiceApplicationTests {

	@Autowired
	AccountRepository accountRepository;

	@Autowired
	RoleRepository roleRepository;

	@Autowired
	PasswordEncoder passwordEncoder;

	@Autowired
	StaffAccessProjectionRepository staffAccessProjectionRepository;

	@Value("${app.admin.password}")
	String adminPassword;

	@Value("${app.branch-manager.password}")
	String branchManagerPassword;

	@Test
	@Transactional
	void seedsCatalogApprovalAccountsWithExpectedRoles() {
		var admin = accountRepository.findByUsername("admin").orElseThrow();
		var branchManager = accountRepository.findByUsername("branchmanager").orElseThrow();

		assertThat(admin.getRoles()).extracting("roleName").contains("ADMIN");
		assertThat(branchManager.getRoles()).extracting("roleName").contains("BRANCH_MANAGER");
		assertThat(passwordEncoder.matches(adminPassword, admin.getPasswordHash())).isTrue();
		assertThat(passwordEncoder.matches(branchManagerPassword, branchManager.getPasswordHash())).isTrue();
	}

	@Test
	@Transactional
	void seedsProgrammingOperatorAndKeepsEmployeeRoleAsSelfServiceBase() {
		var programming = roleRepository.findById("PROGRAMMING_OPERATOR").orElseThrow();
		var employee = roleRepository.findById("EMPLOYEE").orElseThrow();

		assertThat(programming.getPermissions()).extracting("name")
				.contains("MOVIE_CREATE", "MOVIE_UPDATE", "SHOWTIME_CREATE")
				.doesNotContain("MOVIE_DELETE");
		assertThat(employee.getPermissions()).extracting("name")
				.contains("WORKFORCE_SELF_READ", "ATTENDANCE_CLOCK", "TIMESHEET_SUBMIT", "WORKFORCE_REQUEST")
				.doesNotContain("TICKET_SELL", "BOOKING_READ", "CONCESSION_FULFILLMENT_READ",
						"MOVIE_CREATE", "SHOWTIME_UPDATE", "USER_READ");
	}

	@Test
	@Transactional
	void seedsSeparatedBusinessRolesWithMakerCheckerPermissions() {
		var programmingMaker = roleRepository.findById("PROGRAMMING_OPERATOR").orElseThrow();
		var programmingChecker = roleRepository.findById("PROGRAMMING_APPROVER").orElseThrow();
		var financeMaker = roleRepository.findById("FINANCE_OFFICER").orElseThrow();
		var financeChecker = roleRepository.findById("FINANCE_APPROVER").orElseThrow();
		var commercialMaker = roleRepository.findById("COMMERCIAL_MANAGER").orElseThrow();
		var commercialChecker = roleRepository.findById("COMMERCIAL_APPROVER").orElseThrow();
		var systemAdmin = roleRepository.findById("SYSTEM_ADMIN").orElseThrow();

		assertThat(programmingMaker.getPermissions()).extracting("name")
				.contains("RELEASE_PLAN_EDIT", "RELEASE_PLAN_SUBMIT")
				.doesNotContain("RELEASE_PLAN_APPROVE", "MOVIE_APPROVE");
		assertThat(programmingChecker.getPermissions()).extracting("name")
				.contains("RELEASE_PLAN_APPROVE", "MOVIE_APPROVE")
				.doesNotContain("RELEASE_PLAN_EDIT", "MOVIE_CREATE");
		assertThat(financeMaker.getPermissions()).extracting("name")
				.contains("REFUND_REVIEW").doesNotContain("REFUND_APPROVE");
		assertThat(financeChecker.getPermissions()).extracting("name")
				.contains("REFUND_APPROVE");
		assertThat(commercialMaker.getPermissions()).extracting("name")
				.contains("PROMOTION_CREATE", "PROMOTION_UPDATE", "PROMOTION_SUBMIT")
				.doesNotContain("PROMOTION_APPROVE", "PROMOTION_ACTIVATE", "PROMOTION_ARCHIVE");
		assertThat(commercialChecker.getPermissions()).extracting("name")
				.contains("PROMOTION_READ", "PROMOTION_APPROVE", "PROMOTION_ACTIVATE", "PROMOTION_PAUSE", "PROMOTION_ARCHIVE")
				.doesNotContain("PROMOTION_CREATE", "PROMOTION_UPDATE", "PROMOTION_SUBMIT");
		assertThat(systemAdmin.getPermissions()).extracting("name")
				.contains("ROLE_MANAGE", "SYSTEM_CONFIG_MANAGE")
				.doesNotContain("RELEASE_PLAN_APPROVE", "REFUND_APPROVE");
	}

	@Test
	@Transactional
	void seedsAUsableLocalAccountAndProjectionForEveryStaffRole() {
		var usernames = java.util.Map.ofEntries(
				java.util.Map.entry("EMPLOYEE", "employee"),
				java.util.Map.entry("BRANCH_MANAGER", "branchmanager"),
				java.util.Map.entry("PROGRAMMING_OPERATOR", "programmingoperator"),
				java.util.Map.entry("PROGRAMMING_APPROVER", "programmingapprover"),
				java.util.Map.entry("FINANCE_OFFICER", "financeofficer"),
				java.util.Map.entry("FINANCE_APPROVER", "financeapprover"),
				java.util.Map.entry("COMMERCIAL_MANAGER", "commercialmanager"),
				java.util.Map.entry("COMMERCIAL_APPROVER", "commercialapprover"),
				java.util.Map.entry("SECURITY_AUDITOR", "securityauditor"),
				java.util.Map.entry("SYSTEM_ADMIN", "systemadmin")
		);

		usernames.forEach((role, username) -> {
			var account = accountRepository.findByUsername(username).orElseThrow();
			assertThat(account.getRoles()).extracting("roleName").containsExactly(role);
			assertThat(passwordEncoder.matches("12345678", account.getPasswordHash())).isTrue();
			var projection = staffAccessProjectionRepository.findById(account.getAccountId()).orElseThrow();
			assertThat(projection.isAssignmentActive()).isTrue();
			assertThat(projection.getAccountRole()).isEqualTo(role);
			if (role.equals("EMPLOYEE") || role.equals("BRANCH_MANAGER")) {
				assertThat(projection.clusterIds()).containsExactly("43");
			} else {
				assertThat(projection.clusterIds()).isEmpty();
			}
			assertThat(projection.getAccessProfile()).isEqualTo(
					role.equals("EMPLOYEE") ? "GENERAL_OPERATIONS" : "NOT_APPLICABLE");
		});
	}

	@Test
	@Transactional
	void legacyAdminDoesNotReceiveEmployeeSelfServicePermissions() {
		var admin = roleRepository.findById("ADMIN").orElseThrow();
		assertThat(admin.getPermissions()).extracting("name")
				.doesNotContain("WORKFORCE_SELF_READ", "ATTENDANCE_CLOCK", "TIMESHEET_SUBMIT", "WORKFORCE_REQUEST");
	}

	@Test
	@Transactional
	void branchManagerCanInspectBranchOperationsWithoutReceivingApprovalAuthority() {
		var branchManager = roleRepository.findById("BRANCH_MANAGER").orElseThrow();
		assertThat(branchManager.getPermissions()).extracting("name")
				.contains("MOVIE_READ", "SHOWTIME_READ", "BOOKING_READ", "ROOM_READ")
				.doesNotContain("MOVIE_APPROVE", "RELEASE_PLAN_APPROVE", "REFUND_APPROVE");
	}

}
