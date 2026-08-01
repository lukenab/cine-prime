package movieservice.repository;

import movieservice.entity.Genre;
import movieservice.entity.Movie;
import movieservice.entity.MovieTranslation;
import movieservice.entity.MovieTranslationId;
import movieservice.enums.MovieStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.sql.init.mode=never",
        "spring.flyway.enabled=false",
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = MovieRepositoryKeywordSearchIntegrationTest.JpaTestApplication.class)
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class MovieRepositoryKeywordSearchIntegrationTest {

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EntityScan(basePackageClasses = Movie.class)
    @EnableJpaRepositories(basePackageClasses = MovieRepository.class)
    static class JpaTestApplication {
    }

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("movie_keyword_search_test")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private MovieRepository movieRepository;

    @Test
    void queryMatchesOriginalTitleCaseInsensitively() {
        Movie avengers = persistMovie("Avengers: Endgame", MovieStatus.APPROVED, LocalDate.of(2019, 4, 26));
        persistMovie("Interstellar", MovieStatus.APPROVED, LocalDate.of(2014, 11, 7));

        var result = movieRepository.findWithFilters(
                null, null, null, "%avenger%", PageRequest.of(0, 10));

        assertEquals(List.of(avengers.getMovieId()), movieIds(result.getContent()));
    }

    @Test
    void queryMatchesTranslatedTitleAndReturnsMovieOnlyOnce() {
        Movie avengers = persistMovie("Avengers: Endgame", MovieStatus.APPROVED, LocalDate.of(2019, 4, 26));
        persistTranslation(avengers, "vi", "Biệt đội siêu anh hùng");
        persistTranslation(avengers, "en", "The Avengers team");

        var result = movieRepository.findWithFilters(
                null, null, null, "%biệt đội%", PageRequest.of(0, 10));

        assertEquals(1, result.getTotalElements());
        assertEquals(List.of(avengers.getMovieId()), movieIds(result.getContent()));
    }

    @Test
    void queryCombinesKeywordWithStatusGenreAndReleaseDate() {
        Genre action = persistGenre("Action", "ACTION");
        Genre drama = persistGenre("Drama", "DRAMA");
        LocalDate releaseDate = LocalDate.of(2019, 4, 26);

        Movie expected = persistMovie(
                "Avengers: Endgame", MovieStatus.APPROVED, releaseDate, action);
        persistMovie("Avengers: Draft", MovieStatus.DRAFT, releaseDate, action);
        persistMovie("Avengers: Drama", MovieStatus.APPROVED, releaseDate, drama);
        persistMovie("Avengers: Older", MovieStatus.APPROVED, LocalDate.of(2018, 4, 26), action);

        var result = movieRepository.findWithFilters(
                MovieStatus.APPROVED, action.getGenreId(), releaseDate,
                "%avenger%", PageRequest.of(0, 10));

        assertEquals(List.of(expected.getMovieId()), movieIds(result.getContent()));
    }

    @Test
    void nullKeywordPreservesUnfilteredPagedBehavior() {
        persistMovie("Movie One", MovieStatus.DRAFT, LocalDate.of(2026, 1, 1));
        persistMovie("Movie Two", MovieStatus.APPROVED, LocalDate.of(2026, 2, 1));

        var result = movieRepository.findWithFilters(
                null, null, null, null, PageRequest.of(0, 1));

        assertEquals(2, result.getTotalElements());
        assertEquals(1, result.getContent().size());
    }

    private Movie persistMovie(String title, MovieStatus status, LocalDate releaseDate, Genre... genres) {
        Movie movie = new Movie();
        movie.setOriginalTitle(title);
        movie.setOriginalLanguage("en");
        movie.setDurationMinutes(120);
        movie.setReleaseDate(releaseDate);
        movie.setStatus(status);
        movie.setGenres(new ArrayList<>(List.of(genres)));
        return entityManager.persistAndFlush(movie);
    }

    private Genre persistGenre(String name, String code) {
        Genre genre = Genre.builder().genreName(name).genreCode(code).build();
        return entityManager.persistAndFlush(genre);
    }

    private void persistTranslation(Movie movie, String languageCode, String title) {
        MovieTranslation translation = MovieTranslation.builder()
                .id(new MovieTranslationId(movie.getMovieId(), languageCode))
                .movie(movie)
                .title(title)
                .build();
        entityManager.persistAndFlush(translation);
    }

    private List<Long> movieIds(List<Movie> movies) {
        return movies.stream().map(Movie::getMovieId).toList();
    }
}
