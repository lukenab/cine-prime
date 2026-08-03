package movieservice.service;

import lombok.RequiredArgsConstructor;
import movie.theater.common.exception.AppException;
import movieservice.dto.request.AutoShowtimeGenerationRequest;
import movieservice.dto.request.MovieScreeningVersionSelectionRequest;
import movieservice.dto.response.AutoShowtimeGenerationAcceptedResponse;
import movieservice.dto.response.AutoShowtimeGenerationPolicyResponse;
import movieservice.dto.response.AutoShowtimeIneligibleMovie;
import movieservice.dto.response.AutoShowtimeGenerationRunResponse;
import movieservice.entity.*;
import movieservice.enums.MovieStatus;
import movieservice.enums.CinemaRoomStatus;
import movieservice.enums.ClusterStatus;
import movieservice.enums.LayoutStatus;
import movieservice.enums.ScreeningVersionStatus;
import movieservice.exception.AutoShowtimePreflightException;
import movieservice.exception.MovieErrorCode;
import movieservice.repository.CinemaClusterRepository;
import movieservice.repository.CinemaRoomRepository;
import movieservice.repository.MovieRepository;
import movieservice.repository.MovieScreeningVersionRepository;
import movieservice.repository.RoomLayoutRepository;
import movieservice.repository.SchedulePlanRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.ShowtimeAllocationPolicyRepository;
import movieservice.repository.ShowtimeGenerationSkipRepository;
import movieservice.repository.ShowtimeGenerationRunRepository;
import movieservice.service.autoshowtime.AutoShowtimeCandidateFactory;
import movieservice.service.autoshowtime.AutoShowtimeExecutionResult;
import movieservice.service.autoshowtime.AutoShowtimeRunAcceptedEvent;
import movieservice.service.autoshowtime.AutoShowtimeRunExecutor;
import movieservice.service.autoshowtime.ShowtimeCandidate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;



@Service
@RequiredArgsConstructor
public class AutoShowtimeGenerationService {
    private static final String DEFAULT_POLICY_CODE = "DEFAULT";

    private final ShowtimeAllocationPolicyRepository  policyRepository;
    private final ShowtimeGenerationRunRepository generationRunRepository;
    private final SchedulePlanRepository schedulePlanRepository;
    private final MovieRepository  movieRepository;
    private final MovieScreeningVersionRepository movieScreeningVersionRepository;
    private final CinemaClusterRepository cinemaClusterRepository;
    private final CinemaRoomRepository cinemaRoomRepository;
    private final RoomLayoutRepository roomLayoutRepository;
    private final ShowTimeRepository showTimeRepository;
    private final ShowtimeGenerationSkipRepository showtimeGenerationSkipRepository;
    private final AutoShowtimeCandidateFactory candidateFactory;
    private final AutoShowtimeRunExecutor runExecutor;
    private final ApplicationEventPublisher eventPublisher;

