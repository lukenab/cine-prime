package concessionservice.service;

import movie.theater.common.exception.AppException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MediaStorageServiceTest {
    @TempDir
    Path directory;

    @Test
    void validPng_isStoredAndCanBeLoaded() throws Exception {
        MediaStorageService service = new MediaStorageService(directory.toString());
        byte[] png = new byte[] {
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x00
        };

        MediaStorageService.StoredImage stored = service.storeImage(
                new MockMultipartFile("file", "popcorn.png", "image/png", png));

        assertThat(stored.filename()).endsWith(".png");
        assertThat(stored.contentType()).isEqualTo("image/png");
        assertThat(service.loadImage(stored.filename()).contentLength()).isEqualTo(png.length);
    }

    @Test
    void spoofedImageContentType_isRejected() {
        MediaStorageService service = new MediaStorageService(directory.toString());

        assertThatThrownBy(() -> service.storeImage(
                new MockMultipartFile(
                        "file", "not-an-image.png", "image/png", "plain text".getBytes())))
                .isInstanceOf(AppException.class);
    }
}
