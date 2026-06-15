package userservice.service;

import java.time.LocalDateTime;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import org.springframework.stereotype.Service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import userservice.dto.UserCreationRequest;
import userservice.dto.UserResponse;
import userservice.dto.UserUpdateRequest;
import userservice.entity.User;
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

    @Transactional
    public UserResponse create(UserCreationRequest creationRequest) {

        if (userRepository.existsByPhoneNumber(creationRequest.getPhoneNumber())) {
            throw new AppException(ErrorCode.PHONE_EXISTED);
        }

        if (userRepository.existsByIdentityCard(creationRequest.getIdentityCard())) {
            throw new AppException(ErrorCode.IDENTITY_CARD_EXISTED);
        }

        if (userRepository.existsByEmail(creationRequest.getEmail())){
            throw new AppException(ErrorCode.EMAIL_EXISTED);
        }

        User user = userMapper.toUser(creationRequest);
        user.setCreatedAt(LocalDateTime.now());
        user.setIsActive(true);
        return userMapper.toUserResponse(userRepository.save(user));
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

        userMapper.updateUser(request, user);
        user.setUpdatedAt(LocalDateTime.now());
        return userMapper.toUserResponse(userRepository.save(user));
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

    }
}
