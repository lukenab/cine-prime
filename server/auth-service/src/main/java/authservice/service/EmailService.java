package authservice.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class EmailService {

    JavaMailSender javaMailSender;

    public void sendOtpEmail(String email, String otp) {
        try {
            // 1. MimeMessage supports HTML
            MimeMessage message = javaMailSender.createMimeMessage();

            // 2. Use Helper to set parameters (true = supports multipart/HTML)
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(email);
            helper.setSubject("CinePrime - Account Verification Code");

            // 3. Design HTML interface (Using Java Text Block """)
            String htmlContent = """
                <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #050505; padding: 40px 20px; text-align: center; border-radius: 12px; max-width: 600px; margin: 0 auto;">
                    
                    <h1 style="color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: 2px; margin-bottom: 5px;">
                        CINE<span style="color: #FFD700;">PRIME</span>
                    </h1>
                    <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin-top: 0; text-transform: uppercase; letter-spacing: 1px;">
                        Verify your account
                    </p>
                    
                    <div style="background-color: #141414; border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; padding: 30px 20px; margin: 30px auto; max-width: 400px; box-shadow: 0 4px 20px rgba(255,215,0,0.1);">
                        <p style="margin: 0 0 15px 0; color: rgba(255,255,255,0.8); font-size: 15px;">Your OTP code is:</p>
                        
                        <h2 style="color: #FFD700; font-size: 42px; font-weight: 700; letter-spacing: 8px; margin: 0;">%s</h2>
                        
                    </div>
                    
                    <p style="color: #FF4B4B; font-size: 13px; margin-bottom: 20px;">
                        ⚠️ This code will expire in 5 minutes. Please do not share this code with anyone.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 30px 0 20px 0;" />
                    <p style="color: rgba(255,255,255,0.3); font-size: 12px; line-height: 1.5;">
                        If you did not request this code, please ignore this email.<br/>
                        © 2026 CinePrime. All rights reserved.
                    </p>
                </div>
                """.formatted(otp); // Map the otp variable to the %s placeholder

            // 4. Set email content (The second parameter 'true' tells Spring this is HTML)
            helper.setText(htmlContent, true);

            // 5. Send email
            javaMailSender.send(message);
            log.info("Successfully sent HTML OTP email to: {}", email);

        } catch (Exception e) {
            log.error("Error sending email to: {}", email, e);
            // Can throw an AppException here if you want to report the error to the Frontend
            // throw new AppException(ErrorCode.EMAIL_SEND_FAILED);
        }
    }
}