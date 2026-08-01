package notificationservice.service;

import jakarta.mail.AuthenticationFailedException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final SpringTemplateEngine templateEngine;

    public void sendOtpEmail(String to, String otp, int expiryMinutes) {
        try {
            Context context = new Context();
            context.setVariable("otp", otp);
            context.setVariable("expiryMinutes", expiryMinutes);

            String html = templateEngine.process("email/otp-email", context);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(to);
            helper.setSubject("CinePrime - Account Verification Code");
            helper.setText(html, true);

            mailSender.send(message);
            log.info("OTP email sent to: {}", to);
        } catch (Exception e) {
            logSendFailure("OTP", to, e);
        }
    }

    public void sendAccountActivationEmail(String to, String fullName, String activationLink, int expiryHours) {
        try {
            Context context = new Context();
            context.setVariable("fullName", fullName);
            context.setVariable("activationLink", activationLink);
            context.setVariable("expiryHours", expiryHours);

            String html = templateEngine.process("email/account-activation-email", context);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(to);
            helper.setSubject("CinePrime - Activate Your Account");
            helper.setText(html, true);

            mailSender.send(message);
            log.info("Account activation email sent to: {}", to);
        } catch (Exception e) {
            logSendFailure("account activation", to, e);
        }
    }

    // Deliberately does not rethrow: the Kafka listeners that call sendOtpEmail/
    // sendAccountActivationEmail have no retry/DLT handling yet (tracked separately
    // in Issue #266/#269), so throwing here would just be swallowed by the default
    // Kafka error handler with no extra benefit. What was missing before was a loud,
    // unambiguous log line - a caught AuthenticationFailedException from Jakarta Mail
    // almost always means MAIL_USERNAME/MAIL_PASSWORD in application.yml/.env is wrong,
    // unset, or the Gmail App Password was revoked, which previously looked identical
    // in the logs to a transient network blip and was easy to miss.
    private void logSendFailure(String emailKind, String to, Exception e) {
        if (e instanceof AuthenticationFailedException) {
            log.error(
                    "MAIL SEND FAILED (auth rejected) - {} email to {} was NOT sent. "
                            + "MAIL_USERNAME/MAIL_PASSWORD is missing, wrong, or the Gmail App Password "
                            + "was revoked. Check env vars and see Issue #268. Cause: {}",
                    emailKind, to, e.getMessage(), e);
        } else {
            log.error("MAIL SEND FAILED - {} email to {} was NOT sent: {}", emailKind, to, e.getMessage(), e);
        }
    }
}
