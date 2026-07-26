package movieservice.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import movieservice.enums.PresentationSystem;

import java.util.List;

/**
 * Immutable auditorium snapshot used by the customer seat-selection page.
 *
 * <p>The sellable {@code seats} carry live showtime status and price. The
 * {@code positions} carry the physical geometry from the layout version that
 * was active when that showtime inventory was materialized, including aisles,
 * exits and intentionally empty cells. Keeping both datasets together lets a
 * customer see the same auditorium plan that operations approved.</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShowtimeSeatMapResponse {
    private List<ShowtimeSeatDto> seats;
    private List<LayoutPositionResponse> positions;
    private PresentationSystem presentationSystem;
    private String projectionTechnologyCode;
    private String audioFormatCode;
    private String audioFormatName;
}
