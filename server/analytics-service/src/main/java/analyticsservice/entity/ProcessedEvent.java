package analyticsservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.OffsetDateTime;

@Entity
@Table(name = "processed_event")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProcessedEvent {
    @Id
    @Column(name = "source_event_id", length = 100)
    String sourceEventId;

    @Column(name = "event_type", nullable = false, length = 100)
    String eventType;

    @Column(name = "processed_at", nullable = false)
    OffsetDateTime processedAt;
}
