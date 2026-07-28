# Đặc tả tạo suất chiếu tự động

## 1. Mục tiêu

Tính năng tạo suất chiếu tự động giúp nhân viên lập lịch:

- chọn khoảng ngày, cụm rạp và danh sách phim;
- sinh một **bản kế hoạch nháp** dựa trên tài nguyên và quy tắc hiện có;
- xem trước, kiểm tra lỗi, yêu cầu chỉnh sửa và duyệt;
- chỉ khi publish mới tạo các suất chiếu vận hành thực tế.

Kết quả tự động không được công khai ngay cho khách hàng. Showtime chỉ xuất hiện
trên trang đặt vé sau khi được publish và chuyển sang `ON_SALE`.

## 2. Các khái niệm chính

### Generation run

Một lần yêu cầu hệ thống tìm lịch, ví dụ:

> Lập lịch cho CinePrime Landmark 81 từ 30/07 đến 05/08 với 10 phim.

### Schedule plan

Bản kế hoạch nháp sinh ra từ một generation run. Kế hoạch có thể ở các trạng thái:

1. `DRAFT`: vừa sinh xong, chưa gửi duyệt;
2. `IN_REVIEW`: đang chờ người có quyền kiểm tra;
3. `CHANGES_REQUESTED`: cần chỉnh lại;
4. `PUBLISHED`: đã tạo showtime thực;
5. `REJECTED` hoặc `CANCELLED`: không tiếp tục sử dụng.

### Candidate slot

Một phương án có thể chọn, gồm:

- phim và phiên bản chiếu;
- cụm rạp và phòng;
- ngày, giờ bắt đầu, giờ kết thúc;
- định dạng chiếu;
- điểm ưu tiên.

Ví dụ: `Moana · bản 2D/Audio EN/Sub VI · Room 3 · 30/07 · 10:30`.

### Hard constraint

Điều kiện không được vi phạm, chẳng hạn:

- suất nằm trong giờ vận hành của cụm rạp;
- không trùng phòng và phải đủ thời gian vệ sinh;
- phòng hỗ trợ đúng định dạng;
- phim, release plan và screening version còn hiệu lực;
- không rơi vào thời gian bảo trì;
- không đè lên suất đã tồn tại.

### Score

Điểm dùng để so sánh các candidate hợp lệ. Điểm có thể dựa trên:

- độ phổ biến của phim;
- dự báo nhu cầu tại cụm rạp;
- khung giờ cao điểm;
- mức phù hợp giữa sức chứa phòng và nhu cầu;
- định dạng trình chiếu ưu tiên.

Điểm cao không cho phép hệ thống phá hard constraint.

## 3. Luồng xử lý

1. Người dùng chọn planning window, cụm rạp và phim.
2. Backend tải policy đang active.
3. Backend tải giờ vận hành, phòng, layout, bảo trì, release plan, screening
   version, demand profile và các showtime đã tồn tại.
4. Hệ thống tạo candidate **chỉ trong giờ vận hành địa phương của từng cụm**.
5. Candidate không hợp lệ bị loại trước khi tối ưu.
6. Bộ tối ưu chọn một tập candidate phù hợp.
7. Hệ thống lưu schedule plan và các slot nháp.
8. Người dùng xem preview và chạy `Revalidate`.
9. Chỉ khi không còn blocker mới được `Submit for review`.
10. Người duyệt publish kế hoạch. Backend kiểm tra lại trong transaction trước
    khi tạo showtime và inventory ghế.
11. Nhân viên mở bán để chuyển showtime sang `ON_SALE`.

## 4. Legacy Greedy và CP-SAT

### Legacy Greedy

Legacy Greedy sắp candidate theo điểm từ cao xuống thấp, sau đó đi lần lượt:

1. lấy candidate có điểm cao nhất;
2. nếu không xung đột thì chọn;
3. nếu xung đột thì bỏ qua;
4. tiếp tục đến hết danh sách.

Ví dụ:

- Room 1 có hai khung giờ;
- phim A có candidate điểm 95 nhưng chiếm gần cả buổi;
- phim B và C có hai candidate điểm 80 và 78, tổng thể phủ được nhiều phim hơn.

Greedy có thể chọn A trước vì 95 là cao nhất, rồi không còn chỗ cho B và C. Kết
quả hợp lệ nhưng chưa chắc tốt nhất cho cả ngày hoặc cả tuần.

Ưu điểm:

- nhanh;
- dễ hiểu và debug;
- phù hợp dữ liệu nhỏ hoặc làm fallback.

Hạn chế:

