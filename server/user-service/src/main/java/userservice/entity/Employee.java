package userservice.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import userservice.enums.EmployeeDepartment;
import userservice.enums.EmployeePosition;
import userservice.enums.EmployeeStatus;
import userservice.enums.EmploymentType;

@Entity
@Table(
        name = "employee",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_employee_account_id", columnNames = "account_id"),
                @UniqueConstraint(name = "uk_employee_code", columnNames = "employee_code")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee {

    @Id
    @Column(name = "employee_id", length = 36)
    private String employeeId;

    @Column(name = "employee_code", length = 20, unique = true)
    private String employeeCode;

    @OneToOne
    @JoinColumn(name = "account_id", referencedColumnName = "account_id", nullable = false, unique = true)
    private User user;

    @Column(name = "cinema_id", length = 36)
    private String cinemaId;

    @Enumerated(EnumType.STRING)
    @Column(name = "position", length = 50)
    private EmployeePosition position;

    @Enumerated(EnumType.STRING)
    @Column(name = "department", length = 30)
    private EmployeeDepartment department;

    @Enumerated(EnumType.STRING)
    @Column(name = "employment_type", length = 30)
    private EmploymentType employmentType;

    @Column(name = "hire_date")
    private LocalDate hireDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    private EmployeeStatus status;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
