package movieservice.migration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * DB-01: proves the Flyway setup handles both scenarios the issue calls out —
 * a genuinely empty/fresh database, and a database that was hand-migrated
 * before Flyway existed (full schema already present, no flyway_schema_history
 * row yet). Each scenario runs against its own throwaway Testcontainers
 * Postgres so the two don't interfere with each other.
 */
@Testcontainers(disabledWithoutDocker = true)
class FlywayMigrationIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> FRESH_DB = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("movie_flyway_fresh_test")
            .withUsername("test")
            .withPassword("test");

    @Container
    static final PostgreSQLContainer<?> PRE_EXISTING_DB = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("movie_flyway_upgrade_test")
            .withUsername("test")
            .withPassword("test");

    private Flyway flywayFor(PostgreSQLContainer<?> container) {
        return Flyway.configure()
                .dataSource(container.getJdbcUrl(), container.getUsername(), container.getPassword())
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("1")
                .load();
    }

    @Test
    void freshDatabaseRunsEveryMigrationFromScratch() throws Exception {
        MigrateResult result = flywayFor(FRESH_DB).migrate();

        assertTrue(result.success);
        // V1..V7 (versioned) + R (repeatable seed) all actually executed — a fresh DB has no
        // prior state for baselineOnMigrate to kick in on.
        assertEquals(8, result.migrationsExecuted);

        try (Connection conn = DriverManager.getConnection(
                FRESH_DB.getJdbcUrl(), FRESH_DB.getUsername(), FRESH_DB.getPassword());
             Statement st = conn.createStatement()) {

            assertTrue(tableExists(st, "movie"));
            assertTrue(tableExists(st, "cinema_cluster"));
            assertTrue(tableExists(st, "movie_availability"));
            assertTrue(tableExists(st, "auditorium_class"));
            assertFalse(tableExists(st, "type"), "legacy 'type' table must never be created fresh");

            try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM genre")) {
                rs.next();
                assertEquals(15, rs.getInt(1), "genre seed data must be present on a fresh install");
            }
            try (ResultSet rs = st.executeQuery(
                    "SELECT COUNT(*) FROM auditorium_class WHERE class_code IN ('PLF','MOTION')")) {
                rs.next();
                assertEquals(0, rs.getInt(1), "deprecated PLF/MOTION rows must never be seeded fresh");
            }
        }
    }

    @Test
    void handMigratedDatabaseBaselinesInsteadOfReplayingSchema() throws Exception {
        // 1. Build the database the same way "hand migration before Flyway existed" left it:
        //    run the migrations once, then erase Flyway's own paper trail.
        Flyway bootstrap = flywayFor(PRE_EXISTING_DB);
        bootstrap.migrate();

        try (Connection conn = DriverManager.getConnection(
                PRE_EXISTING_DB.getJdbcUrl(), PRE_EXISTING_DB.getUsername(), PRE_EXISTING_DB.getPassword());
             Statement st = conn.createStatement()) {
            st.execute("DROP TABLE flyway_schema_history");
        }

        // 2. This is the real scenario under test: movie-service starts up against a
        //    database that already has the full schema but no flyway_schema_history —
        //    exactly the state the live dev database was in before this issue.
        Flyway flyway = flywayFor(PRE_EXISTING_DB);
        MigrateResult result = flyway.migrate();

        assertTrue(result.success);

        // Re-running startup (e.g. a second app instance, or a restart) must be a clean no-op.
        MigrateResult secondRun = flyway.migrate();
        assertEquals(0, secondRun.migrationsExecuted);

        try (Connection conn = DriverManager.getConnection(
                PRE_EXISTING_DB.getJdbcUrl(), PRE_EXISTING_DB.getUsername(), PRE_EXISTING_DB.getPassword());
             Statement st = conn.createStatement()) {
            // Ground truth: Flyway actually recorded a BASELINE row at version 1 rather
            // than replaying V1's CREATE TABLE statements against tables that already existed.
            try (ResultSet rs = st.executeQuery(
                    "SELECT type, success FROM flyway_schema_history WHERE version = '1'")) {
                assertTrue(rs.next(), "Expected a flyway_schema_history row for version 1");
                assertEquals("BASELINE", rs.getString("type"));
                assertTrue(rs.getBoolean("success"));
            }

            assertTrue(tableExists(st, "movie"));
            try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM cinema_cluster")) {
                rs.next();
                assertTrue(rs.getInt(1) > 0, "seed clusters must survive baselining unchanged");
            }
        }
    }

    private boolean tableExists(Statement st, String tableName) throws Exception {
        try (ResultSet rs = st.executeQuery("SELECT to_regclass('" + tableName + "') IS NOT NULL AS present")) {
            rs.next();
            return rs.getBoolean("present");
        }
    }
}
