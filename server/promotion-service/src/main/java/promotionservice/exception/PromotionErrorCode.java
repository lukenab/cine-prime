package promotionservice.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import movie.theater.common.exception.BaseErrorCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

@Getter
@AllArgsConstructor
public enum PromotionErrorCode implements BaseErrorCode {
    PROMOTION_NOT_FOUND(2601, "Promotion not found.", HttpStatus.NOT_FOUND),
    PROMOTION_CODE_EXISTS(2602, "Promotion code already exists.", HttpStatus.CONFLICT),
    PROMOTION_INVALID_RULE(2603, "Promotion price rule is invalid.", HttpStatus.BAD_REQUEST),
    PROMOTION_INVALID_TARGET(2604, "Promotion target is invalid.", HttpStatus.BAD_REQUEST),
    PROMOTION_INVALID_WINDOW(2605, "Promotion validity window is invalid.", HttpStatus.BAD_REQUEST),
    PROMOTION_NOT_DRAFT(2606, "Only a DRAFT promotion can be edited.", HttpStatus.CONFLICT),
    PROMOTION_INVALID_TRANSITION(2607, "Promotion lifecycle transition is invalid.", HttpStatus.CONFLICT);

    private final int code;
    private final String message;
    private final HttpStatusCode statusCode;
}
