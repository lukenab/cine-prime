package movieservice.service.autoshowtime;

import lombok.RequiredArgsConstructor;
import movieservice.entity.CinemaCluster;
import movieservice.entity.Movie;
import movieservice.entity.MovieScreeningVersion;
import movieservice.repository.MovieAvailabilityRepository;
import movieservice.repository.MovieClassificationApprovalRepository;
import movieservice.repository.TheatricalLicenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SchedulingEligibilityService {
    public static final String AVAILABILITY_NOT_OPEN = "AVAILABILITY_NOT_OPEN";
    public static final String CLASSIFICATION_NOT_APPROVED = "CLASSIFICATION_NOT_APPROVED";
    public static final String THEATRICAL_RIGHT_NOT_ELIGIBLE = "THEATRICAL_RIGHT_NOT_ELIGIBLE";

    private final MovieAvailabilityRepository availabilityRepository;
    private final TheatricalLicenseRepository licenseRepository;
    private final MovieClassificationApprovalRepository classificationRepository;

    @Transactional(readOnly = true)
    public SchedulingEligibilityResult evaluate(
            Movie movie,
            CinemaCluster cluster,
            MovieScreeningVersion screeningVersion,
            LocalDate businessDate
    ) {
        List<String> reasons = new ArrayList<>();
        String territory = cluster.getCountryCode() == null ? "VN" : cluster.getCountryCode();

        if (!availabilityRepository.existsSchedulableForDate(
                movie.getMovieId(), cluster.getClusterId(), businessDate)) {
            reasons.add(AVAILABILITY_NOT_OPEN);
        }
        if (!classificationRepository.existsApprovedClassification(
                movie.getMovieId(), territory, businessDate)) {
            reasons.add(CLASSIFICATION_NOT_APPROVED);
        }
        if (!licenseRepository.existsEligibleLicense(
                movie.getMovieId(),
                screeningVersion.getScreeningVersionId(),
                cluster.getClusterId(),
                territory,
                businessDate)) {
            reasons.add(THEATRICAL_RIGHT_NOT_ELIGIBLE);
        }

        return reasons.isEmpty()
                ? SchedulingEligibilityResult.allowed()
                : SchedulingEligibilityResult.denied(reasons);
    }
}