    /// API entry-point: chỉ tạo hoặc lấy lại generation run đã nhận.
    /// Chưa tạo ShowTime ở đây; việc tạo candidate và persist sẽ diễn ra ở execute step sau.
    @Transactional
    public AutoShowtimeGenerationAcceptedResponse submitRun(
            AutoShowtimeGenerationRequest request,
            String requesterBy
    ){
        /// Chỉ dùng policy đang active, không hardcode weight/quota trong Java.
        ShowtimeAllocationPolicy policy = policyRepository
                .findByPolicyCodeAndActiveTrue(DEFAULT_POLICY_CODE)
                .orElseThrow(() -> new AppException(
                        MovieErrorCode.AUTO_SHOWTIME_POLICY_NOT_FOUND
                ));
        /// Kiểm tra ngày request có thuộc planning horizon mà policy cho phép không.
        validateGenerationRange(request, policy);

        /// Rolling replanning (P2) chưa được implement - từ chối rõ ràng thay vì âm thầm chạy
        /// như một run generate bình thường rồi khiến caller tưởng nhầm là đã replan.
        if (Boolean.TRUE.equals(request.replanMode())) {
            throw new AppException(MovieErrorCode.AUTO_SHOWTIME_REPLAN_NOT_SUPPORTED);
        }

        movieservice.enums.OptimizerMode optimizerMode = request.optimizer() == null
                ? policy.getDefaultOptimizerMode() : request.optimizer();
        movieservice.enums.OptimizationScenario scenario = request.scenario() == null
                ? movieservice.enums.OptimizationScenario.BALANCED : request.scenario();

        /// Load entity thật từ DB, đồng thời fail sớm nếu movie hoặc cluster id không tồn tại.
        Set<Movie> movies = loadMovies(request.movieIds());
        Set<CinemaCluster> clusters = loadClusters(request.cinemaClusterIds());

        /// Room không thuộc cluster nào trong scope bị âm thầm bỏ qua thay vì reject request -
        /// đúng theo hợp đồng frontend đã thống nhất (client chỉ hiện room của cluster đang chọn,
        /// nhưng scope có thể đổi giữa lúc load trang và lúc submit).
        Set<CinemaRoom> excludedRooms = resolveExcludedRooms(request.excludedRoomIds(), clusters);
        Set<MovieScreeningVersion> screeningVersionOverrides = resolveScreeningVersionOverrides(
                request.screeningVersionSelections(),
                movies,
                request.startDate(),
                request.endDate()
        );

        /// Cùng policy + date range + movie scope + cluster scope + excluded room scope +
        /// optimizer + scenario sẽ tạo ra cùng một idempotency key. Nhờ đó user gọi lại request
        /// hoặc nhiều node nhận cùng request cũng không tạo run trùng. Excluded rooms PHẢI nằm
        /// trong key: cùng scope nhưng khác room bị loại trừ phải là hai run khác nhau, không
        /// được âm thầm trả về run cũ (đã generate mà chưa áp exclusion mới).
        String idempotencyKey = buildIdempotencyKey(
                policy.getPolicyCode(),
                request.startDate(),
                request.endDate(),
                movies.stream().map(Movie::getMovieId).toList(),
                clusters.stream().map(CinemaCluster::getClusterId).toList(),
                excludedRooms.stream().map(CinemaRoom::getCinemaRoomId).toList(),
                screeningVersionOverrides,
                optimizerMode,
                scenario
        );

        /// Nếu request tương đương đã được nhận trước đó thì trả run cũ.
        /// Nếu chưa có thì tạo run mới với status mặc định ACCEPTED.
        return generationRunRepository.findByIdempotencyKey(idempotencyKey)
                .map(this::toAcceptedResponse)
                .orElseGet(() -> createRun(
                        policy,
                        request,
                        movies,
                        clusters,
                        excludedRooms,
                        screeningVersionOverrides,
                        idempotencyKey,
                        requesterBy,
                        optimizerMode,
                        scenario
                ));
    }

