package userservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import userservice.dto.UserCreationRequest;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @PostMapping("/profile")
    public ResponseEntity<String> createProfile(@RequestBody UserCreationRequest request) {
        System.out.println("Data fetching form Auth Service: " + request.getFullName());

        return ResponseEntity.ok("Profile created (Mocked)");
    }
}
