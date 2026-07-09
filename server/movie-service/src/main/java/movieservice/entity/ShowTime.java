package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.ShowTimeStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "show_time")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ShowTime {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "showtime_id")
    Long showTimeId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "movie_id", nullable = false)
    Movie movie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cinema_room_id", nullable = false)
    CinemaRoom cinemaRoom;

    /** FK → screening_format (nullable — không bắt buộc chọn định dạng) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "format_id")
    ScreeningFormat format;

    @Column(name = "show_date", nullable = false)
    LocalDate showDate;

    @Column(name = "start_time", nullable = false)
    LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    LocalTime endTime;

    /** Ngôn ngữ âm thanh, e.g. "vi", "en" */
    @Column(name = "language_code", length = 10)
    String languageCode;

    /** Ngôn ngữ phụ đề, e.g. "vi", "en" — null nếu không có phụ đề */
    @Column(name = "subtitle_code", length = 10)
    String subtitleCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    ShowTimeStatus status = ShowTimeStatus.SCHEDULED;

    /** Snapshot tổng số ghế của phòng tại thời điểm tạo suất */
    @Column(name = "total_seats")
    Integer totalSeats;

    /** Bộ đếm ghế đã bán — phải sync với COUNT(showtime_seat WHERE status=SOLD) */
    @Column(name = "sold_seats")
    @Builder.Default
    Integer soldSeats = 0;

    /** Lý do hủy suất — bắt buộc khi status = CANCELLED */
    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    String cancellationReason;

    @Column(name = "cancelled_at")
    LocalDateTime cancelledAt;

    @Column(name = "cancelled_by", length = 100)
    String cancelledBy;

    @Column(name = "created_by", length = 100)
    String createdBy;

    @Column(name = "updated_by", length = 100)
    String updatedBy;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at")
    LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = ShowTimeStatus.SCHEDULED;
        if (soldSeats == null) soldSeats = 0;
        if (languageCode == null) languageCode = "vi";
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
