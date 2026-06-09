package userservice.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
@Entity
@Table(name = "member")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Member {
     @Id
    @Column(name = "member_id", length = 10)
    private String memberId;

    @OneToOne
    @JoinColumn(name = "account_id", referencedColumnName = "account_id")
    private User user;

    @Column(name = "loyalty_points")
    private Integer loyaltyPoints;

    @Column(name = "membership_level", length = 20)
    private String membershipLevel;

    @Column(name = "total_spent", precision = 12, scale = 2)
    private BigDecimal totalSpent;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
