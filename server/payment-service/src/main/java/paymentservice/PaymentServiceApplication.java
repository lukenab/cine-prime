package paymentservice;

import java.util.TimeZone;

import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ComponentScan(basePackages = {"paymentservice", "movie.theater.common"})
@ConfigurationPropertiesScan
@EnableDiscoveryClient
@EnableScheduling
public class PaymentServiceApplication {

	public static void main(String[] args) {
		/*
		 * Windows may map "SE Asia Standard Time" to the deprecated IANA alias
		 * "Asia/Saigon". Recent PostgreSQL tzdata builds reject that alias during
		 * the JDBC startup handshake, before Flyway can obtain a connection.
		 *
		 * Persist timestamps in UTC. Business/VNPAY date calculations continue to
		 * use the explicitly configured Asia/Ho_Chi_Minh timezone.
		 */
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
		SpringApplication.run(PaymentServiceApplication.class, args);
	}

}