- quyết định sớm có thể làm mất phương án tốt hơn về sau;
- khó cân bằng đồng thời nhiều phim, nhiều phòng và nhiều ngày;
- dễ đạt tối ưu cục bộ thay vì tối ưu toàn kế hoạch.

### CP-SAT

CP-SAT xem nhiều candidate như một bài toán chung. Với mỗi candidate, hệ thống
có một lựa chọn dạng có/không:

`x[phim, phiên bản, phòng, giờ bắt đầu] = 1` nếu chọn, ngược lại bằng `0`.

Đây là **biến quyết định nhị phân**:

- `x = 1`: phương án được chọn và xuất hiện trong lịch cuối cùng;
- `x = 0`: phương án đã được xem xét nhưng không được chọn.

Ví dụ:

`x[Moana, 3D lồng tiếng Việt, Room 2, 18:00] = 1`

Nghĩa là hệ thống chọn chiếu phim **Moana**, phiên bản **3D lồng tiếng Việt**,
tại **Room 2**, bắt đầu lúc **18:00**.

Nếu biến trên bằng `0`, phương án đó không xuất hiện trong lịch cuối cùng. Điều
này không nhất thiết có nghĩa là phương án bị lỗi; nó có thể không được chọn vì
có phương án khác đạt tổng điểm tốt hơn.

Một phim cần đủ bốn thành phần trong biến quyết định vì:

- cùng một phim có thể có nhiều phiên bản như 2D phụ đề Việt, 2D lồng tiếng
  Việt hoặc 3D;
- mỗi phòng chỉ hỗ trợ một số định dạng nhất định;
- mỗi phòng có nhiều giờ bắt đầu khả dụng;
- solver phải lựa chọn trên từng tổ hợp cụ thể, không chỉ lựa chọn tên phim.

Ví dụ, nếu Moana và Obsession cùng muốn dùng Room 1 lúc 18:00, hệ thống áp dụng
ràng buộc:

`x[Moana, 2D-VI, Room 1, 18:00] + x[Obsession, 2D-EN, Room 1, 18:00] <= 1`

Điều đó có nghĩa là tối đa một trong hai phương án được chọn, nhờ vậy không có
hai suất chiếu sử dụng cùng một phòng trong cùng thời gian. Nếu Room 1 không hỗ
trợ 3D hoặc rạp chưa mở cửa tại thời điểm được xét, biến tương ứng bị buộc bằng
`0`.

#### Cách trình bày khi báo cáo

Không cần đọc máy móc là “x ngoặc phim, phiên bản, phòng, giờ bắt đầu”. Có thể
trình bày:

> Mỗi phương án chiếu được biểu diễn bằng một biến quyết định X có giá trị 0
> hoặc 1. X bằng 1 nghĩa là hệ thống chọn phương án đó vào lịch; X bằng 0 nghĩa
> là không chọn.

Khi cần giải thích chi tiết hơn:

> X của phim, phiên bản chiếu, phòng và giờ bắt đầu là một biến nhị phân. Ví dụ,
> nếu X của Moana, bản 3D lồng tiếng Việt, Room 2 lúc 18 giờ bằng 1 thì lịch cuối
> cùng sẽ có suất chiếu đó.

Có thể tóm tắt ý nghĩa của biến bằng câu hỏi:

> Có nên chiếu phiên bản phim này, tại phòng này, vào giờ này hay không?

Sau đó solver tìm tổ hợp:

- không vi phạm các điều kiện bắt buộc;
- đạt độ phủ tối thiểu;
- tối đa hóa tổng điểm của toàn lịch;
- cân bằng phim, khung giờ, phòng và định dạng.

Với ví dụ trên, CP-SAT có thể nhận ra chọn B và C cho tổng giá trị tốt hơn chọn
riêng A, dù A có điểm cá nhân cao nhất.

Ưu điểm:

- đánh giá toàn bộ tuần thay vì từng quyết định rời rạc;
- phù hợp bài toán nhiều phòng, phim, định dạng và ràng buộc;
- trả về trạng thái rõ ràng như `OPTIMAL`, `FEASIBLE`, `INFEASIBLE` hoặc
  `UNKNOWN`.

Hạn chế:

- cấu hình và debug khó hơn Greedy;
- cần giới hạn số candidate và thời gian giải;
- dữ liệu hoặc constraint sai có thể khiến bài toán không có nghiệm.

Trong dự án:

- CP-SAT nên là optimizer chính;
- Legacy Greedy nên là fallback có log rõ ràng, không âm thầm thay thế;
- plan phải ghi optimizer và trạng thái solver để người duyệt biết kết quả đến
  từ đâu.

## 5. Xử lý suất chiếu đã tồn tại

