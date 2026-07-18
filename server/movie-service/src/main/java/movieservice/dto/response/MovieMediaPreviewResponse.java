package movieservice.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * Normalized TMDB media candidates for a movie, nested in TmdbMovieDetailsResponse.media.
 * "stills" are our own domain concept (extra backdrops beyond the recommended one) - TMDB's
 * own /images endpoint has no "stills" category for movies, only posters/backdrops/logos.
 */
@Getter
@Builder
public class MovieMediaPreviewResponse {
    String recommendedPosterPath;
    String recommendedBackdropPath;
    List<MovieMediaCandidateResponse> posters;
    List<MovieMediaCandidateResponse> backdrops;
    List<MovieMediaCandidateResponse> stills;
}
