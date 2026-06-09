package movieservice.dto;

import jakarta.persistence.Column;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class TypeDTO {
    @Column(name = "type_id")
    private Long typeId;

    @Column(name = "type_name", length = 255)
    private String typeName; 
}
