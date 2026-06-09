package userservice.service;

import java.time.LocalDateTime;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import userservice.dto.UserCreationRequest;
import userservice.entity.User;
import userservice.repository.UserRepository;

@Service
public class UserService {
    private UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public ResponseEntity<String> create(UserCreationRequest creationRequest) {
        try {
            User user = new User();
            user.setAccountId(creationRequest.getAccountId());
            user.setAddress(creationRequest.getAddress());
            user.setAvatarUrl(null);
            user.setCreatedAt(LocalDateTime.now());
            user.setFullName(creationRequest.getFullName());
            user.setGender(creationRequest.getGender());
            user.setDateOfBirth(creationRequest.getDateOfBirth());
            if (userRepository.existsByPhoneNumber(creationRequest.getPhoneNumber())) {
                return ResponseEntity.ok("Phone number already exists");
            }

            if (userRepository.existsByIdentityCard(creationRequest.getIdentityCard())) {
                return ResponseEntity.ok("Identity card already exists");
            }

            user.setPhoneNumber(creationRequest.getPhoneNumber());
            user.setIdentityCard(creationRequest.getIdentityCard());
            userRepository.save(user);
            return ResponseEntity.ok("User account created successfully!!!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
