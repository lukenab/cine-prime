package movieservice.repository;

import movieservice.entity.Person;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PersonRepository extends JpaRepository<Person, Long> {
    Optional<Person> findByTmdbId(Integer tmdbId);
    boolean existsByFullNameIgnoreCase(String fullName);
}
