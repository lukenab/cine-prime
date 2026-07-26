package bookingservice;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.util.Set;
import java.util.TreeSet;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "spring.data.redis.repositories.enabled=false"
})
class BookingSchemaMigrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("booking_db")
                    .withUsername("postgres")
                    .withPassword("postgres");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    private final DataSource dataSource;

    @Autowired
    BookingSchemaMigrationTest(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Test
    void flywayCreatesCanonicalSchemaAndHibernateValidatesIt() throws Exception {
        Set<String> actualTables = new TreeSet<>();
        try (Connection connection = dataSource.getConnection();
             ResultSet tables = connection.getMetaData()
                     .getTables(null, "public", "%", new String[]{"TABLE"})) {
            while (tables.next()) {
                actualTables.add(tables.getString("TABLE_NAME"));
            }
        }

        assertThat(actualTables).contains(
                "booking",
                "booking_item",
                "booking_operation",
                "inventory_reservation",
                "payment_event_inbox",
                "compensation_task",
                "ticket",
                "booking_ticket_pass",
                "ticket_check_in",
                "booking_cancellation",
                "booking_refund",
                "outbox_event",
                "booking_reconciliation",
                "booking_reconciliation_attempt",
                "counter_payment",
                "booking_quote",
                "promotion_reservation",
                "loyalty_reservation",
                "booking_concession_item");
    }
}
