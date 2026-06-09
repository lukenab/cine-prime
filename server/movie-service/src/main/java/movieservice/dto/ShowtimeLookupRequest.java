package movieservice.dto;

import java.util.List;

import lombok.Data;

@Data
public class ShowtimeLookupRequest {
    private List<Long> movieIds;
    private List<Long> roomIds;
    private List<Integer> showTimeIds;
}
