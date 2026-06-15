package userservice.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import userservice.dto.UserCreationRequest;
import userservice.dto.UserResponse;
import userservice.dto.UserUpdateRequest;
import userservice.entity.User;
import userservice.mapper.UserMapper;
import userservice.repository.UserRepository;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class UserService {
    UserRepository userRepository;
    UserMapper userMapper;

    public UserResponse create(UserCreationRequest creationRequest) {

        if (userRepository.existsByPhoneNumber(creationRequest.getPhoneNumber())) {
            throw new RuntimeException("Phone number already exists");
        }

        if (userRepository.existsByIdentityCard(creationRequest.getIdentityCard())) {
            throw new RuntimeException("Idenity card already exists");
        }

        User user = userMapper.toUser(creationRequest);
        user.setCreatedAt(LocalDateTime.now());
        return userMapper.toUserResponse(userRepository.save(user));
    }

    public UserResponse getUserById(String id){
        User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
        return userMapper.toUserResponse(user);
    }

    public UserResponse updateUser(String id, UserUpdateRequest request){
        User user = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found with ID:" + id));
        if(request.getPhoneNumber() != null
           && !request.getPhoneNumber().equals(user.getPhoneNumber())
           && userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
            throw  new RuntimeException("Phone number already exists");
        }

        userMapper.updateUser(request, user);
        return userMapper.toUserResponse(userRepository.save(user));
    }

}
