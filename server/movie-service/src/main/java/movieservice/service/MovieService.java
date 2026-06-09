package movieservice.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.logging.ErrorManager;
import java.util.stream.Collectors;

import javax.management.RuntimeErrorException;

import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import movieservice.dto.CountMovieDTO;
import movieservice.dto.InforMovie;
import movieservice.dto.ScheduleDTO;
import movieservice.dto.SeatDTO;
import movieservice.dto.ShowTimeDTO;
import movieservice.dto.TrackingEvent;
import movieservice.dto.TypeDTO;
import movieservice.entity.Movie;
import movieservice.entity.MovieSchedule;
import movieservice.entity.MovieScheduleConnect;
import movieservice.entity.MovieType;
import movieservice.entity.MovieTypeId;
import movieservice.entity.ShowTime;
import movieservice.entity.ScheduleSeat;
import movieservice.entity.Type;
import movieservice.repository.MovieRepository;
import movieservice.repository.MovieScheduleRepository;
import movieservice.repository.MovieTypeRepository;
import movieservice.repository.ScheduleSeatRepository;
import movieservice.repository.SheduleRepository;
import movieservice.repository.ShowTimeRepository;
import movieservice.repository.TypeRepository;
import vn.edu.fpt.commonservice.model.ErrorMessage;
import vn.edu.fpt.commonservice.model.SuccessMessage;

@Service
public class MovieService {
    @Autowired
    private MovieRepository movieRepository;
    @Autowired
    private SheduleRepository scheduleRepository; // Inject Repository của bảng Schedule vào đây
    @Autowired
    private TypeRepository typeRepository; // Inject thêm TypeRepository nếu bảng Type cũng gặp lỗi tương tự

