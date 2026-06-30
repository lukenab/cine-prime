package bookingservice.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import movie.theater.common.dto.ApiResponse;
@FeignClient(name = "user-service", path = "/api/users")
public interface MemberClient {
 
    @GetMapping("/{accountId}")
    ApiResponse<Integer> getMemberPoints(@PathVariable("accountId") String accountId);

 
    default Integer getCurrentPoints(String accountId) {
        ApiResponse<Integer> response = getMemberPoints(accountId);
        if (response != null && response.getCode() == 1000) { // 1000 là code SUCCESS của bạn
            return response.getResult();
        }
        return 0; // Trả về 0 hoặc throw Exception tùy thiết kế hệ thống
    }
}
