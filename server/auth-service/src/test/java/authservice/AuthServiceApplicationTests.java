package authservice;

import authservice.repository.AccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class AuthServiceApplicationTests {

	@Autowired
	AccountRepository accountRepository;

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

}
