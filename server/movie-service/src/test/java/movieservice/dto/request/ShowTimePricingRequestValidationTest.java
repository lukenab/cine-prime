package movieservice.dto.request;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ShowTimePricingRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsNonPositiveAndInvalidPrecisionPrices() {
        CreateShowTimeRequest create = new CreateShowTimeRequest();
        create.setBasePrice(BigDecimal.ZERO);
        UpdateShowTimeRequest update = new UpdateShowTimeRequest();
        update.setBasePrice(new BigDecimal("100000000.00"));

        assertFalse(validator.validateProperty(create, "basePrice").isEmpty());
        assertFalse(validator.validateProperty(update, "basePrice").isEmpty());
    }

    @Test
    void acceptsNullOrValidPrice() {
        CreateShowTimeRequest create = new CreateShowTimeRequest();
        UpdateShowTimeRequest update = new UpdateShowTimeRequest();
        update.setBasePrice(new BigDecimal("120000.00"));

        assertTrue(validator.validateProperty(create, "basePrice").isEmpty());
        assertTrue(validator.validateProperty(update, "basePrice").isEmpty());
    }

    @Test
    void distinguishesMissingPriceFromExplicitNull() throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        UpdateShowTimeRequest missing = mapper.readValue("{}", UpdateShowTimeRequest.class);
        UpdateShowTimeRequest clear = mapper.readValue(
                "{\"basePrice\":null}", UpdateShowTimeRequest.class);

        assertFalse(missing.isBasePricePresent());
        assertTrue(clear.isBasePricePresent());
        assertNull(clear.getBasePrice());
    }
}
