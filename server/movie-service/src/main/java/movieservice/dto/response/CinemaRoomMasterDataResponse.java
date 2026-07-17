package movieservice.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoomMasterDataResponse {
    List<MasterDataItemResponse> auditoriumClasses;
    List<MasterDataItemResponse> projectionTechnologies;
    List<MasterDataItemResponse> resolutions;
    List<MasterDataItemResponse> audioFormats;
    List<RoomConfigurationTemplateResponse> roomTemplates;
    List<String> presentationSystems;

    // Enum-backed, khong phai master table (logic-bound — xem CLAUDE_CINEMA_ROOM_IMPLEMENTATION_PROMPT.md §5)
    List<String> seatTypes;
    List<String> numberingDirections;
    List<String> layoutPositionTypes;
    List<String> roomStatuses;
    List<String> layoutStatuses;
}
