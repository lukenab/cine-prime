package movieservice.service;

import java.io.IOException;
import java.util.Map;

import org.springframework.web.multipart.MultipartFile;

public interface ImageStorageService {

    Map uploadImage(String urlImage) throws IOException;

    Map uploadImage(MultipartFile file) throws IOException;

}
