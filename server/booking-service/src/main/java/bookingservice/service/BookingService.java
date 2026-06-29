package bookingservice.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import lombok.RequiredArgsConstructor;
import bookingservice.dto.request.BookingPayload;
import bookingservice.dto.response.BookingConfirmation;
import bookingservice.entity.Booking;
import bookingservice.repository.BookingRepository;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final RestTemplate restTemplate;

    @Transactional
    public BookingConfirmation createBooking(BookingPayload payload) {
        // 1. Call movie-service to lock seats
        String lockUrl = "http://movie-service/api/showtimes/" + payload.getShowtimeId() + "/seats/lock";
        
        HttpEntity<java.util.List<Long>> request = new HttpEntity<>(payload.getSeatIds());
        ResponseEntity<Object> response = restTemplate.exchange(lockUrl, HttpMethod.PUT, request, Object.class);
        
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("Failed to lock seats in movie-service");
        }

        // 2. Create Booking record
        Booking booking = new Booking();
        booking.setBookingId(UUID.randomUUID().toString());
        booking.setAccountId("00000000-0000-0000-0000-000000000000"); // Mock or get from context
        booking.setShowtimeId(payload.getShowtimeId());
        
        // Hardcoded values to satisfy non-null constraints in entity temporarily
        booking.setTotalAmount(new BigDecimal("100000.00"));
        booking.setFinalAmount(new BigDecimal("100000.00"));
        booking.setBookingType(Booking.BookingType.ONLINE);
        booking.setStatus(Booking.BookingStatus.PENDING);
        
        LocalDateTime lockedUntil = LocalDateTime.now().plusMinutes(15);
        booking.setExpiresAt(lockedUntil);
        
        bookingRepository.save(booking);

        return BookingConfirmation.builder()
                .bookingId(booking.getBookingId())
                .lockedUntil(lockedUntil)
                .build();
    }
}
