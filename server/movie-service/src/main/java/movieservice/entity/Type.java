package movieservice.entity;


import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
@Getter
@Setter
@Entity
@Table(name = "type")
public class Type {
    @Id
    @Column(name = "type_id")
    private Long typeId;

    @Column(name = "type_name", length = 255)
    private String typeName;

    // Mối quan hệ một-nhiều tới bảng trung gian MovieType
    @OneToMany(mappedBy = "type", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<MovieType> movieTypes;
}
