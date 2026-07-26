# Tài Liệu Kiến Trúc Thuật Toán & Phân Tích Gap — Auto Showtime Generation

**Trạng thái:** Tài liệu phân tích kiến trúc, thuật toán chấm điểm suất chiếu tự động và thống kê thực trạng (đã hoàn thành 100% API/UI cho các profile) cùng lộ trình các công việc còn lại.  
**Vị trí module:** `server/movie-service/src/main/java/movieservice/service/autoshowtime`  
**Cập nhật lần cuối:** 25/07/2026  

---

## 1. Tổng Quan Kiến Trúc (Architecture Overview)

Tính năng Tạo suất chiếu tự động (**Auto Showtime Generation**) được thiết kế tách biệt rõ ràng giữa hai giai đoạn: **Chấm điểm ứng viên (Candidate Scoring)** và **Lựa chọn / Tối ưu hóa lịch chiếu (Schedule Selection & Optimization)**.

```
       [ Raw Candidates Generation (AutoShowtimeCandidateFactory) ]
                                    │
                                    ▼
       [ Candidate Scoring (AutoShowtimeCandidateScorer) ]
        ├── 1. Movie Demand Score (từ movie_scheduling_profile)
        ├── 2. Cluster Demand Score (từ cinema_cluster_demand_profile)
        ├── 3. Time Slot Demand Score (từ showtime_daypart_policy / peak time)
        ├── 4. Format Priority Score (từ showtime_allocation_format_priority)
        └── 5. Room Capacity Fit Score (ước tính lượt xem & phạt lệch sức chứa)
                                    │
                                    ▼
          [ Schedule Optimizer Resolver (ScheduleOptimizerResolver) ]
            │                       │                       │
       (LEGACY)                 (CP_SAT)            (SHADOW_COMPARE)
            │                       │                       │
            ▼                       ▼                       ▼
 [ Legacy Greedy Selector ]  [ CP-SAT Optimizer ]    [ Chạy song song cả 2 ]
  - Round-robin min coverage  - OR-Tools MILP / CP    - Lưu kết quả Legacy
  - Score-based filling       - Weekly optimization   - Log CP-SAT shadow
```

Hệ thống hỗ trợ 3 chế độ chạy (`OptimizerMode`) được truyền vào từ request hoặc lấy từ cấu hình mặc định của chính sách:
1. **`LEGACY`**: Chỉ sử dụng thuật toán tham lam (Greedy Selector) truyền thống.
2. **`CP_SAT`**: Sử dụng bộ giải thỏa mãn ràng buộc (Constraint Programming) của Google OR-Tools. Nếu bộ giải lỗi hoặc không tìm được lời giải và cờ `optimizer_fallback_to_legacy_on_error = true`, hệ thống tự động fallback về `LEGACY`.
3. **`SHADOW_COMPARE`**: Chạy song song cả `LEGACY` và `CP_SAT` trên cùng tập ứng viên đầu vào. Chỉ kết quả của `LEGACY` được lưu xuống database để sử dụng chính thức, kết quả của `CP_SAT` được lưu vào cột text `shadow_comparison` để admin so sánh, đối chiếu chất lượng và hiệu năng.

---

## 2. Chi Tiết Thuật Toán Chấm Điểm (`AutoShowtimeCandidateScorer.java`)

Thuật toán chấm điểm đóng vai trò chuẩn hóa và tổng hợp độ ưu tiên cho mỗi ứng viên suất chiếu (`ShowtimeCandidate`) hợp lệ (không vi phạm giờ hoạt động, bảo trì, hoặc phòng chiếu bị xóa).

### 2.1. Công thức tổng hợp điểm số (Weighted Linear Combination)

Điểm tổng hợp (`score`) của một candidate là tổ hợp tuyến tính của 5 tiêu chí thành phần, với trọng số ($W$) được cấu hình động trong bảng `showtime_allocation_policy`:

