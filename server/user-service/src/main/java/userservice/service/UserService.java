package userservice.service;

import java.time.LocalDateTime;
import java.util.List;

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

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.client.RestClient;
import userservice.dto.PageResponse;
import userservice.dto.UserResponse;
import userservice.dto.UserUpdateRequest;
import userservice.entity.User;
import userservice.event.UserRegisteredEvent;
import userservice.exception.ErrorCode;
import userservice.mapper.UserMapper;
import userservice.repository.UserRepository;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class UserService {
    UserRepository userRepository;
    UserMapper userMapper;
    AuditLogService auditLogService;
    private final RestClient.Builder builder;

    @Transactional
    public void createUserProfile(UserRegisteredEvent event) {

        if (userRepository.findById(event.getAccountId()).isPresent()) {
            log.warn("Profile for Account ID {} already exists. Skipping event to avoid duplication.", event.getAccountId());
            return;
        }

        if (userRepository.existsByPhoneNumber(event.getPhoneNumber())) {
            log.error("Phone number {} already exists. Skipping event.", event.getPhoneNumber());
            return;
        }

        if (userRepository.existsByIdentityCard(event.getIdentityCard())) {
            log.error("Identity card {} already exists. Skipping event.", event.getIdentityCard());
            return;
        }

        if (userRepository.existsByEmail(event.getEmail())){
            log.error("Email {} already exists. Skipping event.", event.getEmail());
            return;
        }

        User user = userMapper.toUser(event);
        user.setAccountId(event.getAccountId()); // Ensure ID is synchronized with auth-service
        user.setCreatedAt(LocalDateTime.now());
        user.setIsActive(true);

        // Ghi Log
        User savedUser = userRepository.save(user);
        auditLogService.log("User", savedUser.getAccountId(), "CREATE", null, savedUser, getCurrentAccountId());

        log.info("Successfully created Profile for Account ID: {}", savedUser.getAccountId());
    }

    @Transactional
    public UserResponse getUserById(String id){
        User user = userRepository.findById(id).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if(!user.getIsActive()) {
            throw new AppException(ErrorCode.USER_NOT_FOUND);
        }

        return userMapper.toUserResponse(user);
    }

    @Transactional
    public UserResponse updateUser(String id, UserUpdateRequest request){
        User user = userRepository.findById(id).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        if(request.getPhoneNumber() != null
                && !request.getPhoneNumber().equals(user.getPhoneNumber())
                && userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
            throw  new AppException(ErrorCode.PHONE_EXISTED);
        }

        UserResponse oldData = userMapper.toUserResponse(user);

        userMapper.updateUser(request, user);
        user.setUpdatedAt(LocalDateTime.now());

        // Ghi Log
        User savedUser = userRepository.save(user);
        auditLogService.log("User", savedUser.getAccountId(), "UPDATE", oldData, savedUser, getCurrentAccountId());

        return userMapper.toUserResponse(savedUser);
    }

    @Transactional
    public void softDeleteUser(String id){
        User user = userRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if(!user.getIsActive()) {
            throw new AppException(ErrorCode.USER_ALREADY_INACTIVE);
        }

        user.setIsActive(false);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        // Ghi Log
        User savedUser = userRepository.save(user);
        auditLogService.log("User", savedUser.getAccountId(), "DELETE", null, savedUser, getCurrentAccountId());

    }

    private String getCurrentAccountId(){
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        // Check đã login và đã có token là JWT hay chưa
        if(authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            return jwt.getClaimAsString("accountId");
        }

        return "SYSTEM";
    }

    public PageResponse<UserResponse> getAllUser(int page, int size){
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
}
