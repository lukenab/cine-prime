package userservice.service;

import org.junit.jupiter.api.Test;
import userservice.client.AuthAccountClient;
import userservice.dto.StaffProfileCompletionRequest;
import userservice.dto.UserResponse;
import userservice.entity.Employee;
import userservice.entity.User;
import userservice.event.UserRegisteredEvent;
import userservice.mapper.UserMapper;
import userservice.repository.UserRepository;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserServiceTest {

    @Test
    void completesMemberProfileWithoutIdentityCard() {
        UserRepository users = mock(UserRepository.class);
        UserMapper mapper = mock(UserMapper.class);
        when(users.findById("member-1")).thenReturn(Optional.empty());
        when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserService service = new UserService(
                users,
                mapper,
                mock(AuditLogService.class),
                mock(IdentityCardService.class),
                mock(ImageStorageService.class),
                mock(AuthAccountClient.class));

        service.createUserProfile(UserRegisteredEvent.builder()
                .accountId("member-1")
                .email("member@cineprime.vn")
                .fullName("Nguyen Van A")
                .phoneNumber("0901234567")
                .dateOfBirth(java.time.LocalDate.of(2000, 1, 2))
                .gender("Male")
                .build());

        var captor = org.mockito.ArgumentCaptor.forClass(User.class);
        verify(users).save(captor.capture());
        assertThat(captor.getValue().getProfileCompleted()).isTrue();
        assertThat(captor.getValue().getIdentityCard()).isNull();
    }

    @Test
    void completesStaffProfileWithoutCustomerIdentityFields() {
        UserRepository users = mock(UserRepository.class);
        UserMapper mapper = mock(UserMapper.class);
        User user = User.builder()
                .accountId("account-1")
                .email("staff@cineprime.vn")
                .profileCompleted(false)
                .isActive(true)
                .build();
        user.setEmployee(Employee.builder().employeeId("employee-1").user(user).build());

        when(users.findById("account-1")).thenReturn(Optional.of(user));
        when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toUserResponse(any(User.class))).thenAnswer(invocation -> {
            User saved = invocation.getArgument(0);
            return UserResponse.builder()
                    .accountId(saved.getAccountId())
                    .fullName(saved.getFullName())
                    .phoneNumber(saved.getPhoneNumber())
                    .profileCompleted(saved.getProfileCompleted())
                    .build();
        });

        UserService service = new UserService(
                users,
                mapper,
                mock(AuditLogService.class),
                mock(IdentityCardService.class),
                mock(ImageStorageService.class),
                mock(AuthAccountClient.class));

        UserResponse response = service.completeStaffProfile("account-1",
                StaffProfileCompletionRequest.builder()
                        .fullName("  Nguyen Van A  ")
                        .phoneNumber("0901234567")
                        .build());

        assertThat(response.getProfileCompleted()).isTrue();
        assertThat(response.getFullName()).isEqualTo("Nguyen Van A");
        assertThat(user.getIdentityCard()).isNull();
        assertThat(user.getDateOfBirth()).isNull();
        assertThat(user.getGender()).isNull();
        verify(users).save(user);
    }
}