$$\text{Score} = (\text{movieScore} \times W_{\text{movie}}) + (\text{clusterScore} \times W_{\text{cluster}}) + (\text{timeScore} \times W_{\text{time}}) + (\text{formatScore} \times W_{\text{format}}) + (\text{roomCapacityScore} \times W_{\text{room}})$$

Trong cấu hình chính sách mặc định (`DEFAULT`), trọng số được phân bổ như sau:
* $W_{\text{movie}}$ (`movieDemandWeight`) = **0.25** (25%)
* $W_{\text{cluster}}$ (`clusterDemandWeight`) = **0.15** (15%)
* $W_{\text{time}}$ (`timeSlotDemandWeight`) = **0.15** (15%)
* $W_{\text{format}}$ (`formatDemandWeight`) = **0.10** (10%)
* $W_{\text{room}}$ (`roomCapacityWeight`) = **0.05** (5%)
* *(Các trọng số còn lại như `peakDemandWeight` được áp dụng trong quá trình tính điểm thành phần khung giờ).*

---

### 2.2. Chi tiết cách tính 5 điểm số thành phần

#### a. Movie Demand Score (`movieScore`)
* **Nguồn dữ liệu:** Bảng `movie_scheduling_profile` (truy vấn qua `MovieSchedulingProfileRepository.findByMovie_MovieId`).
* **Quy tắc ưu tiên:** Sử dụng điểm ghi đè của admin (`priorityOverride`) nếu có. Nếu không, sử dụng điểm độ phổ biến (`popularityScore`, thang $0 - 100$). Nếu phim không có profile, mặc định bằng $0$.
* **Chuẩn hóa ($0 - 1$):**
  $$\text{movieScore} = \frac{\max(0, \min(100, \text{rawScore}))}{100}$$

#### b. Cinema Cluster Demand Score (`clusterScore`)
* **Nguồn dữ liệu:** Bảng `cinema_cluster_demand_profile` (truy vấn qua `CinemaClusterDemandProfileRepository.findByCluster_ClusterId`), cột `demandScore` (thang $0 - 100$).
* **Chuẩn hóa ($0 - 1$):**
  $$\text{clusterScore} = \frac{\max(0, \min(100, \text{demandScore}))}{100}$$

#### c. Time Slot Demand Score (`timeScore` / `ResolvedDaypart`)
* **Nguồn dữ liệu:** Bảng `showtime_daypart_policy` (danh sách khung giờ `MORNING`, `AFTERNOON`, `EVENING`, `LATE_NIGHT`).
* **Quy tắc khớp giờ:** 
  - Kiểm tra giờ bắt đầu (`startTime`) của candidate có thuộc khoảng `[start_time, end_time)` của khung giờ hay không.
  - Kiểm tra ngày chiếu (`showDate`) rơi vào Ngày thường (Thứ 2 - Thứ 6) hay Cuối tuần (Thứ 7 - CN) để áp dụng `weekdayDemandMultiplier` hoặc `weekendDemandMultiplier`.
* **Fallback khi không khớp Daypart DB:** Nếu không khớp record nào trong bảng, hệ thống kiểm tra giờ chiếu có thuộc khung giờ cao điểm (`peakStartTime` đến `peakEndTime` trong policy) hay không:
  - Nếu là **Peak**: lấy `policy.getPeakDemandWeight()` (mặc định $0.30$).
  - Nếu là **Off-Peak**: gán cố định hệ số **$0.40$**.

#### d. Screening Format Score (`formatScore`)
* **Nguồn dữ liệu:** Bảng `showtime_allocation_format_priority` theo `policyId` và `formatId` (cột `allocationPriority`).
* **Chuẩn hóa ($0 - 1$):** Lấy độ ưu tiên của format chia cho giá trị ưu tiên lớn nhất (`maximumFormatPriority`) hiện có trong policy (ví dụ: IMAX = 100, 4DX = 90, 3D = 70, 2D = 10; `maximumFormatPriority` = 100 $\rightarrow$ điểm 2D = $0.10$, IMAX = $1.00$).
  $$\text{formatScore} = \frac{\text{allocationPriority}}{\text{maximumFormatPriority}}$$

