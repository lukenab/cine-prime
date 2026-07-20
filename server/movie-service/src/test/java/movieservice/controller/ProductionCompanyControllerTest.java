package movieservice.controller;

import movieservice.dto.request.ProductionCompanyRequest;
import movieservice.entity.ProductionCompany;
import movieservice.mapper.MovieMapper;
import movieservice.repository.ProductionCompanyRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductionCompanyControllerTest {

    @Mock ProductionCompanyRepository productionCompanyRepository;
    @Mock MovieMapper movieMapper;

    @InjectMocks ProductionCompanyController productionCompanyController;

    @Test
    void create_WithNewTmdbCompanyId_SavesWithTmdbCompanyIdSet() {
        ProductionCompanyRequest req = ProductionCompanyRequest.builder()
                .name("Illumination").tmdbCompanyId(6704).build();
        when(productionCompanyRepository.findByTmdbCompanyId(6704)).thenReturn(Optional.empty());
        when(productionCompanyRepository.save(any(ProductionCompany.class))).thenAnswer(inv -> inv.getArgument(0));

        productionCompanyController.create(req);

        var captor = org.mockito.ArgumentCaptor.forClass(ProductionCompany.class);
        verify(productionCompanyRepository).save(captor.capture());
        assertEquals(6704, captor.getValue().getTmdbCompanyId());
    }

    @Test
    void create_TmdbCompanyIdAlreadyExists_ReusesExistingRowInsteadOfSaving() {
        ProductionCompany existing = new ProductionCompany();
        existing.setCompanyId(5L);
        existing.setName("Illumination");
        existing.setTmdbCompanyId(6704);
        when(productionCompanyRepository.findByTmdbCompanyId(6704)).thenReturn(Optional.of(existing));

        ProductionCompanyRequest req = ProductionCompanyRequest.builder()
                .name("Illumination").tmdbCompanyId(6704).build();
        productionCompanyController.create(req);

        verify(productionCompanyRepository, never()).save(any());
    }

    @Test
    void create_WithoutTmdbCompanyId_SavesWithNullTmdbCompanyId() {
        ProductionCompanyRequest req = ProductionCompanyRequest.builder().name("Local Indie Studio").build();
        when(productionCompanyRepository.save(any(ProductionCompany.class))).thenAnswer(inv -> inv.getArgument(0));

        productionCompanyController.create(req);

        var captor = org.mockito.ArgumentCaptor.forClass(ProductionCompany.class);
        verify(productionCompanyRepository).save(captor.capture());
        assertEquals(null, captor.getValue().getTmdbCompanyId());
        verify(productionCompanyRepository, never()).findByTmdbCompanyId(any());
    }
}
