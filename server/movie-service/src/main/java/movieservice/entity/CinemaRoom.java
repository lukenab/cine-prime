package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.RoomType;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "cinema_room")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cinema_room_id")
    Long cinemaRoomId;

    @Column(name = "cinema_room_name", nullable = false, unique = true, length = 100)
    String cinemaRoomName;

    @Enumerated(EnumType.STRING)
    @Column(name = "room_type", nullable = false, length = 20)
    RoomType roomType;

    // Đổi tên từ seat_quantity → total_seat_capacity cho rõ nghĩa hơn
    @Column(name = "total_seat_capacity", nullable = false)
    Integer totalSeatCapacity;

    // Boolean status → CinemaRoomStatus enum
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    CinemaRoomStatus status = CinemaRoomStatus.ACTIVE;

    @Column(name = "maintenance_note", columnDefinition = "TEXT")
    String maintenanceNote;

    @Column(name = "created_by", length = 100)
    String createdBy;

    @Column(name = "updated_by", length = 100)
    String updatedBy;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @OneToMany(mappedBy = "cinemaRoom", fetch = FetchType.LAZY)
    List<Seat> seats;

    @OneToMany(mappedBy = "cinemaRoom", fetch = FetchType.LAZY)
    List<ShowTime> showTimes;

    @OneToMany(mappedBy = "cinemaRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    List<CinemaRoomMaintenance> maintenanceHistory;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = CinemaRoomStatus.ACTIVE;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
