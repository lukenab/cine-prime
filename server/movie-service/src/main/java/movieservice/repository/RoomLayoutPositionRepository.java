package movieservice.repository;

import movieservice.entity.RoomLayoutPosition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoomLayoutPositionRepository extends JpaRepository<RoomLayoutPosition, Long> {

    List<RoomLayoutPosition> findByRoomLayoutRoomLayoutIdOrderByRowIndexAscColumnIndexAsc(Long roomLayoutId);

    void deleteByRoomLayoutRoomLayoutId(Long roomLayoutId);
}