Showtime đã commit phải được xử lý ở ba lớp:

1. **Trước tối ưu:** tải các showtime chưa bị cancel và loại candidate xung đột.
2. **Khi tính coverage:** showtime đã tồn tại được cộng với slot mới. Nếu phim
   đã có một suất và policy yêu cầu một suất thì không tạo false blocker `0/1`.
3. **Trước publish và tại database:** revalidate và constraint database bảo vệ
   trường hợp một người khác vừa thay đổi lịch sau khi plan được sinh.

Vì vậy, không nên chờ đến lúc sinh xong mới lần đầu thông báo xung đột. Preview
có thể vẫn phát hiện blocker nếu dữ liệu thay đổi trong lúc chạy, nhưng đó là lớp
bảo vệ cuối chứ không phải cơ chế chính.


## 6. Tiền điều kiện trước khi tạo lịch

### Cụm rạp

- cụm rạp ở trạng thái hoạt động;
- có timezone hợp lệ, ví dụ `Asia/Ho_Chi_Minh`;
- có operating hours cho mọi ngày trong planning window;
- ngày mở cửa có `opensAt`, `closesAt` và `closed = false`.

### Phòng và layout

- phòng đang hoạt động và thuộc đúng cụm;
- có active layout;
- layout có ghế bán được;
- phòng có capability tương thích với định dạng sẽ xếp;
- không có maintenance chồng lên planning window.

### Phim

- content đã được duyệt;
- có runtime hợp lệ;
- có age rating, genre và metadata bắt buộc;
- có poster chính;
- có ít nhất một screening version active;
- screening version có presentation format, audio language và subtitle nếu cần;
- có scheduling profile, popularity/demand và giới hạn số suất hợp lệ.

### Release plan và quyền khai thác

- release plan đã được duyệt/mở cho đúng cụm;
- effective window bao phủ ngày cần xếp;
- movie availability cho phép chiếu tại cụm đó;
- định dạng/phiên bản được phép dùng.

### Policy

- policy đang active;
- planning window nằm trong horizon;
- cleanup buffer và slot interval hợp lệ;
- minimum coverage không lớn hơn khả năng thực tế;
- maximum room share và same-movie stagger không tự mâu thuẫn;
- optimizer và solve timeout đã cấu hình.

### Giá

- có Price Book active cho cụm rạp và còn hiệu lực;
- Rate Card phủ ngày thường/cuối tuần, khung giờ và định dạng cần dùng;
- không có hai Rate Card cùng mức ưu tiên gây mơ hồ;
- có hệ số cho từng seat type;
- giá được resolve trước khi materialize `showtime_seat`.

### Lịch hiện hữu

- showtime đã tồn tại được tải thành hard constraint;
- dữ liệu không có overlap cũ;
- plan cũ không được publish lặp lại;
- revalidate gần thời điểm submit/publish.

## 7. Ý nghĩa blocker phổ biến

### `MINIMUM_COVERAGE`

Phim không đạt số suất tối thiểu trong một ngày tại một cụm.

Cách xử lý:

- kiểm tra phim có candidate hợp lệ hay không;
- kiểm tra release plan, screening version và room capability;
- giảm minimum coverage nếu policy đặt cao hơn nguồn lực;
- kiểm tra các suất hiện hữu đã được tính vào coverage.

### `ROOM_OVERLAP`

Hai suất dùng cùng phòng bị chồng giờ hoặc không đủ cleanup buffer.

### `OPERATIONAL_ELIGIBILITY`

Slot vi phạm giờ vận hành, bảo trì, layout hoặc capability của phòng.

### `MAXIMUM_CONCURRENT_ROOM_SHARE`

Một phim đang chiếm quá nhiều phòng cùng lúc tại một cụm.

### `SAME_MOVIE_START_STAGGER`

Các suất cùng phim ở các phòng khác nhau bắt đầu quá gần nhau.

Ví dụ policy yêu cầu các suất cùng phim cách nhau tối thiểu 20 phút:

```text
Room 1 — Moana — 18:00
Room 2 — Moana — 18:10
```

Hai suất chỉ cách nhau 10 phút nên vi phạm quy tắc. Một phương án phù hợp hơn:

```text
Room 1 — Moana — 18:00
Room 2 — Moana — 18:20
Room 3 — Moana — 18:40
```

Mục tiêu của quy tắc này là:

- tạo thêm lựa chọn giờ chiếu cho khách hàng;
- phân bổ khách đều hơn giữa các khung giờ;
- giảm việc nhiều suất bắt đầu hoặc kết thúc cùng lúc;
- giảm tập trung tại sảnh, quầy vé và quầy đồ ăn;
- sử dụng nhiều phòng cho cùng một phim hiệu quả hơn.

