package userservice.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class UserCatalogMigrationConfig {
    private final JdbcTemplate jdbcTemplate;

    @Bean
    ApplicationRunner userCatalogMigrationRunner() {
        return args -> applyCommercialApproverEmployeeConstraints();
    }

    private void applyCommercialApproverEmployeeConstraints() {
        final String version = "2026-08-24-commercial-approver-employee-constraints-v1";
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_catalog_migration (
                    version VARCHAR(100) PRIMARY KEY,
                    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """);
        Integer applied = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_catalog_migration WHERE version = ?", Integer.class, version);
        if (applied != null && applied > 0) {
            return;
        }

        jdbcTemplate.execute("ALTER TABLE employee DROP CONSTRAINT IF EXISTS employee_access_role_check");
        jdbcTemplate.execute("""
                ALTER TABLE employee ADD CONSTRAINT employee_access_role_check CHECK (
                    access_role IS NULL OR access_role IN (
                        'EMPLOYEE', 'BRANCH_MANAGER', 'PROGRAMMING_OPERATOR', 'PROGRAMMING_APPROVER',
                        'FINANCE_OFFICER', 'FINANCE_APPROVER', 'COMMERCIAL_MANAGER', 'COMMERCIAL_APPROVER',
                        'SECURITY_AUDITOR', 'SYSTEM_ADMIN'
                    )
                )
                """);
        jdbcTemplate.execute("ALTER TABLE employee DROP CONSTRAINT IF EXISTS employee_position_check");
        jdbcTemplate.execute("""
                ALTER TABLE employee ADD CONSTRAINT employee_position_check CHECK (
                    position IS NULL OR position IN (
                        'TEAM_MEMBER', 'SUPERVISOR', 'ASSISTANT_MANAGER', 'CINEMA_MANAGER',
                        'PROGRAMMING_OPERATOR', 'PROGRAMMING_APPROVER', 'FINANCE_OFFICER', 'FINANCE_APPROVER',
                        'COMMERCIAL_MANAGER', 'COMMERCIAL_APPROVER', 'SYSTEM_ADMINISTRATOR', 'SECURITY_AUDITOR',
                        'STAFF', 'MANAGER'
                    )
                )
                """);
        jdbcTemplate.update("INSERT INTO user_catalog_migration(version) VALUES (?)", version);
        log.info("[Migration] Employee constraints now support the complete staff role catalog");
    }
}
