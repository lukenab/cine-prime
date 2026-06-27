package bookingservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import bookingservice.entity.BookingItem;
import jakarta.transaction.Transactional;

@Repository
public interface BookingItemRepository extends JpaRepository<BookingItem, Long> {
}