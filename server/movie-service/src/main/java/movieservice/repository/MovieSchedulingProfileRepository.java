package movieservice.repository;

import movieservice.entity.MovieSchedulingProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MovieSchedulingProfileRepository extends JpaRepository<MovieSchedulingProfile, Long> {
    Optional<MovieSchedulingProfile> findByMovie_MovieId(Long id);
}
