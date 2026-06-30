package movieservice.service;

import java.util.List;

import org.springframework.stereotype.Service;

import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.TypeRequest;
import movieservice.dto.response.TypeMovieResponse;
import movieservice.entity.MovieType;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.TypeMovieRepository;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Slf4j
public class MovieTypeService {
    AuditLogService auditLogService;
    MovieMapper movieMapper;
    TypeMovieRepository typeRepository;

    @Transactional
    public TypeMovieResponse createTypeMovie(TypeRequest typeRequest) {
        if (typeRepository.existsByTypeName(typeRequest.getTypeName())) {
            throw new AppException(MovieErrorCode.MOVIE_TYPE_NAME_EXISTED);
        }
        MovieType type = movieMapper.toType(typeRequest);
        MovieType typeTmp = typeRepository.save(type);
        auditLogService.logAction("1", "Admin System", "type - id:" + String.valueOf(typeTmp.getTypeId()),
                "Created new type movie: " + typeTmp.getTypeName());
        TypeMovieResponse typeMovieResponse = movieMapper.toMovieResponse(typeTmp);
        return typeMovieResponse;

    }

    public List<TypeMovieResponse> getAllTypes() {
        return movieMapper.toTypeResponseList(typeRepository.findAll());
    }

    public MovieType findByType(Long typeId) {
        return typeRepository.findByTypeId(typeId);
    }
    public List<MovieType> findAllById(List<Long> typeId) {
        if (!typeId.isEmpty()) {
            return typeRepository.findAllById(typeId);
        }
        return null;
    }
}
