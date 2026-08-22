package workforceservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@ComponentScan(basePackages = {"workforceservice", "movie.theater.common"})
@EnableDiscoveryClient
@EnableScheduling
public class WorkforceServiceApplication {
    public static void main(String[] args) {
        // PostgreSQL stores timestamps in UTC. Setting the JVM default before
        // DataSource initialization also prevents legacy aliases such as
        // Asia/Saigon from being sent in the PostgreSQL startup packet.
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        SpringApplication.run(WorkforceServiceApplication.class, args);
    }
}
