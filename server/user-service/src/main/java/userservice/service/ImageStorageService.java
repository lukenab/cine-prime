package userservice.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

public interface ImageStorageService {
    Map<String, Object> uploadImage(MultipartFile file) throws IOException;
    void deleteImage(String publicId) throws IOException;
}
