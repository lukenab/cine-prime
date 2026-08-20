package workforceservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ComponentScan(basePackages = {"workforceservice", "movie.theater.common"})
@EnableDiscoveryClient
@EnableScheduling
public class WorkforceServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(WorkforceServiceApplication.class, args);
    }
}
