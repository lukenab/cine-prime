package promotionservice;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import promotionservice.service.PromotionAdminService;
import promotionservice.service.PromotionEligibilityService;
import promotionservice.service.PromotionPublicQueryService;

@SpringBootTest(properties = {
        "spring.autoconfigure.exclude="
                + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,"
                + "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration",
        "eureka.client.enabled=false"
})
class PromotionServiceApplicationTests {

	@MockBean
	PromotionAdminService promotionAdminService;

	@MockBean
	PromotionEligibilityService promotionEligibilityService;

	@MockBean
	PromotionPublicQueryService promotionPublicQueryService;

	@Test
	void contextLoads() {
	}

}
