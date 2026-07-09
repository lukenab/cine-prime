package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.AgeRatingRequest;
import movieservice.dto.response.AgeRatingResponse;
import movieservice.entity.AgeRating;
import movieservice.exception.AppException;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.AgeRatingRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/age-ratings")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AgeRatingController {

    AgeRatingRepository ageRatingRepository;
    MovieMapper movieMapper;

    @GetMapping
    public ApiResponse<List<AgeRatingResponse>> getAll() {
        return ApiResponse.<List<AgeRatingResponse>>builder()
                .code(200)
                .result(movieMapper.toAgeRatingResponseList(ageRatingRepository.findAll()))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<AgeRatingResponse> getById(@PathVariable Integer id) {
        AgeRating entity = ageRatingRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.AGE_RATING_NOT_FOUND));
        return ApiResponse.<AgeRatingResponse>builder()
                .code(200).result(movieMapper.toAgeRatingResponse(entity)).build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ApiResponse<AgeRatingResponse> create(@Valid @RequestBody AgeRatingRequest req) {
        AgeRating entity = AgeRating.builder()
                .ratingCode(req.getRatingCode().toUpperCase().trim())
                .minAge(req.getMinAge())
                .description(req.getDescription())
                .build();
        return ApiResponse.<AgeRatingResponse>builder()
                .code(201)
                .result(movieMapper.toAgeRatingResponse(ageRatingRepository.save(entity)))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ApiResponse<AgeRatingResponse> update(@PathVariable Integer id,
                                                  @Valid @RequestBody AgeRatingRequest req) {
        AgeRating entity = ageRatingRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.AGE_RATING_NOT_FOUND));
        entity.setRatingCode(req.getRatingCode().toUpperCase().trim());
        entity.setMinAge(req.getMinAge());
        entity.setDescription(req.getDescription());
        return ApiResponse.<AgeRatingResponse>builder()
                .code(200)
                .result(movieMapper.toAgeRatingResponse(ageRatingRepository.save(entity)))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Integer id) {
        if (!ageRatingRepository.existsById(id))
            throw new AppException(MovieErrorCode.AGE_RATING_NOT_FOUND);
        ageRatingRepository.deleteById(id);
        return ApiResponse.<Void>builder().code(200).message("Deleted").build();
    }
}
