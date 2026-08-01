package userservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;
import userservice.dto.EmployeeCreateRequest;
import userservice.dto.EmployeeResponse;
import userservice.dto.EmployeeUpdateRequest;
import userservice.dto.PageResponse;
import userservice.service.EmployeeService;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@RequestMapping("/api/employees")
public class EmployeeController {

    EmployeeService employeeService;

    @PostMapping
    @PreAuthorize("@employeeAccessPolicy.canCreate(#request, authentication)")
    public ApiResponse<EmployeeResponse> createEmployee(@Valid @RequestBody EmployeeCreateRequest request) {
        return ApiResponse.<EmployeeResponse>builder()
                .result(employeeService.createEmployee(request))
                .build();
    }

    @GetMapping("/{id}")
    @PreAuthorize("@employeeAccessPolicy.canAccess(#id, authentication)")
    public ApiResponse<EmployeeResponse> getEmployeeById(@PathVariable String id) {
        return ApiResponse.<EmployeeResponse>builder()
                .result(employeeService.getEmployeeById(id))
                .build();
    }

    @GetMapping
    public ApiResponse<PageResponse<EmployeeResponse>> getAllEmployees(
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "10") int size
    ) {
        return ApiResponse.<PageResponse<EmployeeResponse>>builder()
                .result(employeeService.getAllEmployees(page, size))
                .build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("@employeeAccessPolicy.canUpdate(#id, #request, authentication)")
    public ApiResponse<EmployeeResponse> updateEmployee(
            @PathVariable String id,
            @Valid @RequestBody EmployeeUpdateRequest request
    ) {
        return ApiResponse.<EmployeeResponse>builder()
                .result(employeeService.updateEmployee(id, request))
                .build();
    }

    /**
     * Soft delete — sets employee status to DISABLED (per SRS spec)
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("@employeeAccessPolicy.canAccess(#id, authentication)")
    public ApiResponse<Void> disableEmployee(@PathVariable String id) {
        employeeService.disableEmployee(id);
        return ApiResponse.<Void>builder()
                .message("Employee has been disabled")
                .build();
    }
}
