package bookingservice.service;

import bookingservice.dto.response.ReconciliationCaseResponse;
import bookingservice.entity.Booking;
import bookingservice.entity.BookingReconciliation;
import bookingservice.repository.BookingReconciliationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BookingReconciliationService {
    private final BookingReconciliationRepository reconciliationRepository;

    @Transactional(readOnly = true)
    public Page<ReconciliationCaseResponse> getClusterCases(Long clusterId, Pageable pageable) {
        return reconciliationRepository
                .findByClusterIdOrderByCreatedAtDesc(clusterId, pageable)
                .map(this::toResponse);
    }

    private ReconciliationCaseResponse toResponse(BookingReconciliation reconciliation) {
        Booking booking = reconciliation.getBooking();
        return ReconciliationCaseResponse.builder()
                .reconciliationId(reconciliation.getReconciliationId())
                .bookingId(booking == null ? null : booking.getBookingId())
                .bookingCode(booking == null ? null : booking.getBookingCode())
                .caseType(reconciliation.getCaseType())
                .severity(reconciliation.getSeverity())
                .status(reconciliation.getStatus().name())
                .paymentReference(reconciliation.getPaymentReference())
                .holdReference(reconciliation.getHoldReference())
                .clusterId(reconciliation.getClusterId())
                .evidence(reconciliation.getEvidence())
                .ownerId(reconciliation.getOwnerId())
                .createdAt(reconciliation.getCreatedAt())
                .updatedAt(reconciliation.getUpdatedAt())
                .build();
    }
}
