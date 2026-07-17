package movieservice.controller;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.dto.ApiResponse;
import movieservice.dto.response.CinemaRoomMasterDataResponse;
import movieservice.dto.response.MasterDataItemResponse;
import movieservice.dto.response.RoomConfigurationTemplateResponse;
import movieservice.entity.AudioFormat;
import movieservice.entity.AuditoriumClass;
import movieservice.entity.ProjectionTechnology;
import movieservice.entity.Resolution;
import movieservice.enums.LayoutPositionType;
import movieservice.enums.LayoutStatus;
import movieservice.enums.NumberingDirection;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.PresentationSystem;
import movieservice.enums.SeatType;
import movieservice.repository.AudioFormatRepository;
import movieservice.repository.AuditoriumClassRepository;
import movieservice.repository.ProjectionTechnologyRepository;
import movieservice.repository.ResolutionRepository;
import movieservice.repository.RoomConfigurationTemplateRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

/**
 * Read-only master data for the Cinema Room creation wizard's dropdowns — the
 * frontend must never hardcode these lists (see CLAUDE_CINEMA_ROOM_IMPLEMENTATION_PROMPT.md §5/§11).
 * Only a single aggregate GET endpoint is exposed this sprint; per-type admin
 * CRUD for the four master tables is a documented scope cut (seed via migration).
 */
@RestController
@RequestMapping("/api/cinema-room-master-data")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoomMasterDataController {

    AuditoriumClassRepository auditoriumClassRepository;
    ProjectionTechnologyRepository projectionTechnologyRepository;
    ResolutionRepository resolutionRepository;
    AudioFormatRepository audioFormatRepository;
    RoomConfigurationTemplateRepository roomConfigurationTemplateRepository;

    @GetMapping
    public ApiResponse<CinemaRoomMasterDataResponse> getMasterData() {
        CinemaRoomMasterDataResponse result = CinemaRoomMasterDataResponse.builder()
                .auditoriumClasses(auditoriumClassRepository.findByActiveTrue().stream()
                        .map(this::toItem).toList())
                .projectionTechnologies(projectionTechnologyRepository.findByActiveTrue().stream()
                        .map(this::toItem).toList())
                .resolutions(resolutionRepository.findByActiveTrue().stream()
                        .map(this::toItem).toList())
                .audioFormats(audioFormatRepository.findByActiveTrue().stream()
                        .map(this::toItem).toList())
                .roomTemplates(roomConfigurationTemplateRepository.findByActiveTrueOrderByDisplayOrderAscTemplateNameAsc()
                        .stream().map(template -> RoomConfigurationTemplateResponse.builder()
                                .id(template.getTemplateId())
                                .code(template.getTemplateCode())
                                .name(template.getTemplateName())
                                .description(template.getDescription())
                                .auditoriumClassId(template.getAuditoriumClass().getClassId())
                                .projectionTechnologyId(template.getProjectionTechnology().getTechId())
                                .resolutionId(template.getResolution().getResolutionId())
                                .audioFormatId(template.getAudioFormat().getAudioFormatId())
                                .supports2d(template.getSupports2d())
                                .supports3d(template.getSupports3d())
                                .numberOfRows(template.getDefaultRows())
                                .maxPositionsPerRow(template.getDefaultPositionsPerRow())
                                .layoutTemplateCode(template.getLayoutTemplateCode())
                                .standardRowPercentage(template.getStandardRowPercentage())
                                .coupleLastRow(template.getCoupleLastRow())
                                .centerAisle(template.getCenterAisle())
                                .crossAisle(template.getCrossAisle())
                                .build())
                        .toList())
                .presentationSystems(enumNames(PresentationSystem.values()))
                .seatTypes(enumNames(SeatType.values()))
                .numberingDirections(enumNames(NumberingDirection.values()))
                .layoutPositionTypes(enumNames(LayoutPositionType.values()))
                .roomStatuses(enumNames(CinemaRoomStatus.values()))
                .layoutStatuses(enumNames(LayoutStatus.values()))
                .build();

        return ApiResponse.<CinemaRoomMasterDataResponse>builder()
                .code(200)
                .result(result)
                .build();
    }

    private MasterDataItemResponse toItem(AuditoriumClass e) {
        return MasterDataItemResponse.builder()
                .id(e.getClassId()).code(e.getClassCode()).name(e.getClassName()).description(e.getDescription())
                .build();
    }

    private MasterDataItemResponse toItem(ProjectionTechnology e) {
        return MasterDataItemResponse.builder()
                .id(e.getTechId()).code(e.getTechCode()).name(e.getTechName()).description(e.getDescription())
                .build();
    }

    private MasterDataItemResponse toItem(Resolution e) {
        return MasterDataItemResponse.builder()
                .id(e.getResolutionId()).code(e.getResolutionCode()).name(e.getResolutionName())
                .build();
    }

    private MasterDataItemResponse toItem(AudioFormat e) {
        return MasterDataItemResponse.builder()
                .id(e.getAudioFormatId()).code(e.getFormatCode()).name(e.getFormatName())
                .build();
    }

    private <E extends Enum<E>> List<String> enumNames(E[] values) {
        return Arrays.stream(values).map(Enum::name).toList();
    }
}