#### e. Room Capacity Fit Score (`roomCapacityScore`) & Expected Attendance
Hệ thống tính toán độ khớp giữa sức chứa phòng chiếu và nhu cầu khán giả qua 2 bước:

**Bước 1: Ước tính lượt xem dự kiến (`resolveExpectedAttendance`)**
* Không phụ thuộc vào phòng chiếu đang xét (để tránh việc phòng nào cũng có vẻ khớp hoàn hảo).
* Công thức tính heuristic:
  $$\text{baseDemand} = (\text{movieScore} \times 0.70) + (\text{clusterScore} \times 0.30)$$
  $$\text{formatMultiplier} = 0.85 + (\text{formatScore} \times 0.15)$$
  $$\text{demandRatio} = \text{clamp}(\text{baseDemand} \times \text{timeScore} \times \text{formatMultiplier}, \; 0.05, \; 1.0)$$
  $$\text{expectedAttendance} = \text{round}(\text{demandRatio} \times \text{maximumClusterCapacity})$$
  *(Với `maximumClusterCapacity` là sức chứa của phòng lớn nhất trong cụm rạp).*

**Bước 2: Tính điểm phạt khớp phòng (`resolveRoomCapacityFitScore`)**
* Phạt tình trạng **tràn khách (overflow)** nặng gấp đôi tình trạng **bỏ trống ghế (empty capacity)**:
  $$\text{overflowDemand} = \max(0, \; \text{expectedAttendance} - \text{roomCapacity})$$
  $$\text{emptyCapacity} = \max(0, \; \text{roomCapacity} - \text{expectedAttendance})$$
  $$\text{penalty} = \frac{\text{overflowDemand} + (\text{emptyCapacity} \times 0.50)}{\text{maximumClusterCapacity}}$$
  $$\text{roomCapacityScore} = \text{clamp}(1.0 - \text{penalty}, \; 0.0, \; 1.0)$$

---

## 3. Chi Tiết 2 Thuật Toán Xếp Lịch (Schedule Optimizers)

### 3.1. Legacy Greedy Selector (`AutoShowtimeCandidateSelector.java`)
Đây là thuật toán tham lam truyền thống, xử lý xếp lịch theo tinh thần "chọn giải pháp tốt nhất cục bộ tại từng bước".

* **Bảo toàn thứ tự sắp xếp:** Danh sách ứng viên sau khi được Scorer xếp hạng giảm dần theo `Score` (và các tiêu chí phụ: `clusterId` $\rightarrow$ `showDate` $\rightarrow$ `startTime` $\rightarrow$ `roomId` $\rightarrow$ `movieId` $\rightarrow$ `formatId`) được đưa vào Selector.
* **Kiểm tra Hard Rule ban đầu:** Bác bỏ ngay lập tức với lý do `MISSING_DEMAND_PROFILE` nếu cụm rạp không có profile trong bảng `cinema_cluster_demand_profile`.
* **Quy trình lựa chọn 2 vòng:**
  1. **Vòng 1 — Đảm bảo chỉ tiêu tối thiểu (Round-Robin Minimum Coverage):**
     - Lặp vòng quanh các nhóm `(movieId, clusterId, showDate)`.
     - Tại mỗi bước, chọn 1 ứng viên có điểm cao nhất của nhóm để xếp vào phòng trống cho đến khi đạt chỉ tiêu tối thiểu `min_daily_shows` (lấy từ demand profile của rạp).
     - Việc chọn mỗi lần 1 suất (round-robin) ngăn không cho phim có điểm số cao nhất độc chiếm toàn bộ các phòng chiếu đẹp trước khi các phim khác được xét tới.
  2. **Vòng 2 — Lấp đầy công suất (Score-Based Extra Allocation):**
     - Xử lý danh sách ứng viên còn lại theo đúng thứ tự điểm số từ cao xuống thấp.
     - Xếp suất chiếu vào phòng nếu thỏa mãn đồng thời các điều kiện:
       - Phim chưa vượt quá `max_daily_shows_per_movie` (số suất tối đa/ngày).
       - Phòng chiếu chưa bị chiếm vượt quá tỷ lệ chia sẻ cho phép (`maximum_room_share` $\times$ tổng số phòng trong rạp).
       - Không bị trùng giờ hoặc vi phạm khoảng thời gian dọn phòng (`cleanupBufferMinutes`).
       - Thỏa mãn thời gian giãn cách tối thiểu giữa 2 suất của cùng 1 phim (`sameMovieStaggerMinutes`).
