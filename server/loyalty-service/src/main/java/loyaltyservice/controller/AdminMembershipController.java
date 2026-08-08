package loyaltyservice.controller;

import jakarta.validation.Valid;
import loyaltyservice.dto.AdminMembershipResponse;
import loyaltyservice.dto.AdjustPointsRequest;
import loyaltyservice.dto.LoyaltyLedgerResponse;
import loyaltyservice.service.LoyaltyService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/membership")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
public class AdminMembershipController {
    private final LoyaltyService loyaltyService;

    @GetMapping
    public ResponseEntity<Page<AdminMembershipResponse>> members(Pageable pageable) {
        return ResponseEntity.ok(loyaltyService.members(pageable));
    }

    @GetMapping("/{accountId}/ledger")
    public ResponseEntity<Page<LoyaltyLedgerResponse>> ledger(@PathVariable String accountId, Pageable pageable) {
        return ResponseEntity.ok(loyaltyService.adminLedger(accountId, pageable));
    }

    @PostMapping("/{accountId}/adjust")
    public ResponseEntity<LoyaltyLedgerResponse> adjust(@PathVariable String accountId,
                                                         @Valid @RequestBody AdjustPointsRequest request) {
        return ResponseEntity.ok(loyaltyService.adjust(accountId, request));
    }

    @PostMapping("/{accountId}/settle-booking/{bookingId}")
    public ResponseEntity<Void> settleBooking(@PathVariable String accountId, @PathVariable String bookingId) {
        loyaltyService.settleBooking(accountId, bookingId);
        return ResponseEntity.noContent().build();
    }
}
