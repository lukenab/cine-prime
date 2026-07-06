package userservice.service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.transaction.Transactional;

import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
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
import userservice.exception.ErrorCode;
import userservice.mapper.UserMapper;
import userservice.repository.UserRepository;
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

    /**
     * Tạo skeleton profile khi nhận UserRegisteredEvent từ auth-service.
     * Pattern: auth-service chỉ gửi {accountId, email} — profile fields
     * được thu thập riêng qua PUT /api/users/{id} sau lần đăng nhập đầu tiên.
     */
    @Transactional
    public void createUserProfile(UserRegisteredEvent event) {
        if (userRepository.existsById(event.getAccountId())) {
            log.warn("[KAFKA] Skeleton profile for accountId {} already exists. Skipping.", event.getAccountId());
            return;
        }

        User user = User.builder()
                .accountId(event.getAccountId())
                .email(event.getEmail())
                .isActive(true)
                .profileCompleted(false)   // skeleton — chưa điền form
                .build();

        User saved = userRepository.save(user);
        auditLogService.log("User", saved.getAccountId(), "CREATE", null, saved, "SYSTEM");
        log.info("[KAFKA] Skeleton profile created for accountId: {}", saved.getAccountId());
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
        /*
         * UPSERT pattern — tạo skeleton nếu chưa tồn tại.
         * Xảy ra khi: (1) Kafka event chưa kịp consume, (2) ddl-auto:create xóa data khi
         * dev restart, (3) bất kỳ lý do nào khiến skeleton profile bị thiếu.
         * Đây là intentional fallback của Progressive Profiling — REST endpoint luôn là
         * last-resort để đảm bảo user không bị block.
         */
        User user = userRepository.findById(id).orElseGet(() -> {
            log.warn("[UPSERT] User {} not found — creating skeleton before update (Kafka lag / dev reset)", id);
            return userRepository.save(User.builder()
                    .accountId(id)
                    .isActive(true)
                    .profileCompleted(false)
                    .build());
        });
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

    @Transactional
    public void softDeleteUser(String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!user.getIsActive()) {
            throw new AppException(ErrorCode.USER_ALREADY_INACTIVE);
        }

        user.setIsActive(false);
        user.setUpdatedAt(LocalDateTime.now());

        // Ghi Log
        User savedUser = userRepository.save(user);
        auditLogService.log("User", savedUser.getAccountId(), "DELETE", null, savedUser, getCurrentAccountId());

    }

    /**
     * Single source of truth for "profile hoàn tất".
     * Tất cả 5 required fields phải có giá trị hợp lệ.
     */
    private boolean isProfileComplete(User user) {
        return user.getFullName() != null && !user.getFullName().isBlank()
                && user.getPhoneNumber() != null && !user.getPhoneNumber().isBlank()
                && user.getIdentityCard() != null && !user.getIdentityCard().isBlank()
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

    public PageResponse<UserResponse> getAllUser(int page, int size) {
        Pageable pageable = PageRequest.of(page - 1, size);

        Page<User> pageData = userRepository.findAll(pageable);

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
