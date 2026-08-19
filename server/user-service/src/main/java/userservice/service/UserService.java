package userservice.service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.transaction.Transactional;

import lombok.extern.slf4j.Slf4j;
import lombok.experimental.NonFinal;
import movie.theater.common.exception.AppException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.multipart.MultipartFile;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import userservice.dto.PageResponse;
import userservice.dto.UserResponse;
import userservice.dto.UserUpdateRequest;
import userservice.entity.User;
import userservice.event.UserRegisteredEvent;
import userservice.event.UserUpdatedEvent;
import userservice.event.AccountStatusChangedEvent;
import userservice.enums.EmployeeStatus;
import userservice.exception.ErrorCode;
import userservice.mapper.UserMapper;
import userservice.repository.UserRepository;
import userservice.client.AuthAccountClient;
import userservice.dto.AuthAccountStatusRequest;
import userservice.dto.StaffProfileCompletionRequest;
import userservice.service.ImageStorageService;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class UserService {
    UserRepository userRepository;
    UserMapper userMapper;
    AuditLogService auditLogService;
    IdentityCardService identityCardService;
    ImageStorageService imageStorageService;
    AuthAccountClient authAccountClient;

    @NonFinal
    @Value("${app.internal-service-key}")
    String internalServiceKey;

    /**
     * Tạo skeleton profile khi nhận UserRegisteredEvent từ auth-service.
     * Pattern: auth-service chỉ gửi {accountId, email} — profile fields
     * được thu thập riêng qua PUT /api/users/{id} sau lần đăng nhập đầu tiên.
     */
    @Transactional
    public void createUserProfile(UserRegisteredEvent event) {
        User user = userRepository.findById(event.getAccountId()).orElseGet(() -> User.builder()
                .accountId(event.getAccountId()).isActive(true).profileCompleted(false).build());

        if (event.getPhoneNumber() != null && !event.getPhoneNumber().equals(user.getPhoneNumber())
                && userRepository.existsByPhoneNumber(event.getPhoneNumber())) {
            throw new AppException(ErrorCode.PHONE_EXISTED);
        }
        if (event.getIdentityCard() != null) {
            identityCardService.validate(event.getIdentityCard());
            if (!event.getIdentityCard().equals(user.getIdentityCard())
                    && userRepository.existsByIdentityCard(event.getIdentityCard())) {
                throw new AppException(ErrorCode.IDENTITY_CARD_EXISTED);
            }
        }

        // Merge makes the event idempotent and also handles the case where employee-service
        // created a verified skeleton before Kafka delivered this richer profile event.
        user.setEmail(event.getEmail());
        if (event.getFullName() != null) user.setFullName(event.getFullName());
        if (event.getPhoneNumber() != null) user.setPhoneNumber(event.getPhoneNumber());
        if (event.getDateOfBirth() != null) user.setDateOfBirth(event.getDateOfBirth());
        if (event.getGender() != null) user.setGender(event.getGender());
        if (event.getIdentityCard() != null) user.setIdentityCard(event.getIdentityCard());
        if (event.getAddress() != null) user.setAddress(event.getAddress());
        user.setProfileCompleted(isProfileComplete(user));

        User saved = userRepository.save(user);
        auditLogService.log("User", saved.getAccountId(), "CREATE", null, saved, "SYSTEM");
        log.info("[KAFKA] Skeleton profile created for accountId: {}", saved.getAccountId());
    }

    @Transactional
    public void synchronizeAccountStatus(AccountStatusChangedEvent event) {
        userRepository.findById(event.getAccountId()).ifPresent(user -> {
            boolean active = "ACTIVE".equals(event.getStatus()) || "PENDING".equals(event.getStatus());
            user.setIsActive(active);
            if (!active && user.getEmployee() != null) {
                user.getEmployee().setStatus(EmployeeStatus.DISABLED);
            }
            userRepository.save(user);
            auditLogService.log("User", user.getAccountId(), "ACCOUNT_STATUS_SYNC", null, user, "SYSTEM");
        });
    }

    @Transactional
    public UserResponse getUserById(String id) {
        User user = userRepository.findById(id).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!user.getIsActive()) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        return userMapper.toUserResponse(user);
    }

    @Transactional
    public UserResponse updateUser(String id, UserUpdateRequest request) {
        // Profiles are provisioned only from a trusted auth-service event. Creating one
        // from a caller-controlled path id would let an authenticated user forge records.
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if (request.getIdentityCard() != null) {
            identityCardService.validate(request.getIdentityCard());
            if (!request.getIdentityCard().equals(user.getIdentityCard())
                    && userRepository.existsByIdentityCard(request.getIdentityCard())) {
                throw new AppException(ErrorCode.IDENTITY_CARD_EXISTED);
            }
        }
        if (request.getPhoneNumber() != null
                && !request.getPhoneNumber().equals(user.getPhoneNumber())
                && userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
            throw new AppException(ErrorCode.PHONE_EXISTED);
        }

        UserResponse oldData = userMapper.toUserResponse(user);

        userMapper.updateUser(request, user);
        user.setUpdatedAt(LocalDateTime.now());

        // Tự động set profileCompleted khi đủ tất cả required fields
        if (!Boolean.TRUE.equals(user.getProfileCompleted())) {
            user.setProfileCompleted(isProfileComplete(user));
        }

        // Ghi Log
        User savedUser = userRepository.save(user);
        auditLogService.log("User", savedUser.getAccountId(), "UPDATE", oldData, savedUser, getCurrentAccountId());

        return userMapper.toUserResponse(savedUser);
    }

    /**
     * Completes the minimum staff profile after account activation. Employment,
     * branch and access data remain administrator-owned on the Employee record;
     * staff never have to provide customer KYC fields such as identity card.
     */
    @Transactional
    public UserResponse completeStaffProfile(String id, StaffProfileCompletionRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (user.getEmployee() == null) {
            throw new AppException(ErrorCode.INVALID_EMPLOYEE_ACCOUNT);
        }

        String phoneNumber = request.getPhoneNumber().trim();
        if (!phoneNumber.equals(user.getPhoneNumber())
                && userRepository.existsByPhoneNumber(phoneNumber)) {
            throw new AppException(ErrorCode.PHONE_EXISTED);
        }

        UserResponse oldData = userMapper.toUserResponse(user);
        user.setFullName(request.getFullName().trim());
        user.setPhoneNumber(phoneNumber);
        user.setProfileCompleted(true);
        user.setUpdatedAt(LocalDateTime.now());

        User saved = userRepository.save(user);
        auditLogService.log("User", saved.getAccountId(), "COMPLETE_STAFF_PROFILE",
                oldData, saved, getCurrentAccountId());
        return userMapper.toUserResponse(saved);
    }

    @Transactional
    public void softDeleteUser(String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!user.getIsActive()) {
            throw new AppException(ErrorCode.USER_ALREADY_INACTIVE);
        }

        // Login eligibility belongs to auth-service. Revoke sessions before hiding the
        // profile so no API caller can create a "disabled profile / active login" split.
        authAccountClient.updateStatus(id, internalServiceKey, new AuthAccountStatusRequest("INACTIVE"));
        user.setIsActive(false);
        user.setUpdatedAt(LocalDateTime.now());

        // Ghi Log
        User savedUser = userRepository.save(user);
        auditLogService.log("User", savedUser.getAccountId(), "DELETE", null, savedUser, getCurrentAccountId());

    }

    /**
     * Single source of truth for a completed member booking profile.
     * National identity data is intentionally not required for ordinary
     * online ticket purchases.
     */
    private boolean isProfileComplete(User user) {
        return user.getFullName() != null && !user.getFullName().isBlank()
                && user.getPhoneNumber() != null && !user.getPhoneNumber().isBlank()
                && user.getDateOfBirth() != null
                && user.getGender() != null && !user.getGender().isBlank();
    }

    private String getCurrentAccountId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        // Check đã login và đã có token là JWT hay chưa
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt.getClaimAsString("accountId");
        }

        return "SYSTEM";
    }

    @Transactional
    public void updateUserProfile(UserUpdatedEvent event) {
        log.info("Processing update event for Account ID: {}", event.getAccountId());
        try {
            if (!userRepository.existsById(event.getAccountId())) {
                log.warn("User profile not found for Account ID: {}. Skipping update.", event.getAccountId());
                return;
            }

            UserUpdateRequest request = UserUpdateRequest.builder()
                    .fullName(event.getFullName())
                    .phoneNumber(event.getPhoneNumber())
                    .dateOfBirth(event.getDateOfBirth())
                    .gender(event.getGender())
                    .address(event.getAddress())
                    .identityCard(event.getIdentityCard())
                    .build();

            this.updateUser(event.getAccountId(), request);

            log.info("Successfully updated Profile for Account ID: {}", event.getAccountId());
        } catch (AppException e) {
            log.error("Business logic error during Kafka update for Account ID {}: {}", event.getAccountId(), e.getMessage());
        } catch (Exception e) {
            log.error("Unexpected error updating profile from Kafka event for Account ID: {}", event.getAccountId(), e);
            throw new RuntimeException("Kafka event processing failed, trigger retry", e);
        }
    }

    public PageResponse<UserResponse> getAllUser(int page, int size, String query, Boolean active) {
        if (page < 1 || size < 1 || size > 200) {
            throw new AppException(ErrorCode.INVALID_INPUT);
        }
        Pageable pageable = PageRequest.of(page - 1, size);

        Specification<User> specification = Specification.where(null);
        if (StringUtils.hasText(query)) {
            String pattern = "%" + query.trim().toLowerCase() + "%";
            specification = specification.and((root, ignored, cb) -> cb.or(
                    cb.like(cb.lower(root.get("fullName")), pattern),
                    cb.like(cb.lower(root.get("email")), pattern),
                    cb.like(cb.lower(root.get("phoneNumber")), pattern)
            ));
        }
        if (active != null) {
            specification = specification.and((root, ignored, cb) -> cb.equal(root.get("isActive"), active));
        }

        Page<User> pageData = userRepository.findAll(specification, pageable);

        List<UserResponse> userResponses = pageData.getContent().stream()
                .map(userMapper::toUserResponse)
                .toList();

        return PageResponse.<UserResponse>builder()
                .currentPage(page)
                .totalPages(pageData.getTotalPages())
                .pageSize(pageData.getSize())
                .totalElements(pageData.getTotalElements())
                .data(userResponses)
                .build();


    }

    public Map<String, Boolean> checkUserExistence(String phoneNumber, String identityCard) {
        String processedPhone = phoneNumber != null ? phoneNumber.trim() : "";
        String processedCccd = identityCard != null ? identityCard.trim() : "";

        boolean phoneExists = userRepository.existsByPhoneNumber(processedPhone);
        boolean cccdExists = userRepository.existsByIdentityCard(processedCccd);

        Map<String, Boolean> result = new HashMap<>();
        result.put("phoneExists", phoneExists);
        result.put("identityCardExists", cccdExists);

        return result;
    }

    @Transactional
    public UserResponse uploadAvatar(String id, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException(ErrorCode.INVALID_FILE);
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new AppException(ErrorCode.INVALID_FILE);
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        try {
            Map<String, Object> result = imageStorageService.uploadImage(file);
            String secureUrl = (String) result.get("secure_url");
            user.setAvatarUrl(secureUrl);
            user.setUpdatedAt(java.time.LocalDateTime.now());
            User saved = userRepository.save(user);
            log.info("Avatar uploaded for user {}: {}", id, secureUrl);
            return userMapper.toUserResponse(saved);
        } catch (Exception e) {
            log.error("Failed to upload avatar for user {}", id, e);
            throw new AppException(ErrorCode.UPLOAD_FAILED);
        }
    }


}
