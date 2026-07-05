package authservice.repository;

import authservice.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RoleRepository extends JpaRepository<Role, String> {
    // PK là role_name (String) → dùng findById("USER"), findById("ADMIN") trực tiếp
}
