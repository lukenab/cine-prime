package movieservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import movieservice.entity.MovieActionLog;

public interface MovieActionLogRepository extends JpaRepository<MovieActionLog, String>  {
    
}
