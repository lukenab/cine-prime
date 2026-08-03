package concessionservice.controller;

import concessionservice.dto.ConcessionModels.OrderResponse;
import concessionservice.service.ConcessionService;
import concessionservice.service.ClusterAccessPolicy;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/employee/concession-orders")
@RequiredArgsConstructor
public class EmployeeOrderController {
    private final ConcessionService service;
    private final ClusterAccessPolicy clusterAccessPolicy;

    @GetMapping
    public ApiResponse<List<OrderResponse>> queue(
            @RequestParam Long clusterId,
            @RequestParam(required = false) String status) {
        clusterAccessPolicy.requireAccess(clusterId);
        return ApiResponse.<List<OrderResponse>>builder()
                .result(service.orders(clusterId, status))
                .build();
    }

    @PostMapping("/{id}/{action:prepare|ready|collect}")
    public ApiResponse<OrderResponse> transition(
            @PathVariable String id,
            @PathVariable String action) {
        OrderResponse current = service.order(id);
        clusterAccessPolicy.requireAccess(current.cinemaClusterId());
        return ApiResponse.<OrderResponse>builder()
                .result(service.transitionOrder(id, action, current.cinemaClusterId()))
                .build();
    }
}
