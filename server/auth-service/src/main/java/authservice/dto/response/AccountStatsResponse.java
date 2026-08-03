package authservice.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AccountStatsResponse {
    private long total;
    private long active;
    private long pending;
    private long inactive;
    private long employees;
    private long newThisMonth;
}
