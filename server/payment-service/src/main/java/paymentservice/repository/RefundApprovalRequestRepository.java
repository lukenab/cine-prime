package paymentservice.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import paymentservice.entity.RefundApprovalRequest;
import paymentservice.entity.RefundApprovalStatus;

import java.util.Optional;

public interface RefundApprovalRequestRepository extends JpaRepository<RefundApprovalRequest, String> {
    Optional<RefundApprovalRequest> findFirstByRefund_RefundIdOrderByCreatedAtDesc(String refundId);
    Page<RefundApprovalRequest> findAllByStatusOrderByCreatedAtDesc(RefundApprovalStatus status, Pageable pageable);
    Page<RefundApprovalRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
