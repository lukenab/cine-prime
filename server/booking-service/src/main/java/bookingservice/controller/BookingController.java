package bookingservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import bookingservice.dto.request.BookingPayload;
import bookingservice.dto.response.BookingConfirmation;
import bookingservice.service.BookingService;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    @PostMapping
    public ResponseEntity<Object> createBooking(@RequestBody BookingPayload payload) {
        BookingConfirmation confirmation = bookingService.createBooking(payload);
        
        // Wrap with ApiResponse if needed, but for now returning a generic structure that matches the frontend
        // Assuming frontend expects { "result": { ... } } or similar based on `response?.result ?? response`
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("code", 1000);
        response.put("result", confirmation);
        
        return ResponseEntity.ok(response);
    }
}
