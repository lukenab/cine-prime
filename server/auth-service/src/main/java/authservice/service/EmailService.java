package authservice.service;

import authservice.exception.AuthErrorCode;
import jakarta.mail.internet.MimeMessage;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class EmailService {

    JavaMailSender javaMailSender;
    SpringTemplateEngine templateEngine;

    private static final int OTP_EXPIRY_MINUTES = 5;

    public void sendOtpEmail(String email, String otp) {
        try {
            Context context = new Context();
            context.setVariable("otp", otp);
            context.setVariable("expiryMinutes", OTP_EXPIRY_MINUTES);

            String htmlContent = templateEngine.process("email/otp-email", context);

            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(email);
            helper.setSubject("CinePrime - Account Verification Code");
            helper.setText(htmlContent, true);

            javaMailSender.send(message);
            log.info("Successfully sent OTP email to: {}", email);

        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to send OTP email to: {}", email, e);
            throw new AppException(AuthErrorCode.EMAIL_SEND_FAILED);
        }
    }
}
