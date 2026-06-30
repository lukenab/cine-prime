package userservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import userservice.entity.Employee;

import java.util.Optional;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, String> {

    boolean existsByUser_AccountId(String accountId);

    boolean existsByEmployeeCode(String employeeCode);

    Optional<Employee> findByUser_AccountId(String accountId);
}
