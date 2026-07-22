package movieservice.repository;

import movieservice.entity.SchedulePlanSlot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SchedulePlanSlotRepository extends JpaRepository<SchedulePlanSlot, Long> {
}

