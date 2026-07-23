package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.CinemaCluster;
import movieservice.entity.Movie;
import movieservice.entity.MovieScreeningVersion;
import movieservice.repository.MovieAvailabilityRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SchedulingEligibilityService {
    public static final String AVAILABILITY_NOT_OPEN = "AVAILABILITY_NOT_OPEN";

    private final MovieAvailabilityRepository availabilityRepository;

    /**
     * Theatrical-rights and classification-approval checking are intentionally out of scope
     * for now - both represent real government/distributor decisions this project doesn't
     * have authority to grant, and movie_classification_approval's existing rows are all
     * migration-generated placeholders rather than real approvals. Only availability gates
     * scheduling eligibility; re-add either check here if that scope changes and real data
     * backs it.
     */
    @Transactional(readOnly = true)
    public SchedulingEligibilityResult evaluate(
            Movie movie,
            CinemaCluster cluster,
            MovieScreeningVersion screeningVersion,
            LocalDate businessDate
    ) {
        List<String> reasons = new ArrayList<>();

        if (!availabilityRepository.existsSchedulableForDate(
                movie.getMovieId(), cluster.getClusterId(), businessDate)) {
            reasons.add(AVAILABILITY_NOT_OPEN);
        }

        return reasons.isEmpty()
                ? SchedulingEligibilityResult.allowed()
                : SchedulingEligibilityResult.denied(reasons);
    }
}
