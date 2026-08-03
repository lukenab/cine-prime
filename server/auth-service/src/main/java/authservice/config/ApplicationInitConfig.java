package authservice.config;

import authservice.entity.Account;
import authservice.entity.Permission;
import authservice.entity.Role;
import authservice.enums.AccountStatus;
import authservice.repository.AccountRepository;
import authservice.repository.PermissionRepository;
import authservice.repository.RoleRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Configuration
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ApplicationInitConfig {

    AccountRepository    accountRepository;
    RoleRepository       roleRepository;
    PermissionRepository permissionRepository;
    PasswordEncoder      passwordEncoder;

    @NonFinal @Value("${app.admin.username}") String adminUsername;
    @NonFinal @Value("${app.admin.password}") String adminPassword;
    @NonFinal @Value("${app.admin.email}")    String adminEmail;
    @NonFinal @Value("${app.branch-manager.username}") String branchManagerUsername;
    @NonFinal @Value("${app.branch-manager.password}") String branchManagerPassword;
    @NonFinal @Value("${app.branch-manager.email}")    String branchManagerEmail;
    @NonFinal @Value("${app.seed.sync-account-passwords:false}") boolean syncAccountPasswords;

    // ── Permission definitions ────────────────────────────────────────────────
    // Format: { name, description }
    private static final List<String[]> ALL_PERMISSIONS = List.of(
            // Movie
            new String[]{"MOVIE_READ",   "View movie list and details"},
            new String[]{"MOVIE_CREATE", "Create new movie"},
            new String[]{"MOVIE_UPDATE", "Edit movie information"},
            new String[]{"MOVIE_DELETE", "Delete movie"},

            // Showtime
            new String[]{"SHOWTIME_READ",   "View showtime schedule"},
            new String[]{"SHOWTIME_CREATE", "Create new showtime"},
            new String[]{"SHOWTIME_UPDATE", "Edit showtime"},
            new String[]{"SHOWTIME_DELETE", "Delete showtime"},

            // Booking
            new String[]{"BOOKING_READ",    "View booking list"},
            new String[]{"BOOKING_CONFIRM", "Confirm a booking"},
            new String[]{"BOOKING_CANCEL",  "Cancel a booking"},

            // Ticket
            new String[]{"TICKET_SELL", "Sell tickets at the counter"},

            // Employee
            new String[]{"EMPLOYEE_READ",   "View employee list"},
            new String[]{"EMPLOYEE_CREATE", "Create new employee account"},
            new String[]{"EMPLOYEE_UPDATE", "Edit employee information"},
            new String[]{"EMPLOYEE_DELETE", "Deactivate employee account"},

            // User / Customer
            new String[]{"USER_READ",   "View customer list"},
            new String[]{"USER_CREATE", "Create new customer account"},
            new String[]{"USER_UPDATE", "Edit customer information"},
            new String[]{"USER_DELETE", "Deactivate customer account"},

            // Cinema Room
            new String[]{"ROOM_READ",   "View cinema room list"},
            new String[]{"ROOM_UPDATE", "Edit room seat configuration"},

            // Genre
            new String[]{"GENRE_READ",   "View genre list"},
            new String[]{"GENRE_CREATE", "Create new genre"},
            new String[]{"GENRE_UPDATE", "Edit genre"},
            new String[]{"GENRE_DELETE", "Delete genre"},

            // Promotion
            new String[]{"PROMOTION_READ",   "View promotions"},
            new String[]{"PROMOTION_CREATE", "Create new promotion"},
            new String[]{"PROMOTION_UPDATE", "Edit promotion"},
            new String[]{"PROMOTION_DELETE", "Delete promotion"},

            // Report
            new String[]{"REPORT_READ", "View revenue and statistics reports"},

            // Concession catalog workflow
            new String[]{"CONCESSION_CATALOG_DRAFT", "Create and edit concession product drafts"},
            new String[]{"CONCESSION_CATALOG_SUBMIT", "Submit concession products for approval"},
            new String[]{"CONCESSION_CATALOG_APPROVE", "Approve or reject concession products"}
    );

    // ── Role → Permission mapping ─────────────────────────────────────────────
    private static final Map<String, Set<String>> ROLE_PERMISSIONS = Map.of(
            "MEMBER", Set.of(
                    "MOVIE_READ",
                    "SHOWTIME_READ",
                    "BOOKING_READ", "BOOKING_CANCEL",
                    "PROMOTION_READ"
            ),
            "EMPLOYEE", Set.of(
                    "MOVIE_READ",
                    "SHOWTIME_READ",
                    "BOOKING_READ", "BOOKING_CONFIRM", "BOOKING_CANCEL",
                    "TICKET_SELL"
            ),
            "BRANCH_MANAGER", Set.of(
                    "CONCESSION_CATALOG_DRAFT",
                    "CONCESSION_CATALOG_SUBMIT"
            ),
            "PROGRAMMING_OPERATOR", Set.of(
                    "MOVIE_READ", "MOVIE_CREATE", "MOVIE_UPDATE",
                    "SHOWTIME_READ", "SHOWTIME_CREATE", "SHOWTIME_UPDATE",
                    "ROOM_READ", "GENRE_READ"
            ),
            "ADMIN", Set.of(
                    "MOVIE_READ", "MOVIE_CREATE", "MOVIE_UPDATE", "MOVIE_DELETE",
                    "SHOWTIME_READ", "SHOWTIME_CREATE", "SHOWTIME_UPDATE", "SHOWTIME_DELETE",
                    "BOOKING_READ", "BOOKING_CONFIRM", "BOOKING_CANCEL",
                    "TICKET_SELL",
                    "EMPLOYEE_READ", "EMPLOYEE_CREATE", "EMPLOYEE_UPDATE", "EMPLOYEE_DELETE",
                    "USER_READ", "USER_CREATE", "USER_UPDATE", "USER_DELETE",
                    "ROOM_READ", "ROOM_UPDATE",
                    "GENRE_READ", "GENRE_CREATE", "GENRE_UPDATE", "GENRE_DELETE",
                    "PROMOTION_READ", "PROMOTION_CREATE", "PROMOTION_UPDATE", "PROMOTION_DELETE",
                    "REPORT_READ",
                    "CONCESSION_CATALOG_DRAFT", "CONCESSION_CATALOG_SUBMIT",
                    "CONCESSION_CATALOG_APPROVE"
            )
    );

    @Bean
    ApplicationRunner applicationRunner() {
        return args -> {
            seedPermissions();
            seedRoles();
            seedAdminAccount();
            seedBranchManagerAccount();
        };
    }

    // ── Step 1: Seed permissions ──────────────────────────────────────────────
    private void seedPermissions() {
        for (String[] p : ALL_PERMISSIONS) {
            String name = p[0];
            if (permissionRepository.findById(name).isEmpty()) {
                permissionRepository.save(
                        Permission.builder()
                                .name(name)
                                .description(p[1])
                                .build()
                );
                log.info("[Seed] Permission created: {}", name);
            }
        }
    }

    // ── Step 2: Seed roles with permissions ───────────────────────────────────
    private void seedRoles() {
        Map<String, String> roleDescriptions = Map.of(
                "MEMBER",   "Registered member — can book tickets and manage account",
                "EMPLOYEE", "Cinema staff — ticket sales and booking management",
                "BRANCH_MANAGER", "Cinema branch manager — can prepare concession product proposals",
                "PROGRAMMING_OPERATOR", "Head-office programming staff — prepares movie, release and schedule drafts",
                "ADMIN",    "System administrator — full access to all modules"
        );

        for (Map.Entry<String, Set<String>> entry : ROLE_PERMISSIONS.entrySet()) {
            String roleName = entry.getKey();

            // Fetch assigned permissions from DB (already seeded above)
            Set<Permission> permissions = entry.getValue().stream()
                    .map(permName -> permissionRepository.findById(permName).orElse(null))
                    .filter(p -> p != null)
                    .collect(Collectors.toSet());

            if (roleRepository.findById(roleName).isEmpty()) {
                roleRepository.save(
                        Role.builder()
                                .roleName(roleName)
                                .description(roleDescriptions.getOrDefault(roleName, roleName + " role"))
                                .permissions(permissions)
                                .build()
                );
                log.info("[Seed] Role created: {} with {} permissions", roleName, permissions.size());
            } else {
                // Update permissions if role already exists (idempotent update)
                Role existing = roleRepository.findById(roleName).get();
                existing.setPermissions(permissions);
                roleRepository.save(existing);
                log.debug("[Seed] Role permissions updated: {}", roleName);
            }
        }
    }

    // ── Step 3: Seed admin account ────────────────────────────────────────────
    private void seedAdminAccount() {
        Role adminRole = roleRepository.findById("ADMIN")
                .orElseThrow(() -> new RuntimeException("[Seed] ADMIN role not found — ensure seedRoles() ran first"));
        var existing = accountRepository.findByUsername(adminUsername);
        if (existing.isPresent()) {
            Account admin = existing.get();
            admin.setRoles(Set.of(adminRole));
            admin.setStatus(AccountStatus.ACTIVE);
            if (syncAccountPasswords) {
                admin.setPasswordHash(passwordEncoder.encode(adminPassword));
            }
            accountRepository.save(admin);
            log.debug("[Seed] Admin account role synchronized.");
            return;
        }

        Account admin = Account.builder()
                .username(adminUsername)
                .email(adminEmail)
                .passwordHash(passwordEncoder.encode(adminPassword))
                .roles(Set.of(adminRole))
                .status(AccountStatus.ACTIVE)
                .build();

        accountRepository.save(admin);
        log.warn("[Seed] Admin account created — username: '{}'. Change the default password before going to production!", adminUsername);
    }

    private void seedBranchManagerAccount() {
        Role managerRole = roleRepository.findById("BRANCH_MANAGER")
                .orElseThrow(() -> new RuntimeException(
                        "[Seed] BRANCH_MANAGER role not found — ensure seedRoles() ran first"));
        var existing = accountRepository.findByUsername(branchManagerUsername);
        if (existing.isPresent()) {
            Account branchManager = existing.get();
            branchManager.setRoles(Set.of(managerRole));
            branchManager.setStatus(AccountStatus.ACTIVE);
            if (syncAccountPasswords) {
                branchManager.setPasswordHash(passwordEncoder.encode(branchManagerPassword));
            }
            accountRepository.save(branchManager);
            log.debug("[Seed] Branch Manager account role synchronized.");
            return;
        }

        Account branchManager = Account.builder()
                .username(branchManagerUsername)
                .email(branchManagerEmail)
                .passwordHash(passwordEncoder.encode(branchManagerPassword))
                .roles(Set.of(managerRole))
                .status(AccountStatus.ACTIVE)
                .build();

        accountRepository.save(branchManager);
        log.warn("[Seed] Branch Manager account created — username: '{}'. Change the default password before going to production!", branchManagerUsername);
    }
}
