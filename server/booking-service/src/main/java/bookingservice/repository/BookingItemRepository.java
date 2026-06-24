package bookingservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import bookingservice.entity.BookingItem;

@Repository
public interface BookingItemRepository extends JpaRepository<BookingItem, Long> {
}