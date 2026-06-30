    package userservice.entity;

    import java.time.LocalDate;
    import java.time.LocalDateTime;

    import org.hibernate.annotations.CreationTimestamp;
    import org.hibernate.annotations.UpdateTimestamp;
    import org.springframework.data.annotation.CreatedDate;

    import jakarta.persistence.Column;
    import jakarta.persistence.Entity;
    import jakarta.persistence.Id;
    import jakarta.persistence.OneToOne;
    import jakarta.persistence.Table;
    import lombok.AllArgsConstructor;
    import lombok.Builder;
    import lombok.Getter;
    import lombok.NoArgsConstructor;
    import lombok.Setter;

    @Entity
    @Table(name = "users")
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public class User {
        @Id
        @Column(name = "account_id", length = 36)
        private String accountId;

        @Column(name = "full_name", nullable = false, length = 100)
        private String fullName;

        @Column(name = "phone_number", length = 15)
        private String phoneNumber;

        @Column(name = "date_of_birth")
        private LocalDate dateOfBirth;

        @Column(name = "gender", length = 20)
        private String gender;

        @Column(name = "address", length = 255)
        private String address;

        @Column(name = "identity_card", length = 20)
        private String identityCard;

        @Column(name = "email", length = 255)
        private  String email;

        @Column(name = "avatar_url", length = 255)
        private String avatarUrl;

        @CreationTimestamp
        @Column(name = "created_at")
        private LocalDateTime createdAt;
        @UpdateTimestamp
        @Column(name = "updated_at")
        private LocalDateTime updatedAt;

        @Column(name = "is_active", nullable = false)
        private Boolean isActive = true;

        @OneToOne(mappedBy = "user")
        private Member member;

        @OneToOne(mappedBy = "user")
        private Employee employee;
    }