* **Hạn chế:** Xử lý độc lập từng ngày, không có tầm nhìn toàn cục qua cả tuần (no weekly lookahead).

---

### 3.2. CP-SAT Constraint Programming Optimizer (`CpSatScheduleOptimizer.java`)
Sử dụng bộ giải CP-SAT (Constraint Programming - Satisfiability) của Google OR-Tools, giải quyết bài toán xếp lịch dưới dạng mô hình Quy hoạch nguyên / Thỏa mãn ràng buộc cho **toàn bộ dải thời gian 1 tuần cùng lúc**.

#### a. Mô hình toán học (`CpSatModelBuilder.java`)
* **Biến quyết định ($x$):** Mỗi candidate hợp lệ được gán 1 biến nhị phân $x_{i} \in \{0, 1\}$ (`CandidateVar.presence()`), đại diện cho việc suất chiếu có được chọn hay không.
* **Biến khoảng thời gian (`IntervalVar`):** Mỗi candidate được gán 1 interval (bắt đầu từ `temporalStartAt` — số phút tính từ mốc UTC midnight ngày đầu tiên của run, kéo dài theo thời lượng phim + `cleanupBufferMinutes`), liên kết với biến $x_i$.

#### b. Ràng buộc cứng (Hard Constraints — `CpSatConstraintFactory.java`)
| # | Ràng buộc | Công cụ OR-Tools | Phạm vi |
|---|---|---|---|
| 1 | **Không trùng lịch phòng** (đã bao gồm thời gian dọn dẹp) | `AddNoOverlap` trên tập `IntervalVar` của từng phòng | Từng phòng chiếu (`cinemaRoomId`) |
| 2 | **Giới hạn chia sẻ phòng đồng thời** | `AddCumulative(capacity)` với demand = 1, capacity = $\lfloor \text{maxRoomShare} \times \text{availRooms} \rfloor$ | Từng nhóm `(movie, cluster, date)` |
| 3 | **Số suất tối đa mỗi ngày** | Bất phương trình tuyến tính $\sum x_i \le \text{maxDailyShows}$ | Từng nhóm `(movie, cluster, date)` |
| 4 | **Giãn cách suất chiếu cùng phim** | Pairwise `AddBoolOr([¬x_i, ¬x_j])` nếu 2 suất cùng phim ở 2 phòng khác nhau cách nhau $< \text{sameMovieStaggerMinutes}$ | Từng cặp suất chiếu cùng phim |
| 5 | **Độ phủ tối thiểu theo TUẦN (Weekly Coverage)** | Bất phương trình $\sum_{\text{week}} x_i \ge \min(\text{perDayMin} \times \text{activeDays}, \; \text{totalCandidates})$ | Từng cặp `(movie, cluster)` cho cả tuần |

