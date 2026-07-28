package movieservice.service;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.MovieScreeningVersionRequest;
import movieservice.dto.response.MovieScreeningVersionCatalogResponse;
import movieservice.dto.response.MovieScreeningVersionResponse;
import movieservice.entity.AudioFormat;
import movieservice.entity.Movie;
import movieservice.entity.MovieScreeningVersion;
import movieservice.entity.ScreeningFormat;
import movieservice.enums.MovieStatus;
import movieservice.enums.ScreeningVersionStatus;
import movieservice.repository.MovieRepository;
import movieservice.repository.MovieScreeningVersionRepository;
import movieservice.repository.ScreeningFormatRepository;
import movieservice.repository.AudioFormatRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MovieScreeningVersionServiceTest {

    @Mock MovieRepository movieRepository;
    @Mock ScreeningFormatRepository screeningFormatRepository;
    @Mock AudioFormatRepository audioFormatRepository;
    @Mock MovieScreeningVersionRepository versionRepository;
    @InjectMocks MovieScreeningVersionService service;

    @Test
    void createNormalizesLanguagesAndReturnsCompatibilitySummary() {
        ScreeningFormat format = format(2, "IMAX");
        AudioFormat audioFormat = audioFormat(3, "DOLBY_ATMOS");
        Movie movie = movie(format);
        when(movieRepository.findById(10L)).thenReturn(Optional.of(movie));
        when(screeningFormatRepository.findById(2)).thenReturn(Optional.of(format));
        when(audioFormatRepository.findByAudioFormatIdAndActiveTrue(3)).thenReturn(Optional.of(audioFormat));
        when(versionRepository.findByMovie_MovieId(10L)).thenReturn(List.of());
        when(versionRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            MovieScreeningVersion saved = invocation.getArgument(0);
            saved.setScreeningVersionId(99L);
            return saved;
        });
        when(versionRepository.countAudioCompatibleRooms(2, 3)).thenReturn(4L);
        when(versionRepository.countAudioCompatibleClusters(2, 3)).thenReturn(2L);

        MovieScreeningVersionResponse response = service.create(
                10L,
                new MovieScreeningVersionRequest(
                        2,
                        3,
                        " VI ",
                        " EN ",
                        LocalDate.of(2026, 8, 1),
                        LocalDate.of(2026, 8, 31)
                )
        );

        ArgumentCaptor<MovieScreeningVersion> captor = ArgumentCaptor.forClass(MovieScreeningVersion.class);
        verify(versionRepository).saveAndFlush(captor.capture());
        assertEquals("vi", captor.getValue().getAudioLanguageCode());
        assertEquals("en", captor.getValue().getSubtitleLanguageCode());
        assertEquals(ScreeningVersionStatus.ACTIVE, captor.getValue().getStatus());
        assertEquals(4L, response.compatibleRoomCount());
        assertEquals(2L, response.compatibleClusterCount());
    }

    @Test
    void createBulkCreatesAllRequestedFormatsWithSharedDeliveryMetadata() {
        ScreeningFormat twoD = format(1, "2D");
        ScreeningFormat imax = format(2, "IMAX");
        AudioFormat audioFormat = audioFormat(3, "DOLBY_5_1");
        Movie movie = movie(twoD);

        when(movieRepository.findById(10L)).thenReturn(Optional.of(movie));
        when(screeningFormatRepository.findById(1)).thenReturn(Optional.of(twoD));
        when(screeningFormatRepository.findById(2)).thenReturn(Optional.of(imax));
        when(audioFormatRepository.findByAudioFormatIdAndActiveTrue(3))
                .thenReturn(Optional.of(audioFormat));
        when(versionRepository.findByMovie_MovieId(10L)).thenReturn(List.of());
        when(versionRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<MovieScreeningVersionResponse> result = service.createBulk(
                10L,
                List.of(
                        new MovieScreeningVersionRequest(1, 3, "ja", "vi", null, null),
                        new MovieScreeningVersionRequest(2, 3, "ja", "vi", null, null)
                )
        );

        assertEquals(2, result.size());
        verify(versionRepository, org.mockito.Mockito.times(2)).saveAndFlush(any());
    }

    @Test
    void updateRejectsIdentityRewriteAfterVersionIsReferenced() {
        ScreeningFormat format = format(1, "2D");
        AudioFormat audioFormat = audioFormat(1, "DOLBY_5_1");
        Movie movie = movie(format);
        MovieScreeningVersion existing = MovieScreeningVersion.builder()
                .screeningVersionId(7L)
                .movie(movie)
                .format(format)
                .audioFormat(audioFormat)
                .audioLanguageCode("vi")
                .status(ScreeningVersionStatus.ACTIVE)
                .build();

        when(movieRepository.findById(10L)).thenReturn(Optional.of(movie));
        when(versionRepository.findByScreeningVersionIdAndMovie_MovieId(7L, 10L))
                .thenReturn(Optional.of(existing));
        when(screeningFormatRepository.findById(1)).thenReturn(Optional.of(format));
        when(audioFormatRepository.findByAudioFormatIdAndActiveTrue(1)).thenReturn(Optional.of(audioFormat));
        when(versionRepository.findByMovie_MovieId(10L)).thenReturn(List.of(existing));
        when(versionRepository.countShowtimeReferences(7L)).thenReturn(1L);

        assertThrows(
                AppException.class,
                () -> service.update(
                        10L,
                        7L,
                        new MovieScreeningVersionRequest(1, 1, "en", null, null, null)
                )
        );
        verify(versionRepository, never()).saveAndFlush(any());
    }

    @Test
    void activateRejectsSupersededVersion() {
        ScreeningFormat format = format(1, "2D");
        AudioFormat audioFormat = audioFormat(1, "DOLBY_5_1");
        Movie movie = movie(format);
        MovieScreeningVersion superseded = MovieScreeningVersion.builder()
                .screeningVersionId(7L)
                .movie(movie)
                .format(format)
                .audioFormat(audioFormat)
                .audioLanguageCode("vi")
                .status(ScreeningVersionStatus.SUPERSEDED)
                .build();

        when(movieRepository.findById(10L)).thenReturn(Optional.of(movie));
        when(versionRepository.findByScreeningVersionIdAndMovie_MovieId(7L, 10L))
                .thenReturn(Optional.of(superseded));

        assertThrows(AppException.class, () -> service.activate(10L, 7L));
        verify(versionRepository, never()).save(any());
    }

    @Test
    void catalogMarksActiveVersionWithoutCompatibleRoomForAttention() {
        ScreeningFormat format = format(4, "4DX");
        AudioFormat audioFormat = audioFormat(3, "DOLBY_ATMOS");
        Movie movie = movie(format);
        MovieScreeningVersion version = MovieScreeningVersion.builder()
                .screeningVersionId(8L)
                .movie(movie)
                .format(format)
                .audioFormat(audioFormat)
                .audioLanguageCode("vi")
                .status(ScreeningVersionStatus.ACTIVE)
                .build();

        when(versionRepository.searchCatalog(null, ScreeningVersionStatus.ACTIVE, 4))
                .thenReturn(List.of(version));
        when(versionRepository.countAudioCompatibleRooms(4, 3)).thenReturn(0L);
        when(versionRepository.countAudioCompatibleClusters(4, 3)).thenReturn(0L);

        List<MovieScreeningVersionCatalogResponse> result =
                service.searchCatalog(null, ScreeningVersionStatus.ACTIVE, 4, true);

        assertEquals(1, result.size());
        assertEquals("Test Movie", result.getFirst().movieTitle());
        assertEquals(true, result.getFirst().requiresAttention());
    }

    private Movie movie(ScreeningFormat format) {
        return Movie.builder()
                .movieId(10L)
                .originalTitle("Test Movie")
                .status(MovieStatus.DRAFT)
                .formats(List.of(format))
                .build();
    }

    private ScreeningFormat format(int id, String code) {
        return ScreeningFormat.builder()
                .formatId(id)
                .formatCode(code)
                .formatName(code)
                .build();
    }

    private AudioFormat audioFormat(int id, String code) {
        return AudioFormat.builder()
                .audioFormatId(id)
                .formatCode(code)
                .formatName(code)
                .active(true)
                .build();
    }
}
