package movieservice.dto.response;

/// Movie Ä‘Æ°á»£c admin chá»n nhÆ°ng khÃ´ng táº¡o Ä‘Æ°á»£c candidate trong scope generation hiá»‡n táº¡i.
public record AutoShowtimeIneligibleMovie(
        Long movieId,
        String originalTitle
) {
}
