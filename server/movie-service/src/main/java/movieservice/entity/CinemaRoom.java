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
@Table(name = "cinema_room",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_room_name_per_cluster",
                columnNames = {"cluster_id", "cinema_room_name"}
        ))
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CinemaRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cinema_room_id")
    Long cinemaRoomId;

    @Column(name = "cinema_room_name", nullable = false, length = 100)
    String cinemaRoomName;

    @Enumerated(EnumType.STRING)
    @Column(name = "room_type", nullable = false, length = 20)
    RoomType roomType;

    // totalSeatCapacity = numberOfRows * seatsPerRow, tinh o server (CinemaRoomService),
    // khong nhan truc tiep tu client — xem numberOfRows/seatsPerRow ben duoi.
    @Column(name = "total_seat_capacity", nullable = false)
    Integer totalSeatCapacity;

    // So hang va so ghe/hang do admin chon khi tao phong (RoomType chi cung cap gia tri
    // mac dinh goi y + gioi han maxSeats, khong con ep cung seatsPerRow theo loai phong nua).
    @Column(name = "number_of_rows", nullable = false)
    Integer numberOfRows;

    @Column(name = "seats_per_row", nullable = false)
    Integer seatsPerRow;

    // Seat-zone allocation is persisted so the generated seat map can be audited or
    // regenerated without falling back to RoomType-specific assumptions.
    @Column(name = "standard_row_count", nullable = false)
    Integer standardRowCount;

    @Column(name = "vip_row_count", nullable = false)
    Integer vipRowCount;

    @Column(name = "couple_row_count", nullable = false)
    Integer coupleRowCount;

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cluster_id")
    CinemaCluster cluster;

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
