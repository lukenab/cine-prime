package userservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import userservice.entity.User;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    boolean existsByPhoneNumber(String phoneNumber);

    boolean existsByIdentityCard(String identityCard);

    boolean existsByEmail(String email);
}
