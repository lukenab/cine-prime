package movieservice.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Entity
@Table(name = "production_company")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProductionCompany {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "company_id")
    Long companyId;

    @Column(name = "name", nullable = false, unique = true, length = 255)
    String name;

    @Column(name = "country", length = 100)
    String country;

    @Column(name = "logo_url", length = 500)
    String logoUrl;

    @Column(name = "website_url", length = 500)
    String websiteUrl;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;
}
