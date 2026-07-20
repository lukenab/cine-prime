package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.request.ScreeningFormatRequest;
import movieservice.dto.response.ScreeningFormatResponse;
import movieservice.entity.ScreeningFormat;
import movie.theater.common.exception.AppException;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.ScreeningFormatRepository;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/screening-formats")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ScreeningFormatController {

    ScreeningFormatRepository screeningFormatRepository;
    MovieMapper movieMapper;

    @GetMapping
    public ApiResponse<List<ScreeningFormatResponse>> getAll() {
        return ApiResponse.<List<ScreeningFormatResponse>>builder()
                .code(200)
                .result(movieMapper.toScreeningFormatResponseList(screeningFormatRepository.findAll()))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<ScreeningFormatResponse> getById(@PathVariable Integer id) {
        ScreeningFormat entity = screeningFormatRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.FORMAT_NOT_FOUND));
        return ApiResponse.<ScreeningFormatResponse>builder()
                .code(200).result(movieMapper.toScreeningFormatResponse(entity)).build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ApiResponse<ScreeningFormatResponse> create(@Valid @RequestBody ScreeningFormatRequest req) {
        ScreeningFormat entity = ScreeningFormat.builder()
                .formatCode(req.getFormatCode().toUpperCase().trim())
                .formatName(req.getFormatName().trim())
                .description(req.getDescription())
                .surcharge(req.getSurcharge())
                .status(req.getStatus() != null ? req.getStatus() : "ACTIVE")
                .build();
        return ApiResponse.<ScreeningFormatResponse>builder()
                .code(201)
                .result(movieMapper.toScreeningFormatResponse(screeningFormatRepository.save(entity)))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ApiResponse<ScreeningFormatResponse> update(@PathVariable Integer id,
                                                        @Valid @RequestBody ScreeningFormatRequest req) {
        ScreeningFormat entity = screeningFormatRepository.findById(id)
                .orElseThrow(() -> new AppException(MovieErrorCode.FORMAT_NOT_FOUND));
        entity.setFormatCode(req.getFormatCode().toUpperCase().trim());
        entity.setFormatName(req.getFormatName().trim());
        entity.setDescription(req.getDescription());
        entity.setSurcharge(req.getSurcharge());
        if (req.getStatus() != null) {
            entity.setStatus(req.getStatus());
        }
        return ApiResponse.<ScreeningFormatResponse>builder()
                .code(200)
                .result(movieMapper.toScreeningFormatResponse(screeningFormatRepository.save(entity)))
                .build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Integer id) {
        if (!screeningFormatRepository.existsById(id))
            throw new AppException(MovieErrorCode.FORMAT_NOT_FOUND);
        screeningFormatRepository.deleteById(id);
        return ApiResponse.<Void>builder().code(200).message("Deleted").build();
    }
}
