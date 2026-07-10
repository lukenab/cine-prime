package movieservice.validator;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = ProvinceValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidProvince {
    String message() default "Invalid province. Must be one of the allowed provinces in Vietnam.";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