    @Autowired
    private RestClient restClient;
    @Autowired
    private ScheduleSeatRepository scheduleSeatRepository;
    @Autowired
    private MovieScheduleRepository movieScheduleRepository;
    @Autowired
    private ShowTimeRepository showTimeRepository;
    @Autowired
    private MovieTypeRepository movieTypeRepository;
    private static final String REDIS_KEY_PREFIX = "movie:";
    @PersistenceContext
    private EntityManager entityManager;
    public ResponseEntity<?> createMovie(Movie movie) {
        try {
            if (movie == null) {
                return ResponseEntity
                        .ok(new ErrorMessage("400", "Dữ liệu phim không được để trống", "null", HttpStatus.BAD_REQUEST));
            }
            if (movie.getMovieNameVn() == null || movie.getMovieNameVn().trim().isEmpty()) {
                return ResponseEntity
                        .ok(new ErrorMessage("400", "Tên phim tiếng Việt không được để trống", "null", HttpStatus.BAD_REQUEST));
            }
            if (movie.getMovieNameEnglish() == null || movie.getMovieNameEnglish().trim().isEmpty()) {
                return ResponseEntity
                        .ok(new ErrorMessage("400", "Tên phim tiếng Anh không được để trống", "null", HttpStatus.BAD_REQUEST));
            }
            if (movie.getDirector() == null || movie.getDirector().trim().isEmpty()) {
                return ResponseEntity
                        .ok(new ErrorMessage("400", "Tên đạo diễn không được để trống", "null", HttpStatus.BAD_REQUEST));
            }
            if (movie.getActor() == null || movie.getActor().trim().isEmpty()) {
                return ResponseEntity
                        .ok(new ErrorMessage("400", "Danh sách diễn viên không được để trống", "null", HttpStatus.BAD_REQUEST));
            }
            if (movie.getDuration() == null || movie.getDuration() <= 0) {
                return ResponseEntity
                        .ok(new ErrorMessage("400", "Thời lượng phim phải lớn hơn 0 phút", "null", HttpStatus.BAD_REQUEST));
            }
            if (movie.getVersion() == null || movie.getVersion().trim().isEmpty()) {
                return ResponseEntity
                        .ok(new ErrorMessage("400", "Phiên bản phim (2D/3D) không được để trống", "null",
                                HttpStatus.BAD_REQUEST));
            }
            if (movie.getRoomId() == null) {
                return ResponseEntity
                        .ok(new ErrorMessage("400", "Mã phòng chiếu không được để trống", "null", HttpStatus.BAD_REQUEST));
            }
           

            movie.setCreateAt(LocalDateTime.now());

            // 1. Xử lý movie type TRƯỚC KHI SAVE
            if (movie.getMovieTypes() != null) {
                for (MovieType mt : movie.getMovieTypes()) {
                    mt.setMovie(movie); // Gán movie gốc (chưa cần ID, Hibernate sẽ tự map khi sinh ID)
                    if (mt.getId() == null) {
                        mt.setId(new MovieTypeId());
                    }
                    if (mt.getType() != null && mt.getType().getTypeId() != null) {
                        Long typeId = mt.getType().getTypeId();
                        Optional<Type> realType = typeRepository.findById(typeId.intValue());
                        if (realType.isEmpty()) {
                            return ResponseEntity
                                    .ok(new ErrorMessage("404", "Loại phim không tồn tại", "null", HttpStatus.NOT_FOUND));
                        }
                        mt.setType(realType.get());
                    }
                }
            }

            // 2. Xử lý movie schedule TRƯỚC KHI SAVE
            if (movie.getMovieSchedules() != null) {
                LocalDate today = LocalDate.now(); // Lấy ngày hiện tại
                LocalDate minValidDate = today.plusDays(3); // Ngày hợp lệ tối thiểu (ít nhất 3 ngày kể từ hôm nay)

                for (MovieSchedule ms : movie.getMovieSchedules()) {
                    ms.setMovie(movie); // Gán movie gốc

                    if (ms.getId() == null) {
                        ms.setId(new MovieScheduleConnect());
                    }

                    if (ms.getShowTime() != null) {
                        ShowTime schedule = ms.getShowTime();
                        LocalDate showDate = schedule.getShowDate();

                        // --- VALIDATE NGÀY CHIẾU (SHOW DATE) ---
                        if (showDate == null) {
                            return ResponseEntity
                                    .ok(new ErrorMessage("400", "Ngày chiếu không được để trống.", "null",
                                            HttpStatus.BAD_REQUEST));
                        }

                        // 1. Kiểm tra ngày quá khứ
                        if (showDate.isBefore(today)) {
                            return ResponseEntity
                                    .ok(new ErrorMessage("400", "Không được tạo lịch chiếu vào ngày trong quá khứ.", "null",
                                            HttpStatus.BAD_REQUEST));
                        }

                        // 2. Kiểm tra phải cách ít nhất 3 ngày (Tính cả hôm nay, tức là phải từ ngày
                        // [Hôm nay + 3] trở đi)
                        if (showDate.isBefore(minValidDate)) {
                            return ResponseEntity
                                    .ok(new ErrorMessage("400",
                                            "Lịch chiếu phải được tạo trước ít nhất 3 ngày kể từ ngày hiện tại.", "null",
                                            HttpStatus.BAD_REQUEST));
                        }
                        // ----------------------------------------

                        // Gán liên kết ngược
                        schedule.setMovie(movie);

                        LocalTime endTime = schedule.getStartTime().plusMinutes(movie.getDuration());
                        schedule.setEndTime(endTime);

                        // Validate overlap
                        boolean exists = scheduleRepository.existsConflict(
                                movie.getRoomId().longValue(),
                                showDate,
                                schedule.getStartTime(),
                                endTime);

                        if (exists) {
                            return ResponseEntity
                                    .ok(new ErrorMessage("409", "Khung giờ đã tồn tại.", "null", HttpStatus.CONFLICT));
                        }

                        schedule.setRoomId(movie.getRoomId().longValue());

                        // LƯU Ý: Không gọi scheduleRepository.save(schedule) ở đây nữa!
                        // Khi movie được save ở dưới, nhờ CascadeType.ALL, các showTime và
                        // movieSchedule tự động được lưu.
                    }
                }
            }

            // --- BƯỚC CUỐI CÙNG: LƯU TẤT CẢ TRONG MỘT PHÉP TÍNH ---
            // Hibernate sẽ tự động sinh ID cho Movie, sau đó truyền ID đó vào các bảng liên
            // quan theo đúng thứ tự

            Movie savedMovie = movieRepository.save(movie);

            // 4. generate ghế
            if (savedMovie.getMovieSchedules() != null) {
                for (MovieSchedule ms : savedMovie.getMovieSchedules()) {
                    // saveScheduleSeat(ms.getShowTime(), savedMovie.getRoomId());
                }
            }
            return ResponseEntity
                    .ok(new SuccessMessage("200", "Tạo movie thành công", HttpStatus.OK.name(), LocalDate.now()));
        } catch (Exception e) {
            System.out.println(e.getMessage() + " check");
            return ResponseEntity
                    .ok(new ErrorMessage("409", "Lỗi dữ liệu không hợp lệ!!!!.",e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR));
        }
    }

