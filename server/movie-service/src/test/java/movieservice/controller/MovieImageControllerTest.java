package movieservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import movieservice.entity.Movie;
import movieservice.entity.MovieImage;
import movieservice.mapper.MovieMapper;
import movieservice.repository.MovieImageRepository;
import movieservice.repository.MovieRepository;
import movie.theater.common.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
public class MovieImageControllerTest {

    private MockMvc mockMvc;

    @Mock
    private MovieRepository movieRepository;

    @Mock
    private MovieImageRepository movieImageRepository;

    @Mock
    private MovieMapper movieMapper;

    @InjectMocks
    private MovieImageController movieImageController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(movieImageController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new ObjectMapper()))
                .build();

        Movie mockMovie = new Movie();
        mockMovie.setMovieId(1L);
        // lenient() allows the mock to go unused without failing if a test doesn't reach the repo
        org.mockito.Mockito.lenient().when(movieRepository.findById(1L)).thenReturn(Optional.of(mockMovie));
        
        org.mockito.Mockito.lenient().when(movieImageRepository.save(any(MovieImage.class))).thenAnswer(invocation -> {
            MovieImage img = invocation.getArgument(0);
            img.setImageId(100L);
            return img;
        });
    }

    @Test
    void addImage_ValidType_Returns201() throws Exception {
        String payload = """
                {
                    "imageUrl": "http://example.com/logo.png",
                    "imageType": "LOGO",
                    "displayOrder": 1
                }
                """;

        mockMvc.perform(post("/api/movies/1/images")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isCreated());
    }

    @Test
    void addImage_InvalidType_Returns400() throws Exception {
        String payload = """
                {
                    "imageUrl": "http://example.com/invalid.png",
                    "imageType": "INVALID_TYPE",
                    "displayOrder": 1
                }
                """;

        mockMvc.perform(post("/api/movies/1/images")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Accepted values: [POSTER, BACKDROP, STILL, PROMOTIONAL, LOGO]")));
    }
}