> [!IMPORTANT]
> **Điểm khác biệt cốt lõi của CP-SAT so với Legacy:** Ràng buộc độ phủ tối thiểu được áp dụng trên **quy mô tuần (Weekly)** thay vì từng ngày. Ví dụ: Với phim nhu cầu thấp có yêu cầu tối thiểu 1 suất/ngày, thay vì ép buộc rạp phải chiếu phim đó mỗi ngày (lãng phí phòng giờ vàng), CP-SAT có thể gom 2 suất tối thiểu của 2 ngày vào cùng 1 ngày sáng sớm, giải phóng hoàn toàn phòng chiếu ngày còn lại cho phim bom tấn, giúp tổng điểm objective cao hơn mà vẫn tuân thủ hợp đồng độ phủ.

#### c. Hàm mục tiêu (`CpSatObjectiveBuilder.java`)
Bộ giải tìm lời giải tối ưu hóa hàm mục tiêu số nguyên:

$$\text{Maximize} \quad \sum_{i} \left( \lfloor \text{score}_i \times 10^6 \rfloor \cdot x_i \right) \;-\; \sum_{j} \left( \lfloor W_{\text{penalty}} \times 10^6 \rfloor \cdot \text{shortfall}_j \right)$$

* Trong đó `shortfall` là biến đại diện cho số suất chiếu bị thiếu hụt so với mục tiêu kỳ vọng mềm (Soft Coverage Target): $\text{shortfall}_j + \sum x_{i} \ge \text{softTarget}_j$.
* Bộ giải chứng minh tối ưu (`OPTIMAL`) hoặc khả thi (`FEASIBLE`). Nếu không tìm được lời giải (`INFEASIBLE` / `MODEL_INVALID`), toàn bộ candidate bị bác bỏ, trả về `NO_USABLE_PARTITION`.

---

### 3.3. Kịch bản vận hành (`ScenarioParameters.java`)
Hệ thống cho phép admin điều chỉnh hành vi bộ giải thông qua 3 kịch bản, tác động trực tiếp vào hệ số chia sẻ phòng và điểm phạt thiếu hụt mục tiêu mềm:

| Kịch bản (`Scenario`) | Ý nghĩa nghiệp vụ | `roomShareMultiplier` | `softTargetMultiplier` | `shortfallPenaltyWeight` |
|---|---|:---:|:---:|:---:|
| **`CONSERVATIVE`** | Thận trọng, phân bổ đều, ưu tiên an toàn độ phủ, phạt nặng khi thiếu chỉ tiêu mềm | $0.80$ | $1.10$ | $0.15$ |
| **`BALANCED`** | Cân bằng giữa độ phủ phim và tối ưu công suất phòng chiếu (Mặc định) | $1.00$ | $1.30$ | $0.25$ |
| **`REVENUE_FOCUSED`** | Tối đa hóa doanh thu, cho phép gom phòng cho phim hot, phạt nhẹ khi thiếu hụt suất phim nhỏ | $1.15$ | $1.60$ | $0.10$ |

---

## 4. Phân Tích Gap Giữa Backend và UI (Backend vs. UI Gap Analysis)

Khảo sát kỹ thuật toàn diện mã nguồn cho thấy: **Toàn bộ tầng Backend API Controller và tầng Frontend UI Admin cho các bảng cấu hình chính sách và profile đều ĐÃ ĐƯỢC HOÀN THIỆN 100%**.

### Bảng tổng hợp Thực trạng Hệ thống (Updated Status)

