package movieservice.controller;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.PersonRequest;
import movieservice.dto.response.PersonResponse;
import movieservice.entity.Person;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.MovieCastRepository;
import movieservice.repository.PersonRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/persons")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class PersonController {

    PersonRepository personRepository;
    MovieCastRepository movieCastRepository;
    MovieMapper movieMapper;

    // GET /api/persons?q=  — list / search
    @GetMapping
    public ApiResponse<List<PersonResponse>> getAll(
            @RequestParam(defaultValue = "") String q) {
        List<Person> persons = q.isBlank()
                ? personRepository.findAll()
                : personRepository.findByFullNameContainingIgnoreCase(q);
        return ApiResponse.<List<PersonResponse>>builder()
                .code(200)
                .result(movieMapper.toPersonResponseList(persons))
                .build();
    }

    // GET /api/persons/search?q=  — kept for backward compat (MovieModal cast search)
    @GetMapping("/search")
    public ApiResponse<List<PersonResponse>> search(
            @RequestParam(defaultValue = "") String q) {
        return getAll(q);
    }

    // GET /api/persons/{id}
    @GetMapping("/{id}")
    public ApiResponse<PersonResponse> getById(@PathVariable Long id) {
        Person person = personRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Person not found"));
        return ApiResponse.<PersonResponse>builder()
                .code(200)
                .result(movieMapper.toPersonResponse(person))
                .build();
    }

    // POST /api/persons - `[Backend] Enforce movie-service endpoint authorization matrix`:
    // previously had no @PreAuthorize at all, so any authenticated CUSTOMER could create/edit/
    // delete cast & crew reference data. ADMIN/EMPLOYEE matches who actually needs this - cast
    // is added inline while creating/editing a movie in MovieEditorPage (both roles use it).
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PersonResponse> create(@Valid @RequestBody PersonRequest request) {
        String fullName = request.getFullName().trim();
        Person existing = personRepository.findByFullNameIgnoreCase(fullName).orElse(null);
        if (existing != null) {
            // A TMDB-sourced cast pick (resolveCastPersonIds() in MovieEditorPage) whose tmdbId
            // doesn't match anyone locally yet still collides on name here whenever the real
            // person already exists without a tmdb_id - one of the legacy hand-seeded rows
            // V12__merge_duplicate_person_records.sql didn't cover, or simply never linked. Same
            // real person re-surfacing, not a genuine duplicate name, so backfill their tmdb_id
            // and reuse them instead of blocking the movie save. Only block when the existing
            // row's tmdb_id is already set to something else - that's a real ambiguity (two
            // different people sharing this exact name) this can't safely auto-resolve.
            boolean sameOrUnlinkedTmdbId = existing.getTmdbId() == null
                    || existing.getTmdbId().equals(request.getTmdbId());
            if (request.getTmdbId() != null && sameOrUnlinkedTmdbId) {
                if (existing.getTmdbId() == null) {
                    existing.setTmdbId(request.getTmdbId());
                    existing.setUpdatedAt(LocalDateTime.now());
                    existing = personRepository.save(existing);
                }
                return ApiResponse.<PersonResponse>builder()
                        .code(201)
                        .result(movieMapper.toPersonResponse(existing))
                        .build();
            }
            throw new AppException(MovieErrorCode.PERSON_NAME_ALREADY_EXISTS);
        }
        Person person = Person.builder()
                .fullName(fullName)
                .nationality(request.getNationality())
                .birthDate(request.getBirthDate())
                .photoUrl(request.getPhotoUrl())
                .biography(request.getBiography())
                .tmdbId(request.getTmdbId())
                .gender(request.getGender())
                .knownForDepartment(request.getKnownForDepartment())
                .deathDate(request.getDeathDate())
                .placeOfBirth(request.getPlaceOfBirth())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        person = personRepository.save(person);
        return ApiResponse.<PersonResponse>builder()
                .code(201)
                .result(movieMapper.toPersonResponse(person))
                .build();
    }

    // PUT /api/persons/{id}
    @PreAuthorize("hasAnyRole('ADMIN', 'EMPLOYEE')")
    @PutMapping("/{id}")
    public ApiResponse<PersonResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody PersonRequest request) {
        Person person = personRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Person not found"));
        String fullName = request.getFullName().trim();
        if (personRepository.existsByFullNameIgnoreCaseAndPersonIdNot(fullName, id)) {
            throw new AppException(MovieErrorCode.PERSON_NAME_ALREADY_EXISTS);
        }
        person.setFullName(fullName);
        person.setNationality(request.getNationality());
        person.setBirthDate(request.getBirthDate());
        person.setPhotoUrl(request.getPhotoUrl());
        person.setBiography(request.getBiography());
        if (request.getTmdbId() != null) person.setTmdbId(request.getTmdbId());
        person.setGender(request.getGender());
        person.setKnownForDepartment(request.getKnownForDepartment());
        person.setDeathDate(request.getDeathDate());
        person.setPlaceOfBirth(request.getPlaceOfBirth());
        person.setUpdatedAt(LocalDateTime.now());
        person = personRepository.save(person);
        return ApiResponse.<PersonResponse>builder()
                .code(200)
                .result(movieMapper.toPersonResponse(person))
                .build();
    }

    // DELETE /api/persons/{id} - ADMIN only, more consequential than create/update (a person
    // may be referenced as cast on several movies).
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        if (!personRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Person not found");
        }
        if (movieCastRepository.existsByPerson_PersonId(id)) {
            throw new AppException(MovieErrorCode.PERSON_STILL_REFERENCED);
        }
        personRepository.deleteById(id);
        return ApiResponse.<Void>builder()
                .code(200)
                .message("Deleted successfully")
                .build();
    }
}
