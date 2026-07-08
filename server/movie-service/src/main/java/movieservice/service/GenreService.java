package movieservice.service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.response.GenreResponse;
import movieservice.entity.Genre;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.GenreRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class GenreService {

    GenreRepository genreRepository;
    MovieMapper movieMapper;

    public List<GenreResponse> getAll() {
        return movieMapper.toGenreResponseList(genreRepository.findAll());
    }

    public GenreResponse getById(Long id) {
        Genre genre = genreRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.GENRE_NOT_FOUND));
        return movieMapper.toGenreResponse(genre);
    }

    @Transactional
    public GenreResponse create(String genreName, String genreCode) {
        if (genreRepository.existsByGenreName(genreName)) {
            throw new AppException(MovieErrorCode.MOVIE_TYPE_NAME_EXISTED);
        }
        Genre genre = Genre.builder()
                .genreName(genreName)
                .genreCode(genreCode)
                .build();
        return movieMapper.toGenreResponse(genreRepository.save(genre));
    }
}
