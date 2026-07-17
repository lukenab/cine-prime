package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.DayOfWeek;
import java.time.LocalTime;

@Entity
@Table(
        name = "cinema_cluster_operating_hour",
        uniqueConstraints = @UniqueConstraint(name = "uq_cluster_operating_day", columnNames = {"cluster_id", "day_of_week"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaClusterOperatingHour {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "operating_hour_id")
    Long operatingHourId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cluster_id", nullable = false)
    CinemaCluster cluster;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 9)
    DayOfWeek dayOfWeek;

    @Column(name = "opens_at")
    LocalTime opensAt;

    @Column(name = "closes_at")
    LocalTime closesAt;

    @Column(name = "closes_next_day", nullable = false)
    boolean closesNextDay;

    @Column(name = "is_closed", nullable = false)
    boolean closed;
}
