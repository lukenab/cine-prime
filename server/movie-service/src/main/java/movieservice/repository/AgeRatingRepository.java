package movieservice.repository;

import movieservice.entity.AgeRating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AgeRatingRepository extends JpaRepository<AgeRating, Integer> {
    Optional<AgeRating> findByRatingCode(String ratingCode);
}