    public ResponseEntity<?> deleteMovieDB(String movieIdClient) {
        try {
            Integer.parseInt(movieIdClient);
        } catch (Exception e) {
            return ResponseEntity
                    .ok(new ErrorMessage("500", "Lỗi dữ liệu vui lòng tải lại trang!!!", "null", HttpStatus.BAD_REQUEST));
        }
        Integer movieId = Integer.parseInt(movieIdClient);
        if (movieRepository.findByMovieId(movieId) == null) {
            return ResponseEntity
                    .ok(new SuccessMessage("404", "Không tìm thấy phù hợp!!!!", HttpStatus.ACCEPTED + "",
                            LocalDate.now()));
        }
        movieRepository.softDeleteMovie(movieId);
        return ResponseEntity
                .ok(new SuccessMessage("200", "Xóa sản phẩm thành công", HttpStatus.ACCEPTED + "", LocalDate.now()));

    }

    // public void saveScheduleSeat(
    //         ShowTime showTime,
    //         Integer idRoom) {

    //     try {

    //         // lấy danh sách ghế từ room-service
    //         List<SeatDTO> seats = roomClient.getRoomSeats(Long.parseLong(idRoom.toString()));

    //         // danh sách ghế của 1 showtime
    //         List<ScheduleSeat> scheduleSeatsList = new ArrayList<>();

    //         for (SeatDTO dto : seats) {

    //             ScheduleSeat scheduleSeat = new ScheduleSeat();

    //             // GÁN SHOWTIME
    //             scheduleSeat.setShowTime(showTime);

    //             // seat id
    //             scheduleSeat.setSeatCode(dto.getSeatId());

    //             // trạng thái
    //             scheduleSeat.setSeatStatus("AVAILABLE");

    //             // thời gian tạo
    //             scheduleSeat.setCreateAt(LocalDateTime.now());

    //             // =========================
    //             // XỬ LÝ GIÁ & LOẠI GHẾ
    //             // =========================

    //             int row = dto.getSeatRow();

    //             String col = dto.getSeatColumn();

    //             // mặc định
    //             String seatType = "RECLINER";

    //             Integer price = 120000;

    //             // NORMAL
    //             if (row == 1
    //                     && ("A".equalsIgnoreCase(col)
    //                             || "F".equalsIgnoreCase(col))) {

    //                 seatType = "NORMAL";

    //                 price = 70000;
    //             }

    //             // VIP
    //             else if (row == 10) {

    //                 seatType = "VIP";

    //                 price = 150000;
    //             }

    //             scheduleSeat.setSeatType(seatType);

    //             scheduleSeat.setPrice(price);

    //             scheduleSeatsList.add(scheduleSeat);
    //         }

    //         // save toàn bộ ghế của 1 showtime
    //         scheduleSeatRepository.saveAll(scheduleSeatsList);

    //     } catch (Exception e) {

    //         e.printStackTrace();

    //         throw new RuntimeException(
    //                 "Lỗi tạo schedule seat: "
    //                         + e.getMessage());
    //     }
    // }

    // public Boolean checkCimenaExist(Long roomId) {
    //     try {
    //         // lấy danh sách ghế từ room-service

    //         List<SeatDTO> seats = roomClient.getRoomSeats(roomId);
    //         if (seats.isEmpty()) {
    //             return false;
    //         }
    //         return true;
    //     } catch (Exception e) {
    //         System.out.println(e.getMessage());
    //         return false;
    //     }
    // }

    public Movie checkBookingValid(Integer movieId, Integer roomId, Integer showTimeId) {
        return movieRepository.checkBookingValid(movieId, roomId, showTimeId);
    }

    public ShowTimeDTO findShowTime(Long roomId, Long movieId, Long timeId) {
        ShowTime showTime = showTimeRepository.findShowTime(roomId, movieId, timeId);
        ShowTimeDTO dto = new ShowTimeDTO();
        dto.setShowTimeId(showTime.getShowTimeId());
        dto.setEndTime(showTime.getEndTime());
        dto.setShowDate(showTime.getShowDate());
        dto.setStartTime(showTime.getStartTime());
        dto.setRoomId(showTime.getRoomId());
        // Chỉ lấy những trường data thuần, không lôi các thuộc tính Proxy theo
        return dto;
    }

