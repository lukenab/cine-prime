package movieservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.NumberingDirection;
import movieservice.enums.NumberingPolicy;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoomLayoutSaveRequest {

    // Generator echo — luu lai de hien thi lai form "Thiet ke so do ghe" khi mo lai
    // ban nhap; khong dung de tinh capacity (capacity tinh tu `positions` thuc te).
    Integer numberOfRows;
    Integer maxPositionsPerRow;
    String firstRowLabel;
    NumberingDirection numberingDirection;
    NumberingPolicy numberingPolicy;
    String generatorTemplateCode;
    Integer generatorTemplateVersion;
    String generationConfig;

    // Duoc phep rong khi con dang chinh sua (save draft); submit se tu choi neu rong.
    @NotNull
    @Valid
    List<LayoutPositionRequest> positions;
}
