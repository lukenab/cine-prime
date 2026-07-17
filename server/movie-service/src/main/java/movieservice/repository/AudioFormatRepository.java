package movieservice.repository;

import movieservice.entity.AudioFormat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AudioFormatRepository extends JpaRepository<AudioFormat, Integer> {
    List<AudioFormat> findByActiveTrue();
}
