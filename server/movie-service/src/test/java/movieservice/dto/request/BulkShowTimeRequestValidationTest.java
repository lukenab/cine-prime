package movieservice.dto.request;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.LongStream;

import static org.junit.jupiter.api.Assertions.assertTrue;

class BulkShowTimeRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsOversizedListsNullElementsAndPriceOutsideDecimalTenTwo() {
        BulkShowTimeRequest request = new BulkShowTimeRequest();
        request.setMovieId(1L);
        request.setCinemaRoomIds(LongStream.rangeClosed(1, 21).boxed().toList());
        request.setFromDate(LocalDate.now().plusDays(3));
        request.setToDate(LocalDate.now().plusDays(4));
        List<LocalTime> startTimes = new ArrayList<>();
        startTimes.add(null);
        request.setStartTimes(startTimes);
        request.setBasePrice(new BigDecimal("123456789.999"));

        Set<ConstraintViolation<BulkShowTimeRequest>> violations = validator.validate(request);

        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("cinemaRoomIds")));
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().contains("startTimes")));
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("basePrice")));
    }
}
