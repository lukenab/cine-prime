package userservice.dto;

import lombok.Data;

import java.util.Set;

@Data
public class AuthAccountSummary {
    private String accountId;
    private String email;
    private String status;
    private Set<String> roles;
}
