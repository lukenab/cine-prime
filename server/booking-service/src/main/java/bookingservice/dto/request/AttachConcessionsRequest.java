package bookingservice.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.util.List;

@Data
public class AttachConcessionsRequest {
    @NotEmpty
    private List<@Valid Item> items;

    @Data
    public static class Item {
        @NotBlank
        private String sellableType;
        @NotNull
        private Long sellableId;
        @NotNull @Min(1) @Max(20)
        private Integer quantity;
        private List<@Valid Selection> selections;
    }

    @Data
    public static class Selection {
        @NotBlank
        private String groupCode;
        @NotEmpty
        private List<@NotNull Long> skuIds;
    }
}
