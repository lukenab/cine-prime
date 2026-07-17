package movieservice.controller;

import movieservice.dto.response.CinemaRoomMasterDataResponse;
import movieservice.entity.AuditoriumClass;
import movieservice.entity.AudioFormat;
import movieservice.entity.ProjectionTechnology;
import movieservice.entity.Resolution;
import movieservice.entity.RoomConfigurationTemplate;
import movieservice.repository.AudioFormatRepository;
import movieservice.repository.AuditoriumClassRepository;
import movieservice.repository.ProjectionTechnologyRepository;
import movieservice.repository.ResolutionRepository;
import movieservice.repository.RoomConfigurationTemplateRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomMasterDataControllerTest {

    @Mock AuditoriumClassRepository auditoriumClassRepository;
    @Mock ProjectionTechnologyRepository projectionTechnologyRepository;
    @Mock ResolutionRepository resolutionRepository;
    @Mock AudioFormatRepository audioFormatRepository;
    @Mock RoomConfigurationTemplateRepository roomConfigurationTemplateRepository;

    @InjectMocks RoomMasterDataController controller;

    @Test
    void returnsOnlyActiveCommercialServiceTiersProvidedByRepository() {
        when(auditoriumClassRepository.findByActiveTrue()).thenReturn(List.of(
                tier(1, "STANDARD", "Standard"),
                tier(2, "PREMIUM", "Premium"),
                tier(3, "LUXURY", "Luxury"),
                tier(4, "PRIVATE", "Private")
        ));
        when(projectionTechnologyRepository.findByActiveTrue()).thenReturn(List.of());
        when(resolutionRepository.findByActiveTrue()).thenReturn(List.of());
        when(audioFormatRepository.findByActiveTrue()).thenReturn(List.of());

        CinemaRoomMasterDataResponse result = controller.getMasterData().getResult();

        assertEquals(List.of("STANDARD", "PREMIUM", "LUXURY", "PRIVATE"),
                result.getAuditoriumClasses().stream().map(item -> item.getCode()).toList());
        assertFalse(result.getAuditoriumClasses().stream()
                .anyMatch(item -> item.getCode().equals("PLF") || item.getCode().equals("MOTION")));
        assertTrue(result.getPresentationSystems().containsAll(
                List.of("STANDARD", "IMAX", "DOLBY_CINEMA", "SCREENX")));
    }

    @Test
    void returnsDatabaseManagedRoomTemplatesWithMasterDataIds() {
        AuditoriumClass auditoriumClass = tier(2, "PREMIUM", "Premium");
        ProjectionTechnology projection = ProjectionTechnology.builder()
                .techId(3).techCode("LASER").techName("Laser").active(true).build();
        Resolution resolution = Resolution.builder()
                .resolutionId(4).resolutionCode("4K").resolutionName("4K").active(true).build();
        AudioFormat audio = AudioFormat.builder()
                .audioFormatId(5).formatCode("DOLBY_ATMOS").formatName("Dolby Atmos").active(true).build();
        when(roomConfigurationTemplateRepository.findByActiveTrueOrderByDisplayOrderAscTemplateNameAsc())
                .thenReturn(List.of(RoomConfigurationTemplate.builder()
                        .templateId(10).templateCode("PREMIUM_LASER").templateName("Premium Laser")
                        .description("Premium quick start")
                        .auditoriumClass(auditoriumClass).projectionTechnology(projection)
                        .resolution(resolution).audioFormat(audio)
                        .supports2d(true).supports3d(true)
                        .defaultRows(12).defaultPositionsPerRow(16)
                        .layoutTemplateCode("BALANCED").standardRowPercentage(40)
                        .coupleLastRow(true).centerAisle(true).crossAisle(false)
                        .displayOrder(20).active(true).build()));

        CinemaRoomMasterDataResponse result = controller.getMasterData().getResult();

        assertEquals(1, result.getRoomTemplates().size());
        assertEquals(2, result.getRoomTemplates().getFirst().getAuditoriumClassId());
        assertEquals(16, result.getRoomTemplates().getFirst().getMaxPositionsPerRow());
        assertEquals("BALANCED", result.getRoomTemplates().getFirst().getLayoutTemplateCode());
    }

    private AuditoriumClass tier(int id, String code, String name) {
        return AuditoriumClass.builder()
                .classId(id)
                .classCode(code)
                .className(name)
                .description(name + " commercial service tier")
                .active(true)
                .build();
    }
}
