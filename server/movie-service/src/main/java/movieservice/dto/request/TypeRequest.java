package movieservice.dto.request;

import jakarta.persistence.Column;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@AllArgsConstructor
@NoArgsConstructor
public class TypeRequest {

    @NotBlank(message = "Type name must not be blank")
    @Size(min = 2, max = 50, message = "Type name must be between 2 and 50 characters")
    private String typeName;
}
