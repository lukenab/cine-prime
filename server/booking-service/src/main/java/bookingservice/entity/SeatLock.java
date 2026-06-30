package bookingservice.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Entity
// Tạo unique constraint tầng Database tránh việc khóa trùng ghế trong cùng một suất chiếu
@Table(name = "seat_lock", uniqueConstraints = {
    @UniqueConstraint(name = "uc_showtime_seat", columnNames = {"showtime_id", "seat_id"})
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Builder
public class SeatLock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    // Các trường này đều là Plain fields đúng theo constraint đề bài yêu cầu
    @Column(name = "showtime_id", nullable = false)
    Long showtimeId;

    @Column(name = "seat_id", nullable = false)
    String seatId;

    @Column(name = "locked_by_account_id")
    String lockedByAccountId;

    @CreationTimestamp
    @Column(name = "locked_at", updatable = false)
    LocalDateTime lockedAt;

    @Column(name = "expires_at", nullable = false)
    LocalDateTime expiresAt;
}