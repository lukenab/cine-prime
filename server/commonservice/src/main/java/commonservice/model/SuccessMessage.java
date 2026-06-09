package  commonservice.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SuccessMessage {
    private String code;
    private String message;
    private String status;
    private LocalDate localDate;
}
