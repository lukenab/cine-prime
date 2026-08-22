package userservice.security;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import userservice.dto.EmployeeCreateRequest;
import userservice.dto.EmployeeUpdateRequest;
import userservice.entity.Employee;
import userservice.repository.EmployeeRepository;

@Component("employeeAccessPolicy")
@RequiredArgsConstructor
public class EmployeeAccessPolicy {

    private final EmployeeRepository employeeRepository;

    public boolean canCreate(EmployeeCreateRequest request, Authentication authentication) {
        if (isAdministrator(authentication)) return true;
        String managerCinema = callerCinema(authentication);
        return managerCinema != null && managerCinema.equals(request.getCinemaId());
    }

    public boolean canAccess(String employeeId, Authentication authentication) {
        if (isAdministrator(authentication)) return true;
        String managerCinema = callerCinema(authentication);
        return managerCinema != null && employeeRepository.findById(employeeId)
                .map(Employee::getCinemaId)
                .filter(managerCinema::equals)
                .isPresent();
    }

    public boolean canUpdate(String employeeId, EmployeeUpdateRequest request, Authentication authentication) {
        if (isAdministrator(authentication)) return true;
        String managerCinema = callerCinema(authentication);
        if (managerCinema == null || !canAccess(employeeId, authentication)) return false;
        return request.getCinemaId() == null || managerCinema.equals(request.getCinemaId());
    }

    private boolean isAdministrator(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN")
                        || authority.getAuthority().equals("ROLE_SUPER_ADMIN")
                        || authority.getAuthority().equals("ROLE_SYSTEM_ADMIN")
                        || authority.getAuthority().equals("EMPLOYEE_UPDATE"));
    }

    private String callerCinema(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) return null;
        String accountId = jwt.getClaimAsString("accountId");
        if (accountId == null) return null;
        return employeeRepository.findByUser_AccountId(accountId).map(Employee::getCinemaId).orElse(null);
    }
}
