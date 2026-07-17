package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Entity
@Table(name = "room_configuration_template")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoomConfigurationTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "template_id")
    Integer templateId;

    @Column(name = "template_code", nullable = false, unique = true, length = 40)
    String templateCode;

    @Column(name = "template_name", nullable = false, length = 100)
    String templateName;

    @Column(name = "description", length = 255)
    String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "auditorium_class_id", nullable = false)
    AuditoriumClass auditoriumClass;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "projection_technology_id", nullable = false)
    ProjectionTechnology projectionTechnology;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "resolution_id", nullable = false)
    Resolution resolution;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "audio_format_id", nullable = false)
    AudioFormat audioFormat;

    @Column(name = "supports_2d", nullable = false)
    @Builder.Default
    Boolean supports2d = true;

    @Column(name = "supports_3d", nullable = false)
    @Builder.Default
    Boolean supports3d = false;

    @Column(name = "default_rows", nullable = false)
    Integer defaultRows;

    @Column(name = "default_positions_per_row", nullable = false)
    Integer defaultPositionsPerRow;

    @Column(name = "layout_template_code", nullable = false, length = 40)
    String layoutTemplateCode;

    @Column(name = "standard_row_percentage", nullable = false)
    Integer standardRowPercentage;

    @Column(name = "couple_last_row", nullable = false)
    @Builder.Default
    Boolean coupleLastRow = false;

    @Column(name = "center_aisle", nullable = false)
    @Builder.Default
    Boolean centerAisle = false;

    @Column(name = "cross_aisle", nullable = false)
    @Builder.Default
    Boolean crossAisle = false;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    Integer displayOrder = 0;

    @Column(name = "active", nullable = false)
    @Builder.Default
    Boolean active = true;
}
