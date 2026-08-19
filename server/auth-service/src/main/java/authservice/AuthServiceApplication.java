package authservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication(scanBasePackages = {"authservice", "movie.theater.common"})
@EnableScheduling
public class AuthServiceApplication {

	static {
		// PostgreSQL does not accept the legacy Windows/JVM alias "Asia/Saigon".
		// Set the canonical zone before the datasource is initialized (including tests).
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
	}

	public static void main(String[] args) {
		SpringApplication.run(AuthServiceApplication.class, args);
	}

}
