package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoomConfigurationTemplateResponse {
    Integer id;
    String code;
    String name;
    String description;

    Integer auditoriumClassId;
    Integer projectionTechnologyId;
    Integer resolutionId;
    Integer audioFormatId;
    Boolean supports2d;
    Boolean supports3d;

    Integer numberOfRows;
    Integer maxPositionsPerRow;
    String layoutTemplateCode;
    Integer standardRowPercentage;
    Boolean coupleLastRow;
    Boolean centerAisle;
    Boolean crossAisle;
}
