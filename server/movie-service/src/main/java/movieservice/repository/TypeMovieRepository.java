package movieservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import movieservice.entity.MovieType;


@Repository
public interface TypeMovieRepository extends JpaRepository<MovieType, Long> {
    MovieType findByTypeId(Long typeId);
    Boolean existsByTypeName(String typeName);
}
