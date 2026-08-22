package analyticsservice.controller;

import analyticsservice.dto.AdminAnalyticsDailyPointResponse;
import analyticsservice.dto.AdminAnalyticsBranchRankingResponse;
import analyticsservice.dto.AdminAnalyticsSummaryResponse;
import analyticsservice.service.AdminAnalyticsSummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/analytics/admin")
@RequiredArgsConstructor
public class AdminAnalyticsController {
    private final AdminAnalyticsSummaryService summaryService;

    @GetMapping("/summary")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_BRANCH_MANAGER', 'REPORT_READ')")
    public AdminAnalyticsSummaryResponse summary(
            @RequestParam(required = false) Long clusterId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return summaryService.summary(clusterId, from, to);
    }

    @GetMapping("/daily")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_BRANCH_MANAGER', 'REPORT_READ')")
    public List<AdminAnalyticsDailyPointResponse> daily(
            @RequestParam(required = false) Long clusterId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return summaryService.daily(clusterId, from, to);
    }

    @GetMapping("/branch-ranking")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_SUPER_ADMIN', 'ROLE_BRANCH_MANAGER', 'REPORT_READ')")
    public List<AdminAnalyticsBranchRankingResponse> branchRanking(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return summaryService.ranking(from, to);
    }
}
