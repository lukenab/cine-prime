package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.PresentationSystem;

import java.math.BigDecimal;
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

    // Ma phong ngan (VD "R01") do wizard tao phong chi tiet dung; null voi phong tao
    // qua flow nhanh cu (AddCinemaRoomModal). Trim + uppercase o CinemaRoomService.
    @Column(name = "room_code", length = 20)
    String roomCode;

    // ── Wizard fields (nullable — chi duoc dien khi tao/sua phong qua wizard) ──

    @Column(name = "length_m", precision = 6, scale = 2)
    BigDecimal lengthM;

    @Column(name = "width_m", precision = 6, scale = 2)
    BigDecimal widthM;

    @Column(name = "clear_height_m", precision = 6, scale = 2)
    BigDecimal clearHeightM;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auditorium_class_id")
    AuditoriumClass auditoriumClass;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "projection_technology_id")
    ProjectionTechnology projectionTechnology;

    @Enumerated(EnumType.STRING)
    @Column(name = "presentation_system", nullable = false, length = 30)
    @Builder.Default
    PresentationSystem presentationSystem = PresentationSystem.STANDARD;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolution_id")
    Resolution resolution;

    @Column(name = "screen_width_m", precision = 6, scale = 2)
    BigDecimal screenWidthM;

    @Column(name = "screen_height_m", precision = 6, scale = 2)
    BigDecimal screenHeightM;

    @Column(name = "supports_2d", nullable = false)
    @Builder.Default
    Boolean supports2d = true;

    @Column(name = "supports_3d", nullable = false)
    @Builder.Default
    Boolean supports3d = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "audio_format_id")
    AudioFormat audioFormat;

    // totalSeatCapacity = numberOfRows * seatsPerRow, tinh o server (CinemaRoomService),
    // khong nhan truc tiep tu client — xem numberOfRows/seatsPerRow ben duoi.
    @Column(name = "total_seat_capacity", nullable = false)
    Integer totalSeatCapacity;

    // So hang va so ghe/hang - dong bo tu RoomLayout dang ACTIVE luc activate() (xem
    // RoomLayoutService), dung cho aisle-detection (MovieMapper) va hien thi danh sach phong
    // (ClusterDetailPage). Phan bo seat-type that (Standard/VIP/Couple) nam o
    // RoomLayoutPosition.seatType, khong con o cap phong nua.
    @Column(name = "number_of_rows", nullable = false)
    Integer numberOfRows;

    @Column(name = "seats_per_row", nullable = false)
    Integer seatsPerRow;

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

    // Capability is modelled as an entity because each room-format relation has
    // its own enabled flag and audit fields. RoomType remains descriptive only.
    @OneToMany(mappedBy = "cinemaRoom", fetch = FetchType.LAZY)
    List<CinemaRoomFormat> formatCapabilities;

    @OneToMany(mappedBy = "cinemaRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    List<CinemaRoomMaintenance> maintenanceHistory;

    @OneToMany(mappedBy = "cinemaRoom", fetch = FetchType.LAZY)
    List<RoomLayout> layouts;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cluster_id")
    CinemaCluster cluster;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = CinemaRoomStatus.ACTIVE;
        if (presentationSystem == null) presentationSystem = PresentationSystem.STANDARD;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
