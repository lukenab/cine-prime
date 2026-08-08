package loyaltyservice.controller;

import loyaltyservice.dto.LoyaltyLedgerResponse;
import loyaltyservice.dto.MembershipSummaryResponse;
import loyaltyservice.service.LoyaltyService;
import lombok.RequiredArgsConstructor;
import movie.theater.common.security.JwtSecurityUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/membership")
@RequiredArgsConstructor
public class MembershipController {
    private final LoyaltyService loyaltyService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MembershipSummaryResponse> me() {
        return ResponseEntity.ok(loyaltyService.summary(currentAccountId()));
    }

    @GetMapping("/me/ledger")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<LoyaltyLedgerResponse>> ledger(Pageable pageable) {
        return ResponseEntity.ok(loyaltyService.ledger(currentAccountId(), pageable));
    }

    private String currentAccountId() {
        String accountId = JwtSecurityUtils.getCurrentAccountId();
        if (accountId == null || accountId.isBlank()) {
            throw new IllegalStateException("Authenticated token does not contain accountId");
        }
        return accountId;
    }
}
