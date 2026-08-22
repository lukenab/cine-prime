package authservice.controller;

import authservice.dto.response.AuditEventResponse;
import authservice.service.AuditEventQueryService;
import lombok.RequiredArgsConstructor;
import movie.theater.common.dto.ApiResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/audit-events")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_SUPER_ADMIN','AUDIT_READ')")
public class AuditEventController {
    private final AuditEventQueryService service;

    @GetMapping
    public ApiResponse<Page<AuditEventResponse>> search(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String actorAccountId,
            @RequestParam(required = false) String targetAccountId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @PageableDefault(size = 50, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC) Pageable pageable) {
        return ApiResponse.<Page<AuditEventResponse>>builder()
                .result(service.search(action, status, actorAccountId, targetAccountId, from, to, null, pageable)).build();
    }

    @GetMapping("/{id}")
    public ApiResponse<AuditEventResponse> detail(@PathVariable String id) {
        return ApiResponse.<AuditEventResponse>builder().result(service.get(id)).build();
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String actorAccountId,
            @RequestParam(required = false) String targetAccountId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to) {
        var events = service.search(action, status, actorAccountId, targetAccountId, from, to, null,
                org.springframework.data.domain.PageRequest.of(0, 10_000,
                        org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt")));
        StringBuilder csv = new StringBuilder("createdAt,action,status,actorAccountId,targetAccountId,ipAddress,message\n");
        events.forEach(item -> csv.append(cell(item.getCreatedAt())).append(',').append(cell(item.getAction()))
                .append(',').append(cell(item.getStatus())).append(',').append(cell(item.getActorAccountId()))
                .append(',').append(cell(item.getTargetAccountId())).append(',').append(cell(item.getIpAddress()))
                .append(',').append(cell(item.getMessage())).append('\n'));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=auth-audit-events.csv")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private String cell(Object value) {
        if (value == null) return "";
        return "\"" + String.valueOf(value).replace("\"", "\"\"").replace("\r", " ").replace("\n", " ") + "\"";
    }
}
