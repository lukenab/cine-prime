package userservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import userservice.dto.UserCreationRequest;
import userservice.service.UserService;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private UserService userService;
    public UserController(UserService userService) {
        this.userService = userService;
    }
    @PostMapping("/profile")
    public ResponseEntity<String> createProfile(@Valid @RequestBody UserCreationRequest request) {
        
        System.out.println("Data fetching form Auth Service: " + request.getFullName());

        return userService.create(request);
    }
}
