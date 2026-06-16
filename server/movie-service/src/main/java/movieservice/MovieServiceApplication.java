package movieservice;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;



@SpringBootApplication
@ComponentScan(basePackages = {"movieservice", "movie.theater.common"})
@EnableScheduling
@EnableJpaAuditing
@EnableDiscoveryClient
public class MovieServiceApplication {

	public static void main(String[] args) {
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
		SpringApplication.run(MovieServiceApplication.class, args);
	}

}
