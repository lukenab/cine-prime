package movieservice.dto;

import java.sql.Date;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class InforMovie {
    private Integer movieId;
    private String movieNameEnglish;

    private String movieNameVn;
    private String actor;

    private String movieProductionCompany;

    private String director;

    private Long duration;

    private String version;

    private String content;

    private String largeImage;

    private String smallImage;

    private Integer roomId;

    private List<ScheduleDTO> movieSchedules;

    private List<TypeDTO> types;
}