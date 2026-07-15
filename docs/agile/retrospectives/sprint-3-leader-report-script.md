# Kịch bản báo cáo Sprint 3 dành cho Leader

## Thời lượng đề xuất: khoảng 3 phút

Chào mentor và mọi người.

Ban đầu, Sprint 3 được nhóm lập kế hoạch theo phạm vi của một **academic project**. Mục tiêu chính là hoàn thiện các **functional flows** như tạo và duyệt phim, quản lý lịch chiếu, phòng chiếu và ghế.

Tuy nhiên, sau buổi review tuần trước, mentor yêu cầu nhóm nâng `movie-service` theo hướng **production-oriented**. Điều này có nghĩa là một feature không chỉ cần chạy được **happy path**, mà còn phải bảo đảm **data integrity**, **transactional consistency**, **authorization**, **database migration safety**, **lifecycle correctness** và **automated regression testing**.

Đặc biệt, nhóm phải review và rework lại cả database vì database không chỉ có vai trò lưu dữ liệu. Nó còn phải bảo vệ các **business invariants** thông qua foreign key, unique constraint, check constraint và transaction. Nếu chỉ sửa service nhưng database schema vẫn chưa chặt chẽ thì hệ thống vẫn có thể tạo dữ liệu sai hoặc mất dữ liệu khi xảy ra lỗi.

Sự thay đổi này ảnh hưởng xuyên suốt từ database schema, domain model, repository, service layer, API contract cho đến frontend. Vì vậy, một số phần đã thực hiện trước đó phải được review, refactor và bổ sung migration.

Từ thời điểm đó, nhóm chuyển từ tư duy **feature completion** sang **product-oriented engineering**. Chúng tôi không cố đóng issue chỉ để tăng completion rate. Thay vào đó, nhóm ưu tiên những vấn đề có thể gây mất dữ liệu, sai trạng thái, sai quyền truy cập hoặc ảnh hưởng đến khả năng vận hành lâu dài.

Trong Sprint này, nhóm đã hoàn thiện một số phần quan trọng như:

- TMDB preview ở chế độ **read-only**, không làm thay đổi database;
- thống nhất **mapping pipeline** giữa preview và import;
- phát hiện và xử lý **unmapped genres** thay vì âm thầm bỏ qua dữ liệu;
- bổ sung **movie readiness validation** trước khi chuyển trạng thái;
- hoàn thiện giao diện **pending review** cho admin;
- sinh ghế dựa trên cấu hình từng vùng của phòng;
- xây dựng nền tảng kiểm tra **showtime conflict** và giá theo suất chiếu.

Ngoài việc bổ sung feature, nhóm cũng phát hiện một số vấn đề trong thiết kế cũ như approval status đang gắn quá chặt với exhibition status, API dành cho customer và admin chưa được tách rõ, một số update operation có nguy cơ ghi đè dữ liệu, và migration chưa phải là nguồn quản lý schema duy nhất.

Các issue phát sinh trong Sprint không hoàn toàn là feature mới. Phần lớn là **technical remediation work** được tạo ra sau khi nhóm đánh giá lại mức độ an toàn của hệ thống theo tiêu chuẩn mới.

Tuy nhiên, nhóm chưa hoàn thành toàn bộ Sprint Backlog. Tại thời điểm **feature freeze**, vẫn còn 14 issue ở trạng thái **In Progress**.

Với vai trò leader, tôi ghi nhận nhóm chưa thực hiện **impact assessment** và **scope rebaselining** đủ sớm sau khi quality baseline thay đổi. Chúng tôi vẫn giữ phần lớn commitment ban đầu trong khi chưa điều chỉnh capacity. Đồng thời, số lượng **Work in Progress**, hay WIP, cũng vượt quá khả năng xử lý đồng thời của nhóm.

Đây là điểm tôi chịu trách nhiệm về planning và coordination. Tôi không xem việc mentor thay đổi yêu cầu là lý do để đổ lỗi cho tiến độ. Định hướng mới là cần thiết; vấn đề của nhóm là chưa có một **change-control process** phù hợp để tiếp nhận thay đổi đó.

Trước buổi demo, nhóm đã thực hiện feature freeze để chuyển sang **stabilization**, **regression testing** và **demo rehearsal**. Kết quả kiểm tra gần nhất là frontend production build thành công và `movie-service` đạt 90 trên 91 automated tests. Test còn lại phát hiện lỗi không đồng bộ giữa Java enum và database constraint của loại ảnh phim. Nhóm quyết định giữ lại test và sửa đúng nguyên nhân thay vì bỏ test để tạo kết quả xanh.

Mục tiêu của buổi demo lần này không phải chứng minh toàn bộ hệ thống đã production-ready. Nhóm sẽ tập trung trình diễn một **golden path** ổn định: xem trước hoặc tạo phim, gửi duyệt, admin phê duyệt và kiểm tra khả năng hiển thị theo đúng trạng thái.

Sau buổi demo, nhóm sẽ gom phần còn lại vào **Movie Service Production Readiness Epic** và thực hiện theo **risk-based prioritization**:

- Giai đoạn đầu ưu tiên data integrity, authorization, lifecycle và migration safety.
- Giai đoạn tiếp theo xử lý showtime consistency, concurrency và seat inventory.
- Các phần metadata enrichment như trailer, additional images và production companies sẽ được thực hiện sau khi nền tảng ổn định.

Trong Sprint tiếp theo, nhóm cũng sẽ áp dụng một số process improvements:

- mỗi thành viên chỉ giữ một implementation issue chính tại một thời điểm;
- issue chỉ được đưa vào Sprint khi đạt **Definition of Ready**;
- issue chỉ được đóng khi đạt **Definition of Done**, bao gồm code, migration, testing, documentation và runtime evidence;
- tổ chức **mid-sprint integration checkpoint**;
- thực hiện feature freeze trước demo từ 24 đến 48 giờ;
- phân rõ **technical ownership** cho từng domain thay vì để leader trở thành integration bottleneck.

Bài học lớn nhất của tôi trong vai trò leader là: khi có một **material change** về quality baseline, cần thực hiện impact assessment, re-estimate capacity và rebaseline Sprint Backlog ngay lập tức. Không thể giữ nguyên commitment cũ khi complexity và Definition of Done đã thay đổi.

Vì vậy, tôi đánh giá Sprint 3 là **partial delivery with valuable architectural correction**. Nhóm chưa thể tuyên bố hệ thống đã production-ready, nhưng đã chuyển đúng sang định hướng production-oriented, xác định được technical risks và có roadmap rõ ràng để tiếp tục xây dựng sản phẩm.

Cảm ơn mentor và mọi người.

---

## Thông điệp trọng tâm cần nhấn mạnh

> Nhóm chuyển từ tư duy **feature completion** sang **product-oriented engineering**. Một chức năng không chỉ cần chạy được mà còn phải đúng, an toàn và đủ tin cậy để tiếp tục vận hành.

## Cách diễn đạt nên tránh

- “Mentor yêu cầu sửa quá nhiều nên nhóm không làm kịp.”
- “Thành viên thiếu chủ động nên leader phải làm gần hết.”
- “Hầu hết đã hoàn thành, chỉ còn một vài bug nhỏ.”
- “Hệ thống đã production-ready.”

## Cách diễn đạt phù hợp

- “Quality baseline thay đổi sau Sprint Planning.”
- “Nhóm chưa thực hiện scope rebaselining đủ sớm.”
- “Nhóm ưu tiên data integrity và operational correctness thay vì completion count.”
- “Hệ thống đang được phát triển theo hướng production-oriented nhưng chưa được tuyên bố production-ready.”
