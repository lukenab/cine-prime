package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import movieservice.enums.PriceBookStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "price_book")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PriceBook {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "price_book_id")
    Long priceBookId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cluster_id", nullable = false)
    CinemaCluster cluster;

    @Column(nullable = false, unique = true, length = 50)
    String code;

    @Column(nullable = false, length = 150)
    String name;

    @Column(name = "currency_code", nullable = false, length = 3)
    @Builder.Default
    String currencyCode = "VND";

    @Column(name = "valid_from", nullable = false)
    LocalDate validFrom;

    @Column(name = "valid_to")
    LocalDate validTo;

    @Column(nullable = false)
    @Builder.Default
    Integer priority = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    PriceBookStatus status = PriceBookStatus.DRAFT;

    @Builder.Default
    @OneToMany(mappedBy = "priceBook", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("priority DESC, priceRateId ASC")
    List<PriceRate> rates = new ArrayList<>();

    @Column(name = "created_by", length = 100)
    String createdBy;

    @Column(name = "updated_by", length = 100)
    String updatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    LocalDateTime updatedAt;

    public void replaceRates(List<PriceRate> newRates) {
        rates.clear();
        newRates.forEach(rate -> {
            rate.setPriceBook(this);
            rates.add(rate);
        });
    }

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (currencyCode == null) currencyCode = "VND";
        if (priority == null) priority = 0;
        if (status == null) status = PriceBookStatus.DRAFT;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
