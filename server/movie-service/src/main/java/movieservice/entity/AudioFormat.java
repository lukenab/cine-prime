package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Entity
@Table(name = "audio_format")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AudioFormat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "audio_format_id")
    Integer audioFormatId;

    @Column(name = "format_code", nullable = false, unique = true, length = 20)
    String formatCode;         // DOLBY_5_1, DOLBY_7_1, DOLBY_ATMOS

    @Column(name = "format_name", nullable = false, length = 100)
    String formatName;

    @Column(name = "active", nullable = false)
    @Builder.Default
    Boolean active = true;
}