    public List<ShowTimeDTO> findShowTimesByLists(List<Long> roomIds, List<Long> movieIds,
            List<Integer> showTimeIds) {
        // 1. Lấy dữ liệu Entity từ Database lên (Chỉ tốn 1 câu lệnh SELECT ... WHERE
        // ... IN)
        List<ShowTime> showTimes = showTimeRepository.findShowTimesByLists(roomIds, movieIds, showTimeIds);

        // 2. Chuyển đổi từ List<ShowTime> (Entity) sang List<ShowTimeDTO> để trả về qua
        // API
        return showTimes.stream().map(st -> {
            ShowTimeDTO dto = new ShowTimeDTO();
            dto.setShowTimeId(st.getShowTimeId());
            dto.setMovieId(st.getMovie().getMovieId());
            dto.setRoomId(st.getRoomId());

            // Ép kiểu Date/Time từ DB sang dạng String giống với DTO hiện tại của bạn
            dto.setShowDate(st.getShowDate()); // Ví dụ: "2026-01-11"
            dto.setEndTime(st.getEndTime()); // Ví dụ: "08:21:00"
            return dto;
        }).collect(Collectors.toList());
    }

    public List<Movie> findAllMovie() {
        return movieRepository.findByIsDeleted(false);
    }

    public ResponseEntity<?> countMovie(String month, String year) {
        try {
            Integer monthInteger = Integer.parseInt(month);
            Integer yearInteger = Integer.parseInt(year);
            CountMovieDTO countMovieDTO = new CountMovieDTO();
            countMovieDTO.setCount(movieRepository.countMoviesByMonthAndYear(monthInteger, yearInteger));
            return ResponseEntity.ok(countMovieDTO);
        } catch (Exception e) {
            return ResponseEntity
                    .ok(new ErrorMessage("404", "Lỗi dữ liệu vui lòng tải lại trang!!!!", "null", HttpStatus.NOT_FOUND));
        }
    }

    public Map<Integer, String> getMovieNamesMap(List<Integer> movieIds) {
        // 1. Kiểm tra nếu danh sách ID rỗng thì trả về Map rỗng ngay
        if (movieIds == null || movieIds.isEmpty()) {
            return Map.of();
        }

        // 2. Gọi DB lấy các phim theo list ID (Integer)
        List<Movie> movies = movieRepository.findAllByMovieIdIn(movieIds);

        // 3. Convert List thành Map<Integer, String> (Key = movieId, Value =
        // movieNameVn)
        Map<Integer, String> movieNamesMap = movies.stream()
                .peek(movie -> System.out
                        .println("--- Đang xu ly phim: ID=" + movie.getMovieId() + ", Ten=" + movie.getMovieNameVn()))
                .collect(Collectors.toMap(
                        Movie::getMovieId,
                        Movie::getMovieNameVn,
                        (existing, replacement) -> {
                            System.out.println("⚠️ Phat hien trung ID: " + existing + " va " + replacement);
                            return existing;
                        }));

        // In kết quả Map cuối cùng sau khi gom xong
        System.out.println("====== KET QUA MAP CUOI CUNG ======");
        movieNamesMap.forEach((id, name) -> System.out.println("Key (ID): " + id + " -> Value (Ten): " + name));

        return movieNamesMap;
    }


