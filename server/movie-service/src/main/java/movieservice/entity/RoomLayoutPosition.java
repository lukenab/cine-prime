package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.LayoutPositionType;
import movieservice.enums.SeatStatus;
import movieservice.enums.SeatType;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "room_layout_position",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_layout_coordinate",
                columnNames = {"room_layout_id", "row_index", "column_index"}
        ))
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RoomLayoutPosition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "position_id")
    Long positionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_layout_id", nullable = false)
    RoomLayout roomLayout;

    @Column(name = "row_index", nullable = false)
    Integer rowIndex;

    @Column(name = "column_index", nullable = false)
    Integer columnIndex;

    @Column(name = "row_label", nullable = false, length = 5)
    String rowLabel;

    @Enumerated(EnumType.STRING)
    @Column(name = "position_type", nullable = false, length = 20)
    LayoutPositionType positionType;

    // Chi non-null khi positionType = SEAT — xem chk_position_seat_fields o migration.
    @Column(name = "seat_number")
    Integer seatNumber;

    @Column(name = "seat_code", length = 10)
    String seatCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "seat_type", length = 20)
    SeatType seatType;

    // Hai position Couple lien ke cung hang chia se 1 gia tri — nhom atomic.
    @Column(name = "seat_group_id", length = 36)
    String seatGroupId;

    @Enumerated(EnumType.STRING)
    @Column(name = "seat_status", nullable = false, length = 20)
    @Builder.Default
    SeatStatus seatStatus = SeatStatus.ACTIVE;

    @Column(name = "manual_override", nullable = false)
    @Builder.Default
    Boolean manualOverride = false;
}
