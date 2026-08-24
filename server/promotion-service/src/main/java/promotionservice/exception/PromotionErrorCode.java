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
    PROMOTION_INVALID_TRANSITION(2607, "Promotion lifecycle transition is invalid.", HttpStatus.CONFLICT),
    PROMOTION_SELF_APPROVAL_FORBIDDEN(2608, "The submitter cannot approve or reject the same promotion.", HttpStatus.FORBIDDEN),
    PROMOTION_ACTOR_REQUIRED(2609, "An authenticated account is required for this promotion action.", HttpStatus.UNAUTHORIZED),
    PROMOTION_ACTION_REASON_REQUIRED(2610, "A business reason is required for this promotion action.", HttpStatus.BAD_REQUEST),
    PROMOTION_NOT_APPLICABLE(2701, "Promotion is not applicable.", HttpStatus.CONFLICT),
    PROMOTION_QUOTA_EXHAUSTED(2702, "Promotion quota is exhausted.", HttpStatus.CONFLICT),
    PROMOTION_RESERVATION_NOT_FOUND(2703, "Promotion reservation not found.", HttpStatus.NOT_FOUND),
    PROMOTION_RESERVATION_EXPIRED(2704, "Promotion reservation has expired.", HttpStatus.GONE),
    PROMOTION_RESERVATION_INVALID_STATE(2705, "Promotion reservation lifecycle is invalid.", HttpStatus.CONFLICT),
    PROMOTION_IDEMPOTENCY_CONFLICT(2706, "Idempotency key is already used by another reservation request.", HttpStatus.CONFLICT),
    INTERNAL_UNAUTHORIZED(2707, "Internal service authentication failed.", HttpStatus.UNAUTHORIZED);

    private final int code;
    private final String message;
    private final HttpStatusCode statusCode;
}
