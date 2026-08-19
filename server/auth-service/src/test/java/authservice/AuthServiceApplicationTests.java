package authservice;

import authservice.repository.AccountRepository;
import authservice.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
		"JWT_SIGNER_KEY=test-only-signing-key-with-at-least-sixty-four-characters-1234567890"
})
class AuthServiceApplicationTests {

	@Autowired
	AccountRepository accountRepository;

	@Autowired
	RoleRepository roleRepository;

	@Autowired
	PasswordEncoder passwordEncoder;

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
	void seedsProgrammingOperatorAndKeepsCinemaEmployeeOperationalOnly() {
		var programming = roleRepository.findById("PROGRAMMING_OPERATOR").orElseThrow();
		var employee = roleRepository.findById("EMPLOYEE").orElseThrow();

		assertThat(programming.getPermissions()).extracting("name")
				.contains("MOVIE_CREATE", "MOVIE_UPDATE", "SHOWTIME_CREATE")
				.doesNotContain("MOVIE_DELETE");
		assertThat(employee.getPermissions()).extracting("name")
				.contains("TICKET_SELL", "BOOKING_READ")
				.doesNotContain("MOVIE_CREATE", "SHOWTIME_UPDATE", "USER_READ");
	}

	@Test
	@Transactional
	void seedsSeparatedBusinessRolesWithMakerCheckerPermissions() {
		var programmingMaker = roleRepository.findById("PROGRAMMING_OPERATOR").orElseThrow();
		var programmingChecker = roleRepository.findById("PROGRAMMING_APPROVER").orElseThrow();
		var financeMaker = roleRepository.findById("FINANCE_OFFICER").orElseThrow();
		var financeChecker = roleRepository.findById("FINANCE_APPROVER").orElseThrow();
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
		assertThat(systemAdmin.getPermissions()).extracting("name")
				.contains("ROLE_MANAGE", "SYSTEM_CONFIG_MANAGE")
				.doesNotContain("RELEASE_PLAN_APPROVE", "REFUND_APPROVE");
	}

}
