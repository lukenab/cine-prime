package movieservice.service.impl;

import java.io.IOException;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import movieservice.service.ImageStorageService;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CloudinaryImageStorageService
        implements ImageStorageService {

    Cloudinary cloudinary;

    @Override
    public Map uploadImage(String urlImage) throws IOException {

        return cloudinary.uploader().upload(
                urlImage,
                ObjectUtils.emptyMap());
    }
}