package movieservice.repository;



import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import movieservice.entity.ShowTime;

@Repository
public interface SheduleRepository extends JpaRepository<ShowTime, Long> {


}
