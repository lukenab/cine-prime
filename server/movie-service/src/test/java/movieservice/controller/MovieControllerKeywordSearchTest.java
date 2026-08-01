package movieservice.controller;

import movieservice.enums.MovieStatus;
import movieservice.service.MovieService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;

import java.time.LocalDate;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MovieControllerKeywordSearchTest {

    @Mock
    private MovieService movieService;

    @Test
    void getPageForwardsQueryAndConvertsPageNumberToZeroBased() {
        LocalDate releaseDate = LocalDate.of(2026, 7, 9);
        when(movieService.findPageWithFilters(
                1, 25, "avenger", MovieStatus.APPROVED, 7L, releaseDate))
                .thenReturn(Page.empty());

        MovieController controller = new MovieController(movieService);
        controller.getPage(2, 25, "avenger", MovieStatus.APPROVED, 7L, releaseDate);

        verify(movieService).findPageWithFilters(
                1, 25, "avenger", MovieStatus.APPROVED, 7L, releaseDate);
    }
}
