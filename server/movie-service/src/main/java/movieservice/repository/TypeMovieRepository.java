package movieservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import movieservice.entity.TypeMovie;


public interface TypeMovieRepository extends JpaRepository<TypeMovie, Long> {
    Boolean existsByTypeName(String typeName);
}