    public ResponseEntity<?> getMovie(String movieId, String type) {
        movieRepository.flush();
        entityManager.clear();
        try {
            Integer.parseInt(movieId);
        } catch (Exception e) {
            return ResponseEntity.ok(new ErrorMessage("500", "Lỗi dữ liệu!!!", e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR));
        }
        String key = REDIS_KEY_PREFIX + movieId;

        // ========================================================
        // 1. LOGIC KAFKA TRACKING EVENT (Luôn chạy)
        // ========================================================
        TrackingEvent event = new TrackingEvent();
        event.setEventId(UUID.randomUUID().toString());
        event.setEventType(type);
        event.setUserId("ANONYMOUS");
        event.setSource("movie-service");

        Map<String, Object> props = new HashMap<>();
        props.put("movie_id", movieId);
        event.setProperties(props);

        // ========================================================
        // 2. KIỂM TRA CACHE REDIS (LẤY TỪ REDIS VÀ TỰ MAP DTO KHÔNG VÀO DB)
        // ========================================================
    

        // ========================================================
        // 3. CACHE MISS: VÀO DB LẤY CHI TIẾT (Nếu Redis chưa có)
        // ========================================================
        InforMovie inforMovie = new InforMovie();

        Movie movie = movieRepository.findByMovieId(Integer.parseInt(movieId));
        if (movie == null) {
            throw new RuntimeException("Không tìm thấy movie phù hợp");
        }
        BeanUtils.copyProperties(movie, inforMovie);

        // --- MAP SHOWTIMES TỪ DB (Vòng for gốc của bạn) ---
        List<ScheduleDTO> schedules = new ArrayList<>();
        if (movie.getMovieSchedules() != null) {
            for (MovieSchedule x : movie.getMovieSchedules()) {
                if (x.getShowTime() != null) {
                    ScheduleDTO dto = new ScheduleDTO();
                    dto.setShowTime(x.getShowTime());
                    dto.setMovie(x.getMovie());
                    schedules.add(dto);
                }
            }
        }
        inforMovie.setMovieSchedules(schedules);

        // --- MAP TYPES TỪ DB (Vòng for gốc của bạn) ---
        List<TypeDTO> types = new ArrayList<>();
        if (movie.getMovieTypes() != null) {
            for (MovieType x : movie.getMovieTypes()) {
                if (x.getType() != null) {
                    TypeDTO dto = new TypeDTO();
                    BeanUtils.copyProperties(x.getType(), dto);
                    types.add(dto);
                }
            }
        }
        inforMovie.setTypes(types);
        return ResponseEntity.ok(inforMovie);
    }

