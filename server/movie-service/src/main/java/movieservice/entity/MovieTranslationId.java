package movieservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class MovieTranslationId implements Serializable {

    @Column(name = "movie_id")
    Long movieId;

    @Column(name = "language_code", length = 2)
    String languageCode;   // ISO 639-1: vi, en, ko, ja, zh
}
