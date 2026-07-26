package bookingservice.dto.response;

import java.time.OffsetDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
@Data
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CancelBookingResponse {
    String bookingId;
    String status;
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    OffsetDateTime updatedAt;
}
