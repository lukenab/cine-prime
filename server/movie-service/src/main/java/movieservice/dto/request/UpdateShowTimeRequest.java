package movieservice.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;


@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UpdateShowTimeRequest {

    Long movieId;
    Long cinemaRoomId;
    LocalDate showDate;
    LocalTime startTime;

    @DecimalMin(value = "0.01", message = "Base price must be greater than 0")
    @Digits(integer = 8, fraction = 2,
            message = "Base price must have at most 8 integer digits and 2 decimal places")
    BigDecimal basePrice;

    @JsonIgnore
    boolean basePricePresent;

    @JsonSetter("basePrice")
    public void setBasePrice(BigDecimal basePrice) {
        this.basePrice = basePrice;
        this.basePricePresent = true;
    }
}