    public ResponseEntity<?> update(Movie movie) {
        try {
            // 1. Kiểm tra phim có tồn tại trong DB không
            if (movie.getMovieId() == null) {
                return ResponseEntity
                        .ok(new ErrorMessage("400", "Thiếu ID phim cần cập nhật!!!", "null", HttpStatus.BAD_REQUEST));
            }

            Movie existingMovie = movieRepository.findById(movie.getMovieId()).orElse(null);
            if (existingMovie == null) {
                return ResponseEntity
                        .ok(new ErrorMessage("404", "Không tìm thấy phim phù hợp!!!", "null", HttpStatus.NOT_FOUND));
            }

            // 2. Kiểm tra phòng phim (Giữ nguyên logic của bạn)
            if (movie.getRoomId() == null) {
                return ResponseEntity.ok(new ErrorMessage("404", "Phòng phim không tồn tại!!!", "null", HttpStatus.NOT_FOUND));
            }

            // ==========================================
            // CỐT LÕI: ĐẬP TAN LỖI DUPLICATE KEY TẠI ĐÂY
            // ==========================================
            // 3. Xóa sạch các liên kết movie_type cũ của bộ phim này trong Database trước
            movieTypeRepository.deleteByMovie(existingMovie);

            // Xóa liên kết trong bộ nhớ tạm (Persistence Context) của Hibernate để tránh
            // xung đột dữ liệu cũ - mới
            existingMovie.getMovieTypes().clear();
            movieRepository.saveAndFlush(existingMovie);
            // ==========================================

            if (movie.getCreateAt() == null) {
                movie.setCreateAt(
                        existingMovie.getCreateAt() != null ? existingMovie.getCreateAt() : LocalDateTime.now());
            }

            // 4. Xử lý map lại danh sách movie type MỚI từ Frontend gửi lên
            if (movie.getMovieTypes() != null) {
                for (MovieType mt : movie.getMovieTypes()) {
                    mt.setMovie(movie); // Khôi phục liên kết ngược về đối tượng movie đang chuẩn bị lưu

                    if (mt.getType() != null && mt.getType().getTypeId() != null) {
                        Long typeId = mt.getType().getTypeId();
                        Optional<Type> realType = typeRepository.findById(typeId.intValue());
                        if (realType.isEmpty()) {
                            return ResponseEntity
                                    .ok(new ErrorMessage("404", "Loại phim không tồn tại", "null", HttpStatus.NOT_FOUND));
                        }
                        mt.setType(realType.get());

                        // Khởi tạo và gán giá trị trực tiếp cho Composite Key (MovieTypeId)
                        MovieTypeId id = new MovieTypeId();
                        id.setMovieId(movie.getMovieId());
                        id.setTypeId(typeId);
                        mt.setId(id); // Set ID thủ công để Hibernate biết đích xác khóa chính là gì
                    }
                }
            }

            // 5. Xử lý movie schedule trước khi save (Giữ nguyên logic tạo mới/bổ sung của
            // bạn)
            if (movie.getMovieSchedules() != null) {
                System.out.println("====== [START] KIEM TRA DANH SACH MOVIE SCHEDULES ======");
                System.out.println("Tong so lich chieu nhan duoc: " + movie.getMovieSchedules().size());
                ShowTime showTimeDB = showTimeRepository.findByMovieId(movie.getMovieId());
                int count = 0;
                for (MovieSchedule ms : movie.getMovieSchedules()) {
                    count++;
                    System.out.println("\n--- Dang xu ly phan tu thu: " + count + " ---");

                    ms.setMovie(movie);
                    if (ms.getId() == null) {
                        System.out.println("-> ms.getId() bi null, tien hanh khoi tao moi MovieScheduleConnect.");
                        ms.setId(new MovieScheduleConnect());
                    }

                    if (ms.getShowTime() != null) {
                        ShowTime schedule = ms.getShowTime();

                        // LOG KIEM TRA DU LIEU DAU VAO CUA SHOWTIME
                        System.out.println("-> Du lieu ShowTime nhan duoc:");
                        System.out.println("   + StartTime: " + schedule.getStartTime());
                        System.out.println("   + ShowDate: " + schedule.getShowDate());
                        System.out.println("   + Movie Duration (Thoi luong): " + movie.getDuration());

                        // Check null pointer exception
                        if (schedule.getStartTime() == null || movie.getDuration() == null) {
                            System.out.println(
                                    "X [ALERT] Bo qua suat chieu nay vi thieu du lieu StartTime hoac Duration!");
                            continue;
                        }

                        schedule.setMovie(movie);

                        LocalTime endTime = schedule.getStartTime().plusMinutes(movie.getDuration());
                        schedule.setEndTime(endTime);
                        System.out.println("   + Tinh toan EndTime thanh cong: " + endTime);

                        // LOG TRUOC KHI CHECK CONFLICT TRUNG LICH
                        if (movie.getRoomId() != null && schedule.getShowDate() != null) {
                            System.out
                                    .println("-> Tien hanh goi DB check trung lich (existsConflict) voi cac tham so:");
                            System.out.println("   [RoomId: " + movie.getRoomId() + ", Date: " + schedule.getShowDate()
                                    + ", Start: " + schedule.getStartTime() + ", End: " + endTime + "]");

                            boolean exists = scheduleRepository.existsConflicts(
                                    showTimeDB.getShowTimeId(), // id hiện tại
                                    movie.getRoomId().longValue(),
                                    schedule.getShowDate(),
                                    schedule.getStartTime(),
                                    endTime);

                            System.out.println(
                                    "-> Ket qua check trung lich tu DB: " + (exists ? "BI TRUNG X" : "HOP LE DI TIEP"));

                            if (exists) {
                                System.out.println("X [STOP] Tra ve loi 409 do trung khung gio.");
                                return ResponseEntity
                                        .ok(new ErrorMessage("409", "Khung gio da ton tai.", "null", HttpStatus.CONFLICT));
                            }
                            schedule.setShowDate(ms.getShowTime().getShowDate());
                            schedule.setShowTimeId(showTimeDB.getShowTimeId());
                            System.out.println("check showTimeId: " + showTimeDB.getShowTimeId());
                            schedule.setRoomId(movie.getRoomId().longValue());
                            scheduleRepository.save(schedule);
                        } else {
                            System.out.println(
                                    "! [WARNING] Khong the check trung lich vi RoomId hoac ShowDate dang bi null!");
                        }
                    } else {
                        System.out
                                .println("! Lich chieu nay khong chua doi tuong ShowTime (ms.getShowTime() == null).");
                    }
                }

            } else {
                System.out.println("====== [INFO] movie.getMovieSchedules() bi NULL - Khong co lich de xu ly ======");
            }
            movie.setMovieSchedules(null);
            // 6. Thực hiện update thực thể movie tổng xuống DB
            Movie savedMovie = movieRepository.save(movie);
            // // 7. Đồng bộ sinh ghế và các dịch vụ khác bên lề như code cũ của bạn

            getMovie(movie.getMovieId().toString(), "UPDATE_MOVIE");
            return ResponseEntity.ok(new SuccessMessage("200", "Cập nhật thông tin phim thành công",
                    HttpStatus.OK.name(), LocalDate.now()));
        } catch (Exception e) {
            return ResponseEntity.ok(new ErrorMessage("500", "Lỗi!!!", e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR));
        }
    }


