package authservice.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {
    String action(); // e.g., "REGISTRATION_INITIATED"
    String successMessage() default ""; // e.g., "Registration OTP sent"
}
