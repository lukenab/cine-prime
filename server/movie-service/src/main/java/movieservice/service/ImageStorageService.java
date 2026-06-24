package movieservice.service;

import java.io.IOException;
import java.util.Map;

public interface ImageStorageService {

    Map uploadImage(String urlImage) throws IOException;

}