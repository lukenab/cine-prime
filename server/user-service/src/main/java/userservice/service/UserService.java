package userservice.service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;


import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import userservice.dto.UserCreationRequest;
import userservice.dto.UserResponse;
import userservice.entity.User;
import userservice.exception.ErrorCode;
import userservice.mapper.UserMapper;
import userservice.repository.UserRepository;
import movie.theater.common.exception.AppException;
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserService {
    UserRepository userRepository;
    UserMapper userMapper;

    public UserResponse create(UserCreationRequest creationRequest) {

        if (userRepository.existsByPhoneNumber(creationRequest.getPhoneNumber())) {
            throw new AppException(ErrorCode.PHONE_EXISTED);
        }

        if (userRepository.existsByIdentityCard(creationRequest.getIdentityCard())) {
            throw new AppException(ErrorCode.IDENTITY_CARD_EXISTED);
        }

        User user = userMapper.toUser(creationRequest);
        UserResponse savedUser = userMapper.toUserResponse(userRepository.save(user));
        return savedUser;
    }

  
}
