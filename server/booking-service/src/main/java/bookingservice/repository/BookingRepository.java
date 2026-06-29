package bookingservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import bookingservice.entity.Booking;

@Repository
public interface BookingRepository extends JpaRepository<Booking, String> {
}
