package bookingservice.service;

import bookingservice.config.TicketPassCodec;
import bookingservice.config.TicketPassProperties;
import bookingservice.dto.request.TicketCheckInRequest;
import bookingservice.dto.response.TicketCheckInResponse;
import bookingservice.dto.response.TicketPassResponse;
import bookingservice.entity.*;
import bookingservice.repository.BookingTicketPassRepository;
import bookingservice.repository.TicketCheckInRepository;
import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;

import static bookingservice.exception.BookingErrorCode.*;

@Service
@RequiredArgsConstructor
public class TicketPassService {
    private final BookingTicketPassRepository passRepository;
    private final TicketCheckInRepository checkInRepository;
    private final TicketPassCodec codec;
    private final TicketPassProperties properties;
    private final BookingEventService bookingEventService;

    @Transactional
    public void issue(Booking booking) {
        if (booking.getTicketPass() != null
                || passRepository.findByBooking_BookingId(booking.getBookingId()).isPresent()) {
            return;
        }
        String token = codec.generateToken();
        BookingTicketPass pass = BookingTicketPass.builder()
                .booking(booking)
                .tokenHash(codec.hash(token))
                .tokenCiphertext(codec.encrypt(token))
                .keyVersion(properties.getKeyVersion())
                .status(TicketPassStatus.ACTIVE)
                .build();
        booking.setTicketPass(passRepository.save(pass));
    }

    @Transactional(readOnly = true)
    public TicketPassResponse getOwnedPass(String bookingId, String accountId) {
        BookingTicketPass pass = passRepository.findByBooking_BookingId(bookingId)
                .orElseThrow(() -> new AppException(TICKET_PASS_NOT_FOUND));
        Booking booking = pass.getBooking();
        if (!booking.getAccountId().equals(accountId)) {
            throw new AppException(BOOKING_FORBIDDEN);
        }
        if (booking.getStatus() != BookingStatus.CONFIRMED
                || pass.getStatus() != TicketPassStatus.ACTIVE) {
            throw new AppException(TICKET_PASS_INVALID);
        }
        return passResponse(pass);
    }

    @Transactional
    public TicketCheckInResponse checkIn(
            Long clusterId,
            String staffId,
            String idempotencyKey,
            TicketCheckInRequest request) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new AppException(INVALID_REQUEST);
        }
        String callerScope = "cluster:" + clusterId + ":staff:" + staffId;
        String requestHash = requestHash(clusterId, request);
        TicketCheckIn existing = checkInRepository
                .findByCallerScopeAndIdempotencyKey(callerScope, idempotencyKey)
                .orElse(null);
        if (existing != null) {
            if (!existing.getRequestHash().equals(requestHash)) {
                throw new AppException(IDEMPOTENCY_CONFLICT);
            }
            return checkInResponse(existing, true);
        }

        BookingTicketPass pass = passRepository.findByTokenHash(codec.hash(request.getPassToken()))
                .orElseThrow(() -> new AppException(TICKET_PASS_NOT_FOUND));
        Booking booking = pass.getBooking();
        if (pass.getStatus() != TicketPassStatus.ACTIVE
                || booking.getStatus() != BookingStatus.CONFIRMED
                || !clusterId.equals(booking.getClusterId())) {
            throw new AppException(TICKET_PASS_INVALID);
        }

        List<Ticket> tickets = sortedTickets(booking);
        if (tickets.isEmpty()) {
            throw new AppException(TICKET_PASS_INVALID);
        }
        if (tickets.stream().anyMatch(ticket -> ticket.getStatus() == TicketStatus.USED)) {
            throw new AppException(TICKET_ALREADY_USED);
        }
        if (tickets.stream().anyMatch(ticket -> ticket.getStatus() != TicketStatus.VALID)) {
            throw new AppException(TICKET_PASS_INVALID);
        }

        OffsetDateTime checkedInAt = OffsetDateTime.now();
        tickets.forEach(ticket -> {
            ticket.setStatus(TicketStatus.USED);
            ticket.setUsedAt(checkedInAt);
        });

        TicketCheckIn checkIn = checkInRepository.save(TicketCheckIn.builder()
                .ticket(tickets.getFirst())
                .callerScope(callerScope)
                .idempotencyKey(idempotencyKey)
                .requestHash(requestHash)
                .checkInMode(normalizeMode(request.getCheckInMode()))
                .gateCode(request.getGateCode().trim())
                .checkedBy(staffId)
                .deviceId(blankToNull(request.getDeviceId()))
                .result("ACCEPTED")
                .scannedAt(checkedInAt)
                .build());
        bookingEventService.append(booking, "TICKET_CHECKED_IN", idempotencyKey);
        return checkInResponse(checkIn, false);
    }

    @Transactional
    public void revoke(Booking booking, String reason) {
        passRepository.findByBooking_BookingId(booking.getBookingId()).ifPresent(pass -> {
            if (pass.getStatus() == TicketPassStatus.ACTIVE) {
                pass.setStatus(TicketPassStatus.REVOKED);
                pass.setRevokedAt(OffsetDateTime.now());
                pass.setRevokedReason(reason);
            }
        });
        booking.getTickets().stream()
                .filter(ticket -> ticket.getStatus() == TicketStatus.VALID)
                .forEach(ticket -> ticket.setStatus(TicketStatus.CANCELLED));
    }

    private TicketPassResponse passResponse(BookingTicketPass pass) {
        Booking booking = pass.getBooking();
        return TicketPassResponse.builder()
                .bookingId(booking.getBookingId())
                .bookingCode(booking.getBookingCode())
                .passToken(codec.decrypt(pass.getTokenCiphertext()))
                .status(pass.getStatus().name())
                .clusterId(booking.getClusterId())
                .clusterName(booking.getClusterName())
                .showtimeId(booking.getShowtimeId())
                .issuedAt(pass.getIssuedAt())
                .seatCodes(sortedTickets(booking).stream().map(Ticket::getSeatCode).toList())
                .build();
    }

    private TicketCheckInResponse checkInResponse(TicketCheckIn checkIn, boolean replayed) {
        Booking booking = checkIn.getTicket().getBooking();
        return TicketCheckInResponse.builder()
                .bookingId(booking.getBookingId())
                .bookingCode(booking.getBookingCode())
                .clusterId(booking.getClusterId())
                .result(checkIn.getResult())
                .gateCode(checkIn.getGateCode())
                .checkedInAt(checkIn.getScannedAt())
                .replayed(replayed)
                .seatCodes(sortedTickets(booking).stream().map(Ticket::getSeatCode).toList())
                .build();
    }

    private List<Ticket> sortedTickets(Booking booking) {
        return booking.getTickets().stream()
                .sorted(Comparator.comparing(Ticket::getSeatCode))
                .toList();
    }

    private String requestHash(Long clusterId, TicketCheckInRequest request) {
        String canonical = clusterId + "|"
                + request.getPassToken().trim() + "|"
                + request.getGateCode().trim() + "|"
                + normalizeMode(request.getCheckInMode()) + "|"
                + (request.getDeviceId() == null ? "" : request.getDeviceId().trim());
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    MessageDigest.getInstance("SHA-256")
                            .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash check-in request.", exception);
        }
    }

    private String normalizeMode(String mode) {
        return mode == null || mode.isBlank() ? "SCAN" : mode.trim().toUpperCase();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
