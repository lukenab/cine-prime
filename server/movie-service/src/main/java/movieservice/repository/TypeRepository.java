package movieservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import movieservice.entity.Type;

public interface TypeRepository extends JpaRepository<Type, Integer> {
    
}