| Module / Cấu hình | Trạng thái Backend (DB & Entity & API) | Trạng thái UI (Frontend Admin) | Đánh giá Thực tế & Phần việc còn lại |
|---|---|---|---|
| **1. Showtime Allocation Policy** (`showtime_allocation_policy`) | 🟢 **Hoàn thành 100%:** Đầy đủ entity, migration, hỗ trợ weights, solver params, horizon. Có `ShowtimeAllocationPolicyController` hỗ trợ full CRUD & activate. | 🟢 **Hoàn thành 100%:** `AllocationPolicyPanel.tsx` hỗ trợ giao diện quản lý, chỉnh sửa trực quan. | Admin kiểm soát hoàn toàn các trọng số tính điểm tổng hợp và tham số chạy OR-Tools. |
| **2. Format Priorities** (`showtime_allocation_format_priority`) | 🟢 **Hoàn thành 100%:** Bảng lưu priority theo `policy_id` và `format_id`. Được quản lý lồng ghép trong `ShowtimeAllocationPolicyAdminService`. | 🟢 **Hoàn thành 100%:** Tích hợp trực tiếp trong form của `AllocationPolicyPanel.tsx`. | Cho phép ưu tiên định dạng chiếu (IMAX, 4DX, 3D, 2D) theo từng chính sách. |
| **3. Movie Scheduling Profile** (`movie_scheduling_profile`) | 🟢 **Hoàn thành 100% API:** Có DTO (`Create/UpdateMovieRequest` gồm `popularityScore`, `priorityOverride`). `MovieService.upsertSchedulingProfile()` đã lưu xuống DB. | 🟢 **Hoàn thành 100% UI:** Trong `MovieEditorPage.tsx` (dòng 1152-1169) đã có 2 ô input nhập liệu trực quan cho `Popularity Score` và `Priority Override`. | 🟡 **Việc còn lại:** Khi import phim từ TMDB (`TmdbService`), hiện chưa tự động map trường `popularity` từ API TMDB để gán giá trị mặc định cho `popularityScore` (đang mặc định $= 0$). |
| **4. Cinema Cluster Demand Profile** (`cinema_cluster_demand_profile`) | 🟢 **Hoàn thành 100% API:** Đã có `CinemaClusterDemandProfileController.java` hỗ trợ đầy đủ GET, POST, PUT, DELETE theo `clusterId`. | 🟢 **Hoàn thành 100% UI:** Đã có `ClusterDemandProfilePanel.tsx` cho phép Admin chọn `demandTier`, nhập `demandScore`, `minDailyShows`, `maxDailyShowsPerMovie`. | 🟢 **Việc còn lại:** Migration backfill `V33` có thể được giữ làm script seed mặc định lúc khởi tạo cụm rạp mới. |
| **5. Showtime Daypart Policy** (`showtime_daypart_policy`) | 🟢 **Hoàn thành 100% API:** `ShowtimeAllocationPolicyAdminService.replaceDaypartPolicies()` hỗ trợ full CRUD lồng ghép trong `ShowtimeAllocationPolicyRequest/Response`. | 🟢 **Hoàn thành 100% UI:** Trong `AllocationPolicyPanel.tsx` (dòng 330-380) đã có bảng hiển thị và chỉnh sửa trực tiếp danh sách Daypart Multipliers. | Admin thao tác thêm/sửa/xóa dải giờ và hệ số Weekday/Weekend trực tiếp trên UI web. |

---

### 4.1. Giải pháp Tạm thời (Stopgap SQL Migrations) và Sự Khắc Phục
Trước khi các Controller và UI Admin nói trên được xây dựng, dự án đã sử dụng các script SQL Migration (như `V33__backfill_default_cluster_demand_profile.sql` và `V36__add_auto_showtime_generation.sql`) để chèn dữ liệu mặc định tránh lỗi `MISSING_DEMAND_PROFILE`.

Đến thời điểm hiện tại, do hệ thống đã có **đầy đủ API và UI** (`ClusterDemandProfilePanel.tsx`, `MovieEditorPage.tsx`, `AllocationPolicyPanel.tsx`), các script migration cũ đóng vai trò là cơ chế "seed mặc định" (initial fallback backfill) để đảm bảo dữ liệu mới khởi tạo không bị rỗng.

---

## 5. Danh Sách Các Điểm Đang Hard-Code Trong Hệ Thống

Dưới đây là thống kê chi tiết các chỉ số, hệ số heuristic đang được viết cứng (hard-coded) trong mã nguồn Java của module `autoshowtime`, kèm theo vị trí và giải pháp nâng cấp trong tương lai:

