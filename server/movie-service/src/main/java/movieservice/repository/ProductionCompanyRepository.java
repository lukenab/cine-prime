package movieservice.repository;

import movieservice.entity.ProductionCompany;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductionCompanyRepository extends JpaRepository<ProductionCompany, Long> {
    Optional<ProductionCompany> findByName(String name);
    List<ProductionCompany> findByNameContainingIgnoreCase(String keyword);
    Optional<ProductionCompany> findByTmdbCompanyId(Integer tmdbCompanyId);
    List<ProductionCompany> findAllByCompanyIdIn(List<Long> companyIds);
}
