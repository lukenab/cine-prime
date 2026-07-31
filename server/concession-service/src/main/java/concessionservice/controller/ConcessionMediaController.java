package concessionservice.controller;

import concessionservice.dto.ConcessionModels.MediaUploadResponse;
import concessionservice.service.MediaStorageService;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.concurrent.TimeUnit;

@RestController
@RequiredArgsConstructor
public class ConcessionMediaController {
    private final MediaStorageService mediaStorageService;

    @PostMapping(
            value = "/api/admin/concession-media/images",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('BRANCH_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<MediaUploadResponse> upload(@RequestPart("file") MultipartFile file) {
        MediaStorageService.StoredImage stored = mediaStorageService.storeImage(file);
        String url = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/public/concession-media/images/")
                .path(stored.filename())
                .toUriString();
        return ApiResponse.<MediaUploadResponse>builder()
                .result(new MediaUploadResponse(
                        url, stored.filename(), stored.contentType(), stored.size()))
                .build();
    }

    @GetMapping("/api/public/concession-media/images/{filename:.+}")
    public ResponseEntity<Resource> image(@PathVariable String filename) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mediaStorageService.contentType(filename)))
                .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                .body(mediaStorageService.loadImage(filename));
    }
}
