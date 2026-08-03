package bookingservice.dto.request;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReverseMovieSeatSaleRequest {
    private String bookingId;
}