    @Scheduled(fixedRate = 300000) // Khởi chạy 5 phút một lần để kiểm tra
    // @Scheduled(fixedRate = 20000) // Khởi chạy 5 phút một lần để kiểm tra
    @Transactional
    public void autoReleaseSeatsByShowTimeEndJava() {
        LocalDateTime now = LocalDateTime.now();
        System.out.println("\n==================================================");
        System.out.println("[CRON JOB] Bat dau quet ghe qua han suat chieu luc: " + now);

        // 1. Lấy tất cả các ghế đang bị khóa
        // 1. Lấy tất cả các ghế đang bị khóa
        List<ScheduleSeat> unavailableSeats = scheduleSeatRepository.findBySeatStatus("UNAVAILABLE");
        System.out.println("[KIE_M TRA DB] So luong ghe lay duoc tu Repository: "
                + (unavailableSeats != null ? unavailableSeats.size() : "null"));
        // 2. Lọc ra những ghế có suất chiếu đã kết thúc hoàn toàn
        List<ScheduleSeat> expiredSeats = unavailableSeats.stream()
                .filter(seat -> seat.getShowTime() != null
                        && seat.getShowTime().getShowDate() != null
                        && seat.getShowTime().getEndTime() != null)

                // Log 1: In ra tat ca cac ghe Unavailable kiem tra duoc truoc khi loc thoi gian
                .peek(seat -> System.out.println("[DEBUG STREAM] Kiem tra ghe ID: " + seat.getScheduleSeatId()
                        + " | ShowDate: " + seat.getShowTime().getShowDate()
                        + " | EndTime: " + seat.getShowTime().getEndTime()))

                .filter(seat -> {
                    // Gộp ngày chiếu và giờ kết thúc phim thành một mốc LocalDateTime hoàn chỉnh
                    LocalDateTime showEndDateTime = LocalDateTime.of(
                            seat.getShowTime().getShowDate(),
                            seat.getShowTime().getEndTime());

                    // Log 2: So sanh thoi gian hien tai voi thoi gian ket thuc phim
                    boolean isExpired = now.isAfter(showEndDateTime);
                    System.out.println("   -> So sanh: Thoi gian hien tai (" + now
                            + ") CO SAU Thoi gian ket thuc (" + showEndDateTime + ") khong? => KET QUA: " + isExpired);

                    return isExpired;
                })

                // Log 3: Nhun ghe nao thuc su qua han va lot qua duoc vong filter tren se in ra
                // o day
                .peek(seat -> System.out.println(
                        "[DEBUG LOT QUA] >> Ghe ID " + seat.getScheduleSeatId() + " thuc su QUA HAN suat chieu!"))

                .collect(Collectors.toList());

        // Log cuoi cung: Tong hop kết quả sau khi gom ve List
        System.out.println("[DEBUG KET QUA] ---> Tong so ghe qua han tim thay: " + expiredSeats.size());

        // 3. Tiến hành cập nhật trạng thái nếu tìm thấy ghế hết hạn suất chiếu
        if (!expiredSeats.isEmpty()) {
            System.out.println("[HE THONG GHE] Phat hien " + expiredSeats.size()
                    + " ghe qua han suat chieu. Dang tien hanh giai phong...");

            expiredSeats.forEach(seat -> {
                seat.setSeatStatus("AVAILABLE");
                seat.setUpdateAt(now);
            });

            // Lưu ngược lại vào database hàng loạt
            scheduleSeatRepository.saveAll(expiredSeats);
            System.out.println("[HỆ THỐNG GHẾ] Giải phóng ghế theo suất chiếu hoàn tất.");
        }
    }

