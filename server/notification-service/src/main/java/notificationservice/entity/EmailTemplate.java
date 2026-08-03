package notificationservice.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "email_template")
public class EmailTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "email_template_id")
    private int emailTemplateId;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 50)
    private String subject;

    @Column(name = "html_content", nullable = false, columnDefinition = "TEXT")
    private String htmlContent;

    @Column(nullable = false)
    private boolean active;
}
