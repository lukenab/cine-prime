package movieservice.service.autoshowtime;

import movieservice.entity.ShowTime;

public record AutoShowtimePersistenceResult(
        ShowTime showtime,
        AutoShowtimeCandidateRejection rejection
) {
    public static AutoShowtimePersistenceResult created(ShowTime showtime) {
        return new AutoShowtimePersistenceResult(showtime, null);
    }

    public static AutoShowtimePersistenceResult rejected(AutoShowtimeCandidateRejection rejection) {
        return new AutoShowtimePersistenceResult(null, rejection);
    }

    public boolean successful() { return showtime != null; }
}