    @Scheduled(cron = "0 0 0 * * SUN")
    @Transactional // Đảm bảo có Transaction để thực thi các lệnh Update/Delete bên dưới
    // @Scheduled(fixedRate = 5000)
    public void autoCleanUpExpiredMovieData() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime sixMinutesAgo = now.minusMinutes(6);
        // LocalDateTime sixMinutesAgo= now.minusSeconds(5);

        System.out.println("[CRON JOB] Bat dau tien trinh don dep lien hoan luc: " + now);

        // 1. Cập nhật trạng thái phim (Soft Delete)
        int updatedMoviesCount = 0;
        try {
            updatedMoviesCount = movieRepository.autoSoftDeleteExpiredMovies(sixMinutesAgo);
            if (updatedMoviesCount > 0) {
                System.out.println(
                        "[CRON - MOVIE] Da doi thanh cong isDeleted = true cho: " + updatedMoviesCount + " phim.");
            } else {
                System.out.println("[CRON - MOVIE] Khong co phim moi nao bi het han.");
            }
        } catch (Exception e) {
            System.err.println("[CRON ERROR - MOVIE] Loi khi update phim: " + e.getMessage());
        }
        // Lấy danh sách phim đã bị soft-delete (isDeleted = true)
        List<Movie> deletedMovies = movieRepository.findByIsDeletedTrue();

        if (!deletedMovies.isEmpty()) {
            // 1. Trích xuất danh sách Movie ID từ danh sách phim bị xóa
            List<Integer> deletedMovieIds = deletedMovies.stream()
                    .map(Movie::getMovieId)
                    .toList();

            // 2. TẠO QUERY LẤY SHOWTIME ID dựa vào danh sách movie id
            List<Long> expiredShowTimeIds = scheduleRepository.findShowTimeIdsByMovieIds(deletedMovieIds);

            if (!expiredShowTimeIds.isEmpty()) {
                int deletedSchedules = movieScheduleRepository.deleteByMovieIds(deletedMovieIds);
                System.out.println("[CRON] Da xoa " + deletedSchedules + " ban ghi trong bang movie_schedule.");
                // 3. TẠO QUERY XÓA SEAT SCHEDULE dựa vào danh sách showTimeId vừa tìm được
                int deletedSeats = scheduleSeatRepository.deleteSeatsByShowTimeIds(expiredShowTimeIds);
                System.out.println("[CRON - SEAT] Da xoa " + deletedSeats + " ghe ngoi cua cac suat chieu het han.");

                // 4. (Tùy chọn) Nếu muốn xóa luôn cả ShowTime sau khi đã sạch ghế, bạn gọi thêm
                // lệnh này:
                int deletedShowTimes = scheduleRepository.deleteShowTimesByMovieIds(deletedMovieIds);
                System.out.println("[CRON - SHOWTIME] Da xoa " + deletedShowTimes + " suat hieu.");
            } else {
                System.out.println("[CRON - SEAT] Khong co suat chieu (ShowTime) nao ton tai, bo qua xoa ghe.");
            }

        } else {
            System.out.println("[CRON - SHOWTIME] Khong co ghe nao can xoa vi khong co phim bi xoa.");
        }

    }

    @Transactional
    // Cấu hình chạy vào 01:00:00 sáng ngày Chủ Nhật hàng tuần
    @Scheduled(cron = "0 0 1 * * SUN")
    // @Scheduled(fixedRate = 5000)
    public void autoHardDeleteMoviesAfterThreeMonths() {
        LocalDateTime now = LocalDateTime.now();
        // Mốc thời gian: Tạo từ lúc (Hiện tại - 3 tháng) trở về trước
        LocalDateTime threeMonthsAgo = now.minusMonths(12);
        // LocalDateTime threeMonthsAgo = now.minusSeconds(5);
        System.out.println("[CRON - HARD DELETE] Bat dau quet phim het han tu truoc ngay: " + threeMonthsAgo);

        try {
            // Sử dụng Cách 1 (Gọi hàm tự sinh của JPA để tự động ăn theo Cascade xóa sạch
            // bảng con)
            movieRepository.deleteByCreateAtLessThanEqual(threeMonthsAgo);

            System.out.println(
                    "[CRON - HARD DELETE] Da don dep hoan toan cac phim va du lieu lien quan tren 3 thang tuoi.");
        } catch (Exception e) {
            System.err.println("[CRON ERROR - HARD DELETE] Loi khi xoa hoan toan phim: " + e.getMessage());
        }
    }
}