Phạm vi kiểm tra mặc định nên là:

`cùng phim + cùng cụm rạp + cùng ngày`

Không nên áp dụng cứng giữa các cụm rạp ở xa nhau. Khi có `MarketArea`, hệ thống
có thể giãn nhẹ giữa các cụm gần nhau, nhưng nên coi đây là mục tiêu tối ưu thay
vì điều kiện bắt buộc.

Trong phần lớn trường hợp, `SAME_MOVIE_START_STAGGER` nên là **soft constraint**:
solver bị trừ điểm khi đặt hai suất quá gần, nhưng kế hoạch vẫn có thể được tạo.
Chỉ nên nâng thành blocker khi chính sách vận hành yêu cầu bắt buộc hoặc khi
việc bắt đầu gần nhau dẫn đến xung đột vận hành khác. Phim có nhu cầu rất cao,
suất công chiếu hoặc sự kiện đặc biệt có thể được cho phép ngoại lệ có kiểm
soát.

Cách xử lý:

- dịch một trong các suất sang khung giờ khác;
- chuyển suất sang phòng khác nếu vẫn đảm bảo khoảng cách bắt đầu;
- điều chỉnh `sameMovieStaggerMinutes` nếu mức hiện tại không phù hợp nguồn lực;
- kiểm tra ngoại lệ dành cho phim nhu cầu cao hoặc sự kiện đặc biệt.

Cách trình bày khi báo cáo:

> Same Movie Start Stagger là quy tắc giãn cách thời điểm bắt đầu của cùng một
> phim giữa các phòng trong một cụm rạp. Mục tiêu là phủ nhiều khung giờ hơn,
> thay vì để nhiều phòng bắt đầu chiếu cùng một phim gần như đồng thời.

### Conflict khi publish

Một showtime khác được tạo sau thời điểm plan sinh, hoặc plan đã được publish
trước đó. Cần reload/revalidate; không nên bỏ qua constraint database.

## 8. Price Book là gì?

Price Book là bộ chính sách giá vé của một cụm rạp trong một khoảng hiệu lực.
Bên trong Price Book có các Rate Card theo:

- ngày thường hoặc cuối tuần;
- khung giờ;
- định dạng 2D, 3D, IMAX, 4DX hoặc ScreenX;
- hệ số ghế Standard, VIP, Couple.

Khi showtime được tạo/publish, hệ thống chọn Rate Card phù hợp và chụp giá cuối
cùng xuống `showtime_seat.price`. Booking dùng giá snapshot này, không tự tính
lại từ Price Book.

Price Book demo của CinePrime Landmark 81:

- code: `L81-REGULAR-2026-H2`;
- hiệu lực: `27/07/2026` đến `31/12/2026`;
- gồm 12 Rate Card cho ngày thường, cuối tuần, khung giờ và định dạng;
- đây là dữ liệu giả lập phục vụ demo, không phải bảng giá chính thức của một
  thương hiệu khác.

Script seed:

`scripts/demo/seed_landmark81_price_book.sql`

## 10. Flow test đề xuất

1. Mở cụm Landmark 81 và xác nhận timezone cùng operating hours.
2. Xác nhận các phòng có active layout và capability.
3. Xác nhận phim đã approved, có screening version và release plan.
4. Mở Price Books, kiểm tra `L81-REGULAR-2026-H2` đang active.
5. Tạo run trong planning window được policy cho phép.
6. Chọn Landmark 81 và danh sách phim.
7. Chạy CP-SAT.
8. Kiểm tra mọi slot nằm trong `08:00–23:00`.
9. Mở Review; giải quyết tất cả blocker.
10. Chạy Revalidate.
11. Submit for review, approve và publish.
12. Kiểm tra showtime được tạo nhưng chưa public khi còn `SCHEDULED`.
13. Mở bán để chuyển sang `ON_SALE`.
14. Từ customer UI: chọn phim/cụm/ngày/suất, tải seat map và kiểm tra giá ghế.

## 11. Definition of Done

- Không sinh hoặc hiển thị slot ngoài operating hours địa phương.
- Existing showtime được dùng khi loại conflict và tính coverage.
- Không submit/publish khi còn blocker.
- Revalidate phát hiện thay đổi xảy ra sau lúc sinh plan.
- Publish có transaction và database constraint chống trùng.
- Giá ghế được materialize từ Price Book.
- Chỉ showtime `ON_SALE` xuất hiện ở customer API.
- Có test timezone UTC+7, coverage với existing showtime, overlap, maintenance,
  capability và publish concurrency.
