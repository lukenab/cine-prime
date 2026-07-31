package concessionservice.service;

import movie.theater.common.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import static concessionservice.exception.ConcessionErrorCode.INVALID_REQUEST;
import static concessionservice.exception.ConcessionErrorCode.NOT_FOUND;

@Service
public class MediaStorageService {
    private static final long MAX_IMAGE_SIZE = 5L * 1024L * 1024L;
    private static final Pattern SAFE_FILENAME =
            Pattern.compile("[0-9a-f\\-]{36}\\.(jpg|png|webp)");
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp");

    private final Path imageDirectory;

    public MediaStorageService(
            @Value("${concession.media.directory:./data/concession-media}") String directory) {
        try {
            imageDirectory = Paths.get(directory).toAbsolutePath().normalize();
            Files.createDirectories(imageDirectory);
        } catch (IOException error) {
            throw new IllegalStateException("Concession media directory could not be initialized.", error);
        }
    }

    public StoredImage storeImage(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_IMAGE_SIZE) {
            throw new AppException(INVALID_REQUEST);
        }
        String contentType = file.getContentType() == null
                ? ""
                : file.getContentType().toLowerCase(Locale.ROOT);
        String extension = EXTENSIONS.get(contentType);
        if (extension == null) {
            throw new AppException(INVALID_REQUEST);
        }
        try {
            byte[] bytes = file.getBytes();
            if (!matchesSignature(bytes, contentType)) {
                throw new AppException(INVALID_REQUEST);
            }
            String filename = UUID.randomUUID() + "." + extension;
            Path destination = imageDirectory.resolve(filename).normalize();
            if (!destination.getParent().equals(imageDirectory)) {
                throw new AppException(INVALID_REQUEST);
            }
            Files.write(destination, bytes);
            return new StoredImage(filename, contentType, bytes.length);
        } catch (AppException error) {
            throw error;
        } catch (IOException error) {
            throw new IllegalStateException("Concession image could not be stored.", error);
        }
    }

    public Resource loadImage(String filename) {
        if (filename == null || !SAFE_FILENAME.matcher(filename).matches()) {
            throw new AppException(NOT_FOUND);
        }
        try {
            Path path = imageDirectory.resolve(filename).normalize();
            if (!path.getParent().equals(imageDirectory) || !Files.isRegularFile(path)) {
                throw new AppException(NOT_FOUND);
            }
            Resource resource = new UrlResource(path.toUri());
            if (!resource.isReadable()) {
                throw new AppException(NOT_FOUND);
            }
            return resource;
        } catch (AppException error) {
            throw error;
        } catch (IOException error) {
            throw new AppException(NOT_FOUND);
        }
    }

    public String contentType(String filename) {
        if (filename.endsWith(".png")) return "image/png";
        if (filename.endsWith(".webp")) return "image/webp";
        return "image/jpeg";
    }

    private boolean matchesSignature(byte[] bytes, String contentType) {
        if ("image/jpeg".equals(contentType)) {
            return bytes.length >= 3
                    && (bytes[0] & 0xFF) == 0xFF
                    && (bytes[1] & 0xFF) == 0xD8
                    && (bytes[2] & 0xFF) == 0xFF;
        }
        if ("image/png".equals(contentType)) {
            return bytes.length >= 8
                    && (bytes[0] & 0xFF) == 0x89
                    && bytes[1] == 0x50
                    && bytes[2] == 0x4E
                    && bytes[3] == 0x47
                    && bytes[4] == 0x0D
                    && bytes[5] == 0x0A
                    && bytes[6] == 0x1A
                    && bytes[7] == 0x0A;
        }
        return bytes.length >= 12
                && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P';
    }

    public record StoredImage(String filename, String contentType, long size) {}
}
