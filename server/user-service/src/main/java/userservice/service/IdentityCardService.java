package userservice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movie.theater.common.exception.AppException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import userservice.dto.ParsedIdentityCard;
import userservice.exception.ErrorCode;

import java.io.IOException;
import java.util.Map;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class IdentityCardService {
    static final String PROVINCE_CODE_FILE = "identity/province-codes.json";

    final ObjectMapper objectMapper;
    Map<String, String> provinceCodes;

    @PostConstruct
    void loadProvinceCodes() throws IOException {
        ClassPathResource resource = new ClassPathResource(PROVINCE_CODE_FILE);
        provinceCodes = objectMapper.readValue(resource.getInputStream(), new TypeReference<>() {});
    }

    public void validate(String identityCard) {
        parse(identityCard);
    }

    public ParsedIdentityCard parse(String identityCard) {
        if (identityCard == null || !identityCard.matches("^[0-9]{12}$")) {
            throw new AppException(ErrorCode.INVALID_INPUT);
        }

        String provinceCode = identityCard.substring(0, 3);
        String provinceName = provinceCodes.get(provinceCode);
        if (provinceName == null) {
            throw new AppException(ErrorCode.INVALID_INPUT);
        }

        int centuryGenderCode = Character.getNumericValue(identityCard.charAt(3));
        int yearInCentury = Integer.parseInt(identityCard.substring(4, 6));
        int centuryStart = resolveCenturyStart(centuryGenderCode);

        return ParsedIdentityCard.builder()
                .provinceCode(provinceCode)
                .provinceName(provinceName)
                .gender(centuryGenderCode % 2 == 0 ? "Male" : "Female")
                .birthYear(centuryStart + yearInCentury)
                .build();
    }

    private int resolveCenturyStart(int centuryGenderCode) {
        return switch (centuryGenderCode) {
            case 0, 1 -> 1900;
            case 2, 3 -> 2000;
            case 4, 5 -> 2100;
            case 6, 7 -> 2200;
            case 8, 9 -> 2300;
            default -> throw new AppException(ErrorCode.INVALID_INPUT);
        };
    }
}
