package movieservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import movieservice.entity.MovieType;


public interface TypeMovieRepository extends JpaRepository<MovieType, Long> {
    Boolean existsByTypeName(String typeName);
}
