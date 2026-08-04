package promotionservice.migration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers(disabledWithoutDocker = true)
class PromotionSchemaMigrationIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("promotion_migration_test")
            .withUsername("test")
            .withPassword("test");

    private Flyway flyway() {
        return Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .load();
    }

    @Test
    void freshDatabaseCreatesPromotionSchemaAndEnforcesCoreInvariants() throws Exception {
        MigrateResult result = flyway().migrate();
        assertTrue(result.success);
        assertEquals(4, result.migrationsExecuted);

        try (Connection connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             Statement statement = connection.createStatement()) {

            assertTrue(tableExists(statement, "promotion"));
            assertTrue(tableExists(statement, "promotion_target"));
            assertTrue(tableExists(statement, "promotion_price_rule"));
            assertTrue(tableExists(statement, "promotion_reservation"));
            assertTrue(tableExists(statement, "promotion_usage_ledger"));
            assertTrue(tableExists(statement, "promotion_audit_log"));

            statement.execute("""
                    INSERT INTO promotion (code, name, status, global_usage_limit)
                    VALUES (' summer10 ', 'Summer 10', 'ACTIVE', 10)
                    """);

            try (var resultSet = statement.executeQuery("SELECT code FROM promotion WHERE name = 'Summer 10'")) {
                assertTrue(resultSet.next());
                assertEquals("SUMMER10", resultSet.getString("code"));
            }

            assertThrows(SQLException.class, () -> statement.execute("""
                    INSERT INTO promotion (code, name)
                    VALUES ('summer10', 'Duplicate code')
                    """));

            assertThrows(SQLException.class, () -> statement.execute("""
                    INSERT INTO promotion_price_rule (promotion_id, discount_type, percentage)
                    SELECT promotion_id, 'PERCENTAGE', 100.01
                    FROM promotion WHERE code = 'SUMMER10'
                    """));
        }

        MigrateResult secondRun = flyway().migrate();
        assertEquals(0, secondRun.migrationsExecuted);
    }

    private boolean tableExists(Statement statement, String tableName) throws SQLException {
        try (var resultSet = statement.executeQuery(
                "SELECT to_regclass('" + tableName + "') IS NOT NULL AS present")) {
            resultSet.next();
            return resultSet.getBoolean("present");
        }
    }
}
