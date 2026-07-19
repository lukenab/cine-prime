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

    // Stable external identity for upsert (issue #151) - preferred over the previous
    // exact/case-sensitive name match, which could silently create duplicate rows for the same
    // real-world company. Null for companies created manually with no known TMDB equivalent.
    @Column(name = "tmdb_company_id", unique = true)
    Integer tmdbCompanyId;

    @Column(name = "country", length = 100)
    String country;

    @Column(name = "logo_url", length = 500)
    String logoUrl;

    @Column(name = "website_url", length = 500)
    String websiteUrl;

    @Column(name = "created_at", updatable = false)
    LocalDateTime createdAt;
}