    /// Chuyển excludedRoomIds thô của request thành entity CinemaRoom đã xác thực thuộc
    /// scope cluster của run. Id không tồn tại hoặc thuộc cluster khác bị bỏ qua thay vì
    /// ném lỗi - đây là hành vi hợp đồng, không phải fallback tạm.
    private Set<CinemaRoom> resolveExcludedRooms(List<Long> excludedRoomIds, Set<CinemaCluster> clusters) {
        if (excludedRoomIds == null || excludedRoomIds.isEmpty()) {
            return Set.of();
        }
        Set<Long> clusterIds = clusters.stream()
                .map(CinemaCluster::getClusterId)
                .collect(Collectors.toSet());
        List<Long> distinctIds = excludedRoomIds.stream().distinct().toList();
        return cinemaRoomRepository.findAllById(distinctIds).stream()
                .filter(room -> clusterIds.contains(room.getCluster().getClusterId()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<MovieScreeningVersion> resolveScreeningVersionOverrides(
            List<MovieScreeningVersionSelectionRequest> selections,
            Set<Movie> selectedMovies,
            LocalDate startDate,
            LocalDate endDate
    ) {
        if (selections == null || selections.isEmpty()) {
            return Set.of();
        }

        Set<Long> selectedMovieIds = selectedMovies.stream()
                .map(Movie::getMovieId)
                .collect(Collectors.toSet());
        Set<Long> seenMovieIds = new LinkedHashSet<>();
        Set<Long> requestedVersionIds = new LinkedHashSet<>();

        for (MovieScreeningVersionSelectionRequest selection : selections) {
            if (selection == null
                    || selection.movieId() == null
                    || selection.screeningVersionIds() == null
                    || selection.screeningVersionIds().isEmpty()
                    || !selectedMovieIds.contains(selection.movieId())
                    || !seenMovieIds.add(selection.movieId())) {
                throw new AppException(MovieErrorCode.AUTO_SHOWTIME_INVALID_SCREENING_VERSION_SELECTION);
            }
            requestedVersionIds.addAll(selection.screeningVersionIds());
        }

        Map<Long, MovieScreeningVersion> versionsById = movieScreeningVersionRepository
                .findAllById(requestedVersionIds).stream()
                .collect(Collectors.toMap(MovieScreeningVersion::getScreeningVersionId, Function.identity()));

        if (versionsById.size() != requestedVersionIds.size()) {
            throw new AppException(MovieErrorCode.AUTO_SHOWTIME_INVALID_SCREENING_VERSION_SELECTION);
        }

        Set<MovieScreeningVersion> resolved = new LinkedHashSet<>();
        for (MovieScreeningVersionSelectionRequest selection : selections) {
            Set<Long> distinctVersionIds = new LinkedHashSet<>(selection.screeningVersionIds());
            if (distinctVersionIds.size() != selection.screeningVersionIds().size()) {
                throw new AppException(MovieErrorCode.AUTO_SHOWTIME_INVALID_SCREENING_VERSION_SELECTION);
            }

            for (Long versionId : distinctVersionIds) {
                MovieScreeningVersion version = versionsById.get(versionId);
                boolean overlapsPlanningWindow = (version.getEffectiveFrom() == null
                        || !version.getEffectiveFrom().isAfter(endDate))
                        && (version.getEffectiveTo() == null
                        || !version.getEffectiveTo().isBefore(startDate));
                if (!version.getMovie().getMovieId().equals(selection.movieId())
                        || version.getStatus() != ScreeningVersionStatus.ACTIVE
                        || version.getAudioFormat() == null
                        || !overlapsPlanningWindow) {
                    throw new AppException(MovieErrorCode.AUTO_SHOWTIME_INVALID_SCREENING_VERSION_SELECTION);
                }
                resolved.add(version);
            }
        }
        return resolved;
    }

    private AutoShowtimeGenerationAcceptedResponse createRun(
            ShowtimeAllocationPolicy policy,
            AutoShowtimeGenerationRequest request,
            Set<Movie> movies,
            Set<CinemaCluster> clusters,
            Set<CinemaRoom> excludedRooms,
            Set<MovieScreeningVersion> screeningVersionOverrides,
            String idempotencyKey,
            String requesterBy,
            movieservice.enums.OptimizerMode optimizerMode,
            movieservice.enums.OptimizationScenario scenario
    ){
        /// Run chỉ lưu scope và audit ban đầu. ShowTime chưa được persist ở method này.
        /// Chặn sớm request không có MovieAvailability hợp lệ trong scope.
        /// Admin sẽ nhận 400 thay vì ACCEPTED rồi một phút sau thấy run có ba count = 0.
        /// Preflight dùng chính CandidateFactory để kiểm tra giờ hoạt động, room ACTIVE và format capability.
        /// Bước này chỉ tạo candidate trong bộ nhớ, chưa persist ShowTime hay generation run.
        /// excludedRooms phải được truyền vào preflight, nếu không một movie chỉ khớp room bị loại
        /// trừ sẽ bị coi là eligible nhầm ở bước này rồi mới thất bại thật ở execute step sau.
        validateEligibleCandidates(policy, request, movies, clusters, excludedRooms, screeningVersionOverrides);

        ShowtimeGenerationRun run = ShowtimeGenerationRun.builder()
                .policy(policy)
                .idempotencyKey(idempotencyKey)
                .startDate(request.startDate())
                .endDate(request.endDate())
                .movies(movies)
                .clusters(clusters)
                .excludedRooms(excludedRooms)
                .screeningVersionOverrides(screeningVersionOverrides)
                .requestedBy(requesterBy)
                .optimizerMode(optimizerMode)
                .scenario(scenario)
                .build();

        try {
            /// saveAndFlush ép DB kiểm tra unique idempotency_key ngay trong transaction hiện tại.
            ShowtimeGenerationRun savedRun = generationRunRepository.saveAndFlush(run);
            eventPublisher.publishEvent(new AutoShowtimeRunAcceptedEvent(savedRun.getGenerationRunId()));
            return toAcceptedResponse(savedRun);
        } catch (DataIntegrityViolationException exception){
            /// Hai request có thể cùng lúc thấy key chưa tồn tại rồi cùng insert.
            /// Unique constraint sẽ cho một request thắng; request còn lại đọc lại run đã được tạo.
            return generationRunRepository.findByIdempotencyKey(idempotencyKey)
                    .map(this :: toAcceptedResponse)
                    .orElseThrow(() -> exception);
        }
    }
    /// Ít nhất một tổ hợp movie + cluster + ngày phải có availability OPEN/PLANNED mới được submit run.
    /// Availability hợp lệ vẫn chưa đủ nếu cluster đóng cửa hoặc không có room/format tương thích.
    /// Tạo run giả trong bộ nhớ để CandidateFactory preflight; generationRunId null hợp lệ vì run chưa persist.
    private void validateEligibleCandidates(
            ShowtimeAllocationPolicy policy,
            AutoShowtimeGenerationRequest request,
            Set<Movie> movies,
            Set<CinemaCluster> clusters,
            Set<CinemaRoom> excludedRooms,
            Set<MovieScreeningVersion> screeningVersionOverrides
    ) {
        ShowtimeGenerationRun preflightRun = ShowtimeGenerationRun.builder()
                .policy(policy)
                .startDate(request.startDate())
                .endDate(request.endDate())
                .movies(movies)
                .clusters(clusters)
                .excludedRooms(excludedRooms)
                .screeningVersionOverrides(screeningVersionOverrides)
                .build();

        Set<Long> eligibleMovieIds = candidateFactory.buildRawCandidates(preflightRun).stream()
                .map(ShowtimeCandidate::getMovieId)
                .collect(Collectors.toSet());

        List<AutoShowtimeIneligibleMovie> ineligibleMovies = movies.stream()
                .filter(movie -> !eligibleMovieIds.contains(movie.getMovieId()))
                .map(movie -> new AutoShowtimeIneligibleMovie(
                        movie.getMovieId(),
                        movie.getOriginalTitle()
                ))
                .toList();

        if (!ineligibleMovies.isEmpty()) {
            throw new AutoShowtimePreflightException(
                    MovieErrorCode.AUTO_SHOWTIME_SELECTED_MOVIE_NOT_ELIGIBLE,
                    ineligibleMovies
            );
        }
    }

    /// Cho phép client tự hiển thị khoảng ngày hợp lệ ở bước chọn Planning window, thay vì
    /// chỉ biết được sau khi submit bị INVALID_GENERATION_RANGE.
    @Transactional(readOnly = true)
    public AutoShowtimeGenerationPolicyResponse getActivePolicySummary() {
        ShowtimeAllocationPolicy policy = policyRepository
                .findByPolicyCodeAndActiveTrue(DEFAULT_POLICY_CODE)
                .orElseThrow(() -> new AppException(
                        MovieErrorCode.AUTO_SHOWTIME_POLICY_NOT_FOUND
                ));
        ZoneId zone = ZoneId.of(policy.getBusinessTimezone());
        LocalDate today = LocalDate.now(zone);
        return new AutoShowtimeGenerationPolicyResponse(
                policy.getPolicyCode(),
                policy.getBusinessTimezone(),
                policy.getPlanningHorizonStartDays(),
                policy.getPlanningHorizonEndDays(),
                today.plusDays(policy.getPlanningHorizonStartDays()),
                today.plusDays(policy.getPlanningHorizonEndDays())
        );
    }

    private void validateGenerationRange(
            AutoShowtimeGenerationRequest request,
            ShowtimeAllocationPolicy  policy
    ) {
        /// Không cho phép khoảng ngày ngược, ví dụ startDate sau endDate.
        if(request.startDate().isAfter(request.endDate())){
            throw new AppException(MovieErrorCode.INVALID_GENERATION_RANGE);
        }

        /// Dùng timezone cấu hình của policy để D+3/D+9 không phụ thuộc timezone của server.
        ZoneId zone = ZoneId.of(policy.getBusinessTimezone());
        LocalDate today = LocalDate.now(zone);
        LocalDate earliestAllowed = today.plusDays(
                policy.getPlanningHorizonStartDays()
        );

        /// Mốc cuối là D+end tính từ hôm nay, không phải cộng endDays thêm một lần từ earliestAllowed.
        LocalDate latestAllowed = today.plusDays(
                policy.getPlanningHorizonEndDays()
        );

        /// Cả startDate lẫn endDate đều phải nằm trong planning horizon cho phép.
        if(request.startDate().isBefore(earliestAllowed) || request.endDate().isAfter(latestAllowed)){
            throw new AppException(MovieErrorCode.INVALID_GENERATION_RANGE);
        }
    }

    private Set<Movie> loadMovies(List<Long> movieIds){
        /// distinct loại id bị lặp từ request nhưng LinkedHashSet vẫn giữ thứ tự input ổn định.
        return movieIds.stream()
                .distinct()
                .map(movieId -> {
                    Movie movie = movieRepository.findById(movieId)
                            .orElseThrow(() -> new AppException(MovieErrorCode.MOVIE_NOT_FOUND));

                    /// Movie từ TMDB chỉ được tạo suất sau khi admin đã APPROVED content.
                    if (movie.getStatus() != MovieStatus.APPROVED) {
                        throw new AppException(MovieErrorCode.AUTO_SHOWTIME_MOVIE_NOT_APPROVED);
                    }

                    return movie;
                })
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private Set<CinemaCluster> loadClusters(List<Long> clusterIds){
        /// Cluster không tồn tại thì không tạo run nửa chừng với scope thiếu dữ liệu.
        return clusterIds.stream()
                .distinct()
                .map(clusterId -> {
                    CinemaCluster cluster = cinemaClusterRepository.findById(clusterId)
                            .orElseThrow(() -> new AppException(MovieErrorCode.CLUSTER_NOT_FOUND));
                    if (cluster.getStatus() != ClusterStatus.ACTIVE) {
                        throw new AppException(MovieErrorCode.CLUSTER_NOT_ACTIVE);
                    }
                    boolean hasSchedulableRoom = cinemaRoomRepository.findByCluster_ClusterId(clusterId).stream()
                            .filter(room -> room.getStatus() == CinemaRoomStatus.ACTIVE)
                            .filter(room -> room.getTotalSeatCapacity() != null && room.getTotalSeatCapacity() > 0)
                            .anyMatch(room -> roomLayoutRepository
                                    .findByCinemaRoomCinemaRoomIdAndStatus(room.getCinemaRoomId(), LayoutStatus.ACTIVE)
                                    .filter(layout -> layout.getPersonCapacity() != null && layout.getPersonCapacity() > 0)
                                    .filter(layout -> layout.getSellableUnitCount() != null && layout.getSellableUnitCount() > 0)
                                    .isPresent());
                    if (!hasSchedulableRoom) {
                        throw new AppException(MovieErrorCode.AUTO_SHOWTIME_CLUSTER_NOT_SCHEDULABLE);
                    }
                    return cluster;
                })
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String buildIdempotencyKey(
            String policyCode,
            LocalDate startDate,
            LocalDate endDate,
            List<Long> movieIds,
            List<Long> clusterIds,
            List<Long> excludedRoomIds,
            Set<MovieScreeningVersion> screeningVersionOverrides,
            movieservice.enums.OptimizerMode optimizerMode,
            movieservice.enums.OptimizationScenario scenario
    ){
        /// Chuỗi raw phải chỉ chứa dữ liệu quyết định scope của run.
        /// requesterBy không được đưa vào vì cùng một request từ user khác vẫn phải tái sử dụng run cũ.
        /// optimizerMode/scenario PHẢI nằm trong key: cùng scope nhưng khác optimizer sẽ ra kết quả
        /// khác nhau, nên phải là hai run riêng biệt chứ không được trả về run cũ.
        /// excludedRoomIds cũng phải nằm trong key vì cùng lý do: cùng scope nhưng loại trừ room
        /// khác nhau phải sinh candidate khác nhau.
        String raw = policyCode
                + "|" + startDate
                + "|" + endDate
                + "|" + sortedIds(movieIds)
                + "|" + sortedIds(clusterIds)
                + "|" + sortedIds(excludedRoomIds)
                + "|" + sortedVersionOverrides(screeningVersionOverrides)
                + "|" + optimizerMode
                + "|" + scenario;

        return sha256(raw);
    }

    private String sortedIds(List<Long> ids){
        /// Sort ID trước khi hash để [1, 2] và [2, 1] được xem là cùng một scope.
        return ids.stream()
                .sorted(Comparator.naturalOrder())
                .map(String::valueOf)
                .collect(Collectors.joining(","));
    }

    private String sortedVersionOverrides(Set<MovieScreeningVersion> overrides) {
        if (overrides == null || overrides.isEmpty()) {
            return "AUTO";
        }
        return overrides.stream()
                .sorted(Comparator
                        .comparing((MovieScreeningVersion version) -> version.getMovie().getMovieId())
                        .thenComparing(MovieScreeningVersion::getScreeningVersionId))
                .map(version -> version.getMovie().getMovieId() + ":" + version.getScreeningVersionId())
                .collect(Collectors.joining(","));
    }

    private String sha256(String raw){
        try {
            /// SHA-256 biến scope text thành key cố định 64 ký tự, phù hợp unique index trong database.
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(raw.getBytes());

            StringBuilder result = new StringBuilder();
            /// Chuyển từng byte sang hex để có String có thể lưu/tra cứu trong PostgreSQL.
            for (byte value : hash) {
                result.append(String.format("%02x", value));
            }

            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 must be available", exception);
        }
    }

    private AutoShowtimeGenerationAcceptedResponse toAcceptedResponse(
            ShowtimeGenerationRun run
    ) {
        /// Response 202 chỉ trả thông tin run để client có thể poll kết quả sau này.
        return new AutoShowtimeGenerationAcceptedResponse(
                run.getGenerationRunId(),
                run.getStatus().name(),
                run.getStartDate(),
                run.getEndDate()
        );
    }

    public List<ShowtimeCandidate> buildRawCandidates(Long generationRunId){
        /// CandidateFactory chỉ tạo những combination movie-room-format-time hợp lệ về mặt cơ bản.
        /// Scoring, quota selection và persist ShowTime là các bước riêng sau method này.
        ShowtimeGenerationRun run = generationRunRepository.findByGenerationRunId(generationRunId)
                .orElseThrow(() -> new AppException(MovieErrorCode.GENERATION_RUN_NOT_FOUND));
        return candidateFactory.buildRawCandidates(run);
    }

    /// Entry-point cho scheduler/controller thực thi một run đã được submit trước đó.
    public AutoShowtimeExecutionResult executeRun(Long generationRunId) {
        return runExecutor.execute(generationRunId);
    }

    /// Đọc run đã persist để API hiển thị status và số lượng candidate/create/skip.
    /// Trả kết quả đã persist của một generation run để admin/QA kiểm tra ngay trên Postman.
    /// Chỉ showtime thuộc generation_run_id này mới được trả về, không lẫn các suất tạo thủ công.
    @Transactional(readOnly = true)
    public AutoShowtimeGenerationRunResponse getRun(Long generationRunId, int page, int size) {
        ShowtimeGenerationRun run = generationRunRepository.findByGenerationRunId(generationRunId)
                .orElseThrow(() -> new AppException(MovieErrorCode.GENERATION_RUN_NOT_FOUND));
        SchedulePlan schedulePlan = schedulePlanRepository
                .findByGenerationRun_GenerationRunId(generationRunId)
                .orElse(null);

        /// Giới hạn page size để một request không vô tình tải quá nhiều showtime vào response.
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);

        Page<ShowTime> showtimePage = showTimeRepository
                .findByGenerationRun_GenerationRunIdOrderByShowDateAscStartTimeAsc(
                        generationRunId,
                        PageRequest.of(safePage, safeSize)
                );
        List<ShowTime> allGeneratedShowtimes = showTimeRepository
                .findAllByGenerationRun_GenerationRunIdOrderByShowDateAscStartTimeAsc(generationRunId);
        List<ShowtimeGenerationSkip> skips = showtimeGenerationSkipRepository
                .findByGenerationRun_GenerationRunIdOrderByCreatedAtAsc(generationRunId);

        return new AutoShowtimeGenerationRunResponse(
                run.getGenerationRunId(),
                run.getStatus().name(),
                schedulePlan == null ? null : schedulePlan.getSchedulePlanId(),
                schedulePlan == null ? null : schedulePlan.getStatus().name(),
                run.getStartDate(),
                run.getEndDate(),
                new AutoShowtimeGenerationRunResponse.Summary(
                        run.getCandidateCount(),
                        run.getCreatedCount(),
                        run.getSkippedCount(),
                        run.getSuccessfulPartitionCount(),
                        run.getFailedPartitionCount()
                ),
                buildMovieResults(run.getMovies(), allGeneratedShowtimes, skips),
                new AutoShowtimeGenerationRunResponse.ShowtimePage(
                        showtimePage.getContent().stream().map(this::toGeneratedShowtime).toList(),
                        showtimePage.getNumber(),
                        showtimePage.getSize(),
                        showtimePage.getTotalElements(),
                        showtimePage.getTotalPages()
                ),
                run.getStartedAt(),
                run.getCompletedAt(),
                run.getFailureDetail(),
                run.getOptimizerMode() == null ? null : run.getOptimizerMode().name(),
                run.getScenario() == null ? null : run.getScenario().name(),
                run.getSolverStatus() == null ? null : run.getSolverStatus().name(),
                run.getSolveDurationMillis(),
                run.getObjectiveScore(),
                run.getObjectiveBreakdown(),
                run.getSolverDiagnostics(),
                run.getShadowComparison(),
                run.getExcludedRooms() == null
                        ? List.of()
                        : run.getExcludedRooms().stream().map(CinemaRoom::getCinemaRoomId).toList(),
                buildScreeningVersionSelections(run.getScreeningVersionOverrides())
        );
    }

    private List<AutoShowtimeGenerationRunResponse.ScreeningVersionSelection> buildScreeningVersionSelections(
            Set<MovieScreeningVersion> overrides
    ) {
        if (overrides == null || overrides.isEmpty()) {
            return List.of();
        }
        return overrides.stream()
                .collect(Collectors.groupingBy(version -> version.getMovie().getMovieId()))
                .entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new AutoShowtimeGenerationRunResponse.ScreeningVersionSelection(
                        entry.getKey(),
                        entry.getValue().stream()
                                .map(MovieScreeningVersion::getScreeningVersionId)
                                .sorted()
                                .toList()
                ))
                .toList();
    }

    /// Tính số candidate theo phim từ các bản ghi đã tạo và các candidate bị skip.
    /// Candidate không có bảng riêng, nên created + skipped chính là số candidate đã được engine xử lý cho mỗi phim.
    private List<AutoShowtimeGenerationRunResponse.MovieResult> buildMovieResults(
            Set<Movie> movies,
            List<ShowTime> generatedShowtimes,
            List<ShowtimeGenerationSkip> skips
    ) {
        return movies.stream()
                .sorted(Comparator.comparing(Movie::getMovieId))
                .map(movie -> {
                    int createdCount = (int) generatedShowtimes.stream()
                            .filter(showtime -> showtime.getMovie().getMovieId().equals(movie.getMovieId()))
                            .count();
                    int skippedCount = skips.stream()
                            .filter(skip -> skip.getMovies() != null
                                    && skip.getMovies().getMovieId().equals(movie.getMovieId()))
                            .mapToInt(ShowtimeGenerationSkip::getOccurrenceCount)
                            .sum();

                    return new AutoShowtimeGenerationRunResponse.MovieResult(
                            movie.getMovieId(),
                            movie.getOriginalTitle(),
                            resolveMovieDemandTier(movie),
                            createdCount + skippedCount,
                            createdCount,
                            skippedCount
                    );
                })
                .toList();
    }

    /// Chưa có movie demand tier được lưu riêng trong schema, nên response hiển thị tier suy ra từ score
    /// mà scorer đang dùng: >= 70 HIGH, >= 40 NORMAL, còn lại LOW.
    private String resolveMovieDemandTier(Movie movie) {
        MovieSchedulingProfile profile = movie.getSchedulingProfile();
        BigDecimal score = profile == null
                ? BigDecimal.ZERO
                : profile.getPriorityOverride() != null
                ? profile.getPriorityOverride()
                : profile.getPopularityScore();

        if (score == null || score.compareTo(BigDecimal.valueOf(40)) < 0) {
            return "LOW";
        }
        if (score.compareTo(BigDecimal.valueOf(70)) < 0) {
            return "NORMAL";
        }
        return "HIGH";
    }

    /// Chuyển entity ShowTime sang dữ liệu response có đủ movie, cluster, room và format để QA kiểm tra capability.
    private AutoShowtimeGenerationRunResponse.GeneratedShowtime toGeneratedShowtime(ShowTime showtime) {
        return new AutoShowtimeGenerationRunResponse.GeneratedShowtime(
                showtime.getShowTimeId(),
                showtime.getMovie().getMovieId(),
                showtime.getMovie().getOriginalTitle(),
                showtime.getCinemaRoom().getCluster().getClusterId(),
                showtime.getCinemaRoom().getCinemaRoomId(),
                showtime.getCinemaRoom().getCinemaRoomName(),
                showtime.getFormat() == null ? null : showtime.getFormat().getFormatId(),
                showtime.getFormat() == null ? null : showtime.getFormat().getFormatName(),
                showtime.getScreeningVersion() == null ? null
                        : showtime.getScreeningVersion().getScreeningVersionId(),
                showtime.getLanguageCode(),
                showtime.getSubtitleCode(),
                showtime.getShowDate(),
                showtime.getStartTime(),
                showtime.getEndTime(),
                showtime.getStartAt(),
                showtime.getEndAt(),
                showtime.getStatus().name(),
                showtime.getGenerationReason() == null ? null : showtime.getGenerationReason().name()
        );
    }


}
