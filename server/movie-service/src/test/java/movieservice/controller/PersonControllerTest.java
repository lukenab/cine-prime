package movieservice.controller;

import movie.theater.common.exception.AppException;
import movieservice.dto.request.PersonRequest;
import movieservice.entity.Person;
import movieservice.exception.MovieErrorCode;
import movieservice.mapper.MovieMapper;
import movieservice.repository.MovieCastRepository;
import movieservice.repository.PersonRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PersonControllerTest {

    @Mock PersonRepository personRepository;
    @Mock MovieCastRepository movieCastRepository;
    @Mock MovieMapper movieMapper;

    @InjectMocks PersonController personController;

    private static final long PERSON_ID = 1L;

    private PersonRequest requestWithName(String name) {
        return PersonRequest.builder().fullName(name).build();
    }

    @Test
    void create_DuplicateNameNoTmdbId_ThrowsAndDoesNotSave() {
        Person existing = new Person();
        existing.setPersonId(PERSON_ID);
        existing.setFullName("Christopher Nolan");
        when(personRepository.findByFullNameIgnoreCase("Christopher Nolan")).thenReturn(Optional.of(existing));

        AppException ex = assertThrows(AppException.class,
                () -> personController.create(requestWithName("Christopher Nolan")));

        assertEquals(MovieErrorCode.PERSON_NAME_ALREADY_EXISTS, ex.getErrorCode());
        verify(personRepository, never()).save(any());
    }

    @Test
    void create_DuplicateNameConflictingTmdbId_ThrowsAndDoesNotSave() {
        Person existing = new Person();
        existing.setPersonId(PERSON_ID);
        existing.setFullName("Christopher Nolan");
        existing.setTmdbId(525);
        when(personRepository.findByFullNameIgnoreCase("Christopher Nolan")).thenReturn(Optional.of(existing));

        PersonRequest request = PersonRequest.builder().fullName("Christopher Nolan").tmdbId(999).build();
        AppException ex = assertThrows(AppException.class, () -> personController.create(request));

        assertEquals(MovieErrorCode.PERSON_NAME_ALREADY_EXISTS, ex.getErrorCode());
        verify(personRepository, never()).save(any());
    }

    @Test
    void create_DuplicateNameUnlinkedTmdbId_BackfillsAndReusesExisting() {
        Person existing = new Person();
        existing.setPersonId(PERSON_ID);
        existing.setFullName("Christopher Nolan");
        existing.setTmdbId(null);
        when(personRepository.findByFullNameIgnoreCase("Christopher Nolan")).thenReturn(Optional.of(existing));
        when(personRepository.save(any(Person.class))).thenAnswer(inv -> inv.getArgument(0));

        PersonRequest request = PersonRequest.builder().fullName("Christopher Nolan").tmdbId(525).build();
        personController.create(request);

        assertEquals(525, existing.getTmdbId());
        verify(personRepository).save(existing);
    }

    @Test
    void create_UniqueName_Saves() {
        when(personRepository.findByFullNameIgnoreCase("New Person")).thenReturn(Optional.empty());
        when(personRepository.save(any(Person.class))).thenAnswer(inv -> inv.getArgument(0));

        personController.create(requestWithName("New Person"));

        verify(personRepository).save(any(Person.class));
    }

    @Test
    void update_RenameIntoCollision_ThrowsAndDoesNotSave() {
        Person existing = new Person();
        existing.setPersonId(PERSON_ID);
        existing.setFullName("Old Name");
        when(personRepository.findById(PERSON_ID)).thenReturn(Optional.of(existing));
        when(personRepository.existsByFullNameIgnoreCaseAndPersonIdNot("Someone Else", PERSON_ID)).thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> personController.update(PERSON_ID, requestWithName("Someone Else")));

        assertEquals(MovieErrorCode.PERSON_NAME_ALREADY_EXISTS, ex.getErrorCode());
        verify(personRepository, never()).save(any());
    }

    @Test
    void delete_StillReferencedByMovieCast_ThrowsAndDoesNotDelete() {
        when(personRepository.existsById(PERSON_ID)).thenReturn(true);
        when(movieCastRepository.existsByPerson_PersonId(PERSON_ID)).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> personController.delete(PERSON_ID));

        assertEquals(MovieErrorCode.PERSON_STILL_REFERENCED, ex.getErrorCode());
        verify(personRepository, never()).deleteById(any());
    }

    @Test
    void delete_NotReferenced_Deletes() {
        when(personRepository.existsById(PERSON_ID)).thenReturn(true);
        when(movieCastRepository.existsByPerson_PersonId(PERSON_ID)).thenReturn(false);

        personController.delete(PERSON_ID);

        verify(personRepository).deleteById(PERSON_ID);
    }

    @Test
    void delete_NotFound_ThrowsResponseStatusException() {
        when(personRepository.existsById(PERSON_ID)).thenReturn(false);

        assertThrows(ResponseStatusException.class, () -> personController.delete(PERSON_ID));
        verify(movieCastRepository, never()).existsByPerson_PersonId(any());
    }
}