### 5.1. Tỷ lệ trọng số ước tính lượt xem (`resolveExpectedAttendance`)
* **Vị trí file:** `AutoShowtimeCandidateScorer.java` (Các dòng `250 - 257`).
* **Chi tiết code:**
  ```java
  BigDecimal baseDemand = movieScore.multiply(BigDecimal.valueOf(0.70))
          .add(clusterScore.multiply(BigDecimal.valueOf(0.30)));
  BigDecimal formatMultiplier = BigDecimal.valueOf(0.85)
          .add(formatScore.multiply(BigDecimal.valueOf(0.15)));
  BigDecimal demandRatio = clamp(baseDemand.multiply(timeScore).multiply(formatMultiplier),
          BigDecimal.valueOf(0.05), BigDecimal.ONE);
  ```
* **Các chỉ số hard-code:**
  - `0.70` (70%) cho Movie Score và `0.30` (30%) cho Cluster Score khi tính nhu cầu cơ sở (`baseDemand`).
  - `0.85` (Base multiplier) và `0.15` (Format bonus weight) cho định dạng chiếu.
  - `0.05` (5% sức chứa phòng) là mức sàn tối thiểu (`clamp min`) cho tỷ lệ lấp đầy dự kiến.
* **Định hướng nâng cấp:** Công thức heuristic mang tính định lượng cố định này được thiết kế như một stopgap. Khi hệ thống có đủ dữ liệu lịch sử bán vé (Ticket Booking History), hàm này sẽ được thay thế bằng việc gọi đến Service dự báo lượng khách (AI/Forecasting Service Snapshot).

### 5.2. Trọng số phạt ghế trống phòng chiếu (`resolveRoomCapacityFitScore`)
* **Vị trí file:** `AutoShowtimeCandidateScorer.java` (Dòng `276`).
* **Chi tiết code:**
  ```java
  BigDecimal penalty = BigDecimal.valueOf(overflowDemand)
          .add(BigDecimal.valueOf(emptyCapacity).multiply(BigDecimal.valueOf(0.50)))
          .divide(BigDecimal.valueOf(maximumClusterCapacity), 4, RoundingMode.HALF_UP);
  ```
* **Chỉ số hard-code:** Hệ số **`0.50`** áp dụng cho `emptyCapacity`.
* **Ý nghĩa:** Hệ thống định nghĩa việc "bỏ trống 1 ghế" chỉ bị phạt thâm hụt điểm bằng 50% so với việc "phòng quá nhỏ dẫn đến mất 1 khách (`overflowDemand` có hệ số 1.0)". Hệ số `0.50` này hiện đang fix cứng trong logic chấm điểm.

### 5.3. Fallback hệ số nhu cầu khung giờ Off-Peak (`resolveDaypart`)
* **Vị trí file:** `AutoShowtimeCandidateScorer.java` (Dòng `200`).
* **Chi tiết code:**
  ```java
  boolean peak = isPeakSlot(candidate.getStartTime(), policy);
  return new ResolvedDaypart(
          peak ? "PEAK" : "OFF_PEAK",
          peak ? policy.getPeakDemandWeight() : BigDecimal.valueOf(0.40),
          peak);
  ```
* **Chỉ số hard-code:** Giá trị **`BigDecimal.valueOf(0.40)`**.
* **Ý nghĩa:** Khi giờ chiếu của ứng viên không nằm trong bất kỳ khung giờ nào được định nghĩa trong bảng `showtime_daypart_policy`, hệ thống sẽ kiểm tra xem có rơi vào khoảng `[peakStartTime, peakEndTime)` hay không. Nếu không phải giờ cao điểm, hệ thống gán cứng hệ số nhu cầu là **0.40** (40% nhu cầu tối đa).

