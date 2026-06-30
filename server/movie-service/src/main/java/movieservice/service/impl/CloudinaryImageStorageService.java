package movieservice.service.impl;

import java.io.IOException;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

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
                ObjectUtils.asMap("folder", "movie-theater/movies", "resource_type", "image"));
    }

    @Override
    public Map uploadImage(MultipartFile file) throws IOException {
        return cloudinary.uploader().upload(
                file.getBytes(),
                ObjectUtils.asMap(
                        "folder", "movie-theater/movies",
                        "resource_type", "image",
                        "use_filename", true,
                        "unique_filename", true));
    }
}
