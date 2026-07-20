package movieservice.dto.request;

import lombok.Getter;

/** Optional - unlike SuspendRequest, closing doesn't require justification. */
@Getter
public class CloseRequest {

    String reason;
}
