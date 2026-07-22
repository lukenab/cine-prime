package movieservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import lombok.*;


import java.io.Serializable;

@Embeddable
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@EqualsAndHashCode
public class ShowtimeAllocationFormatPriorityId implements Serializable {

    @Column(name = "policy_id")
    Long policyId;

    @Column(name = "format_id")
    Integer formatId;


}
