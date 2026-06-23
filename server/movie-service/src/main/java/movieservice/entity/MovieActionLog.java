package movieservice.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name ="movie_action_log")
@FieldDefaults(level = AccessLevel.PRIVATE)
public class MovieActionLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    String id;
    String accountId;         
    String actor;           
    String note;
    String actionDescription;
    LocalDateTime timestamp;
}