### 5.4. Tham số kịch bản tối ưu hóa (`ScenarioParameters.java`)
* **Vị trí file:** `ScenarioParameters.java` (Dòng `28 - 42`).
* **Chi tiết code:**
  ```java
  public static ScenarioParameters forScenario(ShowtimeGenerationScenario scenario) {
      return switch (scenario) {
          case CONSERVATIVE -> new ScenarioParameters(
                  BigDecimal.valueOf(0.80), BigDecimal.valueOf(1.10), BigDecimal.valueOf(0.15));
          case BALANCED -> new ScenarioParameters(
                  BigDecimal.valueOf(1.00), BigDecimal.valueOf(1.30), BigDecimal.valueOf(0.25));
          case REVENUE_FOCUSED -> new ScenarioParameters(
                  BigDecimal.valueOf(1.15), BigDecimal.valueOf(1.60), BigDecimal.valueOf(0.10));
      };
  }
  ```
* **Chỉ số hard-code:** Toàn bộ bộ 3 tham số `(roomShareMultiplier, softTargetMultiplier, shortfallPenaltyWeight)` cho 3 chế độ chạy đều được khai báo cứng trong Java Record switch-case, thay vì cho phép admin tinh chỉnh hoặc tạo thêm kịch bản mới từ Database.

---

## 6. Checklist Những Việc Cần Làm (Updated Action Plan)

Sau khi rà soát lại toàn bộ mã nguồn, do phần lớn các API và UI Admin đã được thực thi hoàn tất, danh sách công việc thực tế còn lại để tối ưu hóa tính năng được rà soát lại như sau:

### 🚀 Ưu Tiên Cao (P1) — Tích hợp tự động TMDB Popularity
- [ ] **Bổ sung mapping trường `popularity` từ TMDB API (`TmdbMovieDetail.java`):**
  - [ ] Thêm annotation `@JsonProperty("popularity") Double popularity;` vào DTO `TmdbMovieDetail`.
- [ ] **Cập nhật logic import trong `TmdbService.java`:**
  - [ ] Khi tạo đối tượng `CreateMovieRequest` (hoặc `Movie`) từ dữ liệu TMDB, áp dụng công thức chuẩn hóa điểm: `clamp(round(popularity), 0, 100)`.
  - [ ] Gán giá trị này vào field `popularityScore` để khi phim được tạo mới, hệ thống tự động lưu vào bảng `movie_scheduling_profile` thay vì để mặc định là `0`.

### 🛠 Ưu Tiên Trung Bình (P2) — Linh hoạt hóa tham số Hard-code
- [ ] **Linh hoạt hóa `ScenarioParameters.java`:**
  - [ ] Chuyển bộ 3 thông số (`roomShareMultiplier`, `softTargetMultiplier`, `shortfallPenaltyWeight`) từ hard-code enum switch-case sang lưu trong bảng cấu hình DB (hoặc cho phép override từ payload request khi chạy auto-schedule).
- [ ] **Linh hoạt hóa tỷ lệ phạt ghế trống (`emptyCapacity * 0.50`):**
  - [ ] Đưa hệ số `0.50` trong `resolveRoomCapacityFitScore` thành một cột thuộc cấu hình `showtime_allocation_policy` để Admin có thể tùy chỉnh độ khắt khe của việc khớp sức chứa phòng.

### 📈 Dài Hạn (P3) — Analytics từ Lịch sử Bán vé (Ticket Booking Analytics)
- [ ] **Xây dựng Cronjob tự động tính toán độ phổ biến thực tế:**
  - [ ] Viết job định kỳ đọc dữ liệu bán vé từ `booking-service` (lượng vé bán ra `ticket_count`, tỷ lệ lấp đầy `occupancy_rate`, tổng doanh thu).
  - [ ] Tự động cập nhật lại `popularityScore` của phim sau tuần công chiếu đầu tiên (Opening Week), thay thế cho điểm số TMDB ban đầu và loại bỏ heuristic hard-code `70% Movie + 30% Cluster`.
