package concessionservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class ConcessionServiceApplication {
    public static void main(String[] args) {
        // Windows can expose the deprecated Asia/Saigon alias, which PostgreSQL
        // rejects during the JDBC startup handshake. Store persistence timestamps
        // in UTC; business-local conversion should be explicit at the API boundary.
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        SpringApplication.run(ConcessionServiceApplication.class, args);
    }
}
