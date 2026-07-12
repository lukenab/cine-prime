package movieservice.validator;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.Set;

public class ProvinceValidator implements ConstraintValidator<ValidProvince, String> {

    // Khớp với PROVINCES array trong ManageCinemaClusterPage.tsx
    private static final Set<String> ALLOWED_PROVINCES = Set.of(
            "Hà Nội",
            "TP. Hồ Chí Minh",
            "Đà Nẵng",
            "Cần Thơ",
            "Hải Phòng",
            "Biên Hòa",
            "Nha Trang",
            "Huế",
            "Vũng Tàu",
            "Quy Nhơn",
            "Bình Dương",
            "Long An",
            "Đồng Nai",
            "Bà Rịa - Vũng Tàu",
            "Thanh Hóa",
            "Nghệ An",
            "Bình Định",
            "Khánh Hòa",
            "Lâm Đồng",
            "Khác"
    );

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null || value.isBlank()) {
            return false; // @NotBlank đã handle trường hợp này, nhưng guard thêm
        }
        return ALLOWED_PROVINCES.contains(value.trim());
    }
}
