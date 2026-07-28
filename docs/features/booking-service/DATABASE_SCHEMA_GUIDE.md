# Booking Service Database Schema Guide

## 1. Mục đích

Tài liệu này giải thích canonical database schema của Booking Service được triển khai tại:

* `server/booking-service/src/main/resources/db/migration/V1__canonical_booking_schema.sql`
* `server/booking-service/src/main/java/bookingservice/entity`

Schema được thiết kế từ sáu tài liệu nguồn:

| Mã | Tài liệu |
|---|---|
| `FB` | `FEATURE_BRIEF.md` |
| `BR` | `BUSINESS_RULES.md` |
| `API` | `API_LIST.md` |
| `DEMO` | `DEMO_SCRIPT.md` |
| `SC` | `SCENARIO.md` |
| `PI` | `BOOKING_SERVICE_PRODUCT_ISSUES.md` |

Cột **Nguồn/Yêu cầu** trong các bảng bên dưới dùng các mã trên để chỉ ra lý do cột tồn tại. Cột **Công dụng** luôn gồm hai ý: tên cột có nghĩa gì bằng tiếng Việt và dữ liệu đó được dùng ở bước nghiệp vụ nào.

### 1.1. Nghĩa tiếng Việt của tên các bảng

| Tên tiếng Anh | Nghĩa tiếng Việt | Công dụng ngắn gọn |
|---|---|---|
| `booking` | Đơn đặt vé | Bản ghi trung tâm của một lần khách đặt vé. |
| `booking_item` | Chi tiết đơn đặt vé | Mỗi dòng là một ghế và giá của ghế trong đơn. |
| `inventory_reservation` | Lần giữ chỗ trong kho ghế | Theo dõi việc Movie Service đang giữ, đã bán hay đã nhả ghế. |
| `booking_refund` | Hoàn tiền của đơn đặt vé | Theo dõi yêu cầu và kết quả hoàn tiền do Payment Service xử lý. |
| `booking_cancellation` | Yêu cầu hủy đơn | Theo dõi toàn bộ quy trình hủy vé, nhả ghế, hủy vé điện tử và hoàn tiền. |
| `ticket` | Vé xem phim | Vé được phát hành cho từng ghế sau khi thanh toán và xác nhận ghế thành công. |
| `booking_ticket_pass` | Mã vé dùng chung của đơn | Lưu mã QR đã được bảo vệ để mở danh sách vé của đơn. |
| `ticket_check_in` | Lượt soát vé | Ghi lại mỗi lần nhân viên hoặc cổng quét vé. |
| `booking_operation` | Thao tác trên đơn đặt vé | Ghi bền vững một yêu cầu tạo/hủy/xử lý đơn để thử lại an toàn. |
| `payment_event_inbox` | Hộp nhận sự kiện thanh toán | Nhận thông báo thanh toán/hoàn tiền từ Payment Service và chống xử lý trùng. |
| `compensation_task` | Tác vụ bù trừ | Sửa phần việc còn dang dở khi một dịch vụ đã thành công nhưng dịch vụ khác thất bại. |
| `outbox_event` | Hộp chờ phát sự kiện | Lưu sự kiện cần gửi sang hệ thống khác, để lỗi gửi không làm mất sự kiện. |
| `booking_reconciliation` | Hồ sơ đối soát đơn | Ghi nhận trường hợp trạng thái đơn, tiền, ghế hoặc vé không khớp nhau. |
| `booking_reconciliation_attempt` | Lần xử lý đối soát | Ghi từng lần nhân viên/hệ thống thử kiểm tra hoặc sửa hồ sơ đối soát. |
| `counter_payment` | Biên nhận thu tiền tại quầy | Ghi số tiền nhân viên đã thu khi bán vé trực tiếp tại quầy. |
| `booking_quote` | Báo giá đặt vé | Lưu giá tạm tính trước khi tạo đơn và trước khi giữ ghế. |
| `booking_quote_item` | Chi tiết báo giá | Tách từng ghế, đồ ăn, khuyến mãi hoặc phí trong báo giá. |
| `promotion_reservation` | Lần giữ quyền dùng khuyến mãi | Theo dõi mã/ưu đãi đã được Promotion Service tạm giữ cho đơn. |
| `loyalty_reservation` | Lần giữ điểm thành viên | Theo dõi số điểm User Service đã tạm giữ để thanh toán. |
| `booking_concession_item` | Đồ ăn/uống kèm đơn | Lưu món, giá và tham chiếu giữ hàng của đồ ăn/uống bán kèm vé. |
| `booking_audit_log` | Nhật ký kiểm tra thay đổi đơn | Ghi ai đã làm gì, lý do và trạng thái trước/sau để điều tra. |

### 1.2. Cách đọc các từ thường gặp trong tên cột

Ví dụ: `payment_reference` được đọc là “mã tham chiếu thanh toán”; `created_at` là “được tạo lúc”; `requested_by` là “được yêu cầu bởi”.

| Từ trong tên cột | Nghĩa tiếng Việt | Công dụng thường gặp |
|---|---|---|
| `id` | Mã định danh | Phân biệt duy nhất một bản ghi; thường là khóa chính. |
| `code` | Mã dễ đọc | Cho khách hoặc nhân viên nhập, đọc và tra cứu. |
| `reference` | Mã tham chiếu | Nối nghiệp vụ với dữ liệu ở dịch vụ khác nhưng không tạo khóa ngoại liên cơ sở dữ liệu. |
| `external` | Bên ngoài Booking Service | Cho biết dữ liệu do dịch vụ khác sở hữu. |
| `type` | Loại | Chọn cách xử lý phù hợp cho từng loại dữ liệu/nghiệp vụ. |
| `name` | Tên hiển thị | Hiển thị lịch sử, vé hoặc biên nhận mà không cần gọi lại dịch vụ khác. |
| `status` | Trạng thái | Cho biết bản ghi đang ở bước nào và bước tiếp theo nào được phép chạy. |
| `amount` | Số tiền | Lưu giá trị tiền; luôn phải đi cùng đơn vị tiền tệ. |
| `currency` | Đơn vị tiền tệ | Hiện dùng `VND`; giúp không so sánh hoặc hoàn nhầm hai loại tiền. |
| `date` | Ngày nghiệp vụ | Ngày địa phương của rạp, ví dụ ngày chiếu. |
| `time` | Giờ nghiệp vụ | Giờ địa phương của rạp, ví dụ giờ bắt đầu chiếu. |
| `at` | Thời điểm | Mốc ngày-giờ chính xác mà một việc đã xảy ra hoặc sẽ hết hạn. |
| `by` | Người/hệ thống thực hiện | Dùng để phân quyền và truy vết trách nhiệm. |
| `source` | Nguồn gửi | Xác định dịch vụ hoặc kênh đã tạo dữ liệu/sự kiện. |
| `reason` | Lý do | Giải thích vì sao hủy, hoàn, thu hồi hoặc thao tác thủ công. |
| `count` | Số lần | Đếm số lần đã thử để quyết định thử tiếp hay chuyển xử lý thủ công. |
| `last_error` | Lỗi gần nhất | Giúp vận hành biết lần xử lý gần nhất thất bại vì lý do gì. |
| `expires_at` | Hết hiệu lực lúc | Ngăn dùng dữ liệu tạm như giữ ghế, báo giá hoặc khóa chống trùng sau hạn. |
| `created_at` | Được tạo lúc | Phục vụ sắp xếp lịch sử, kiểm tra và đo thời gian xử lý. |
| `updated_at` | Được cập nhật lúc | Cho biết lần thay đổi gần nhất. |
| `completed_at` | Hoàn tất lúc | Đánh dấu quy trình đã đi đến kết quả cuối cùng. |
| `version` | Số phiên bản bản ghi | Chống hai luồng cùng ghi đè dữ liệu của nhau. |
| `key` | Khóa/mã dùng để tra cứu hoặc chống trùng | Nhận diện một yêu cầu, khóa mã hóa hoặc cách phân nhóm dữ liệu. |
| `hash` | Giá trị băm một chiều | So sánh dữ liệu mà không cần lưu dữ liệu gốc nhạy cảm. |
| `payload` | Nội dung dữ liệu truyền kèm | Lưu phần dữ liệu cần thiết của yêu cầu, lệnh hoặc sự kiện để xử lý lại. |
| `snapshot` | Bản chụp dữ liệu tại một thời điểm | Giữ nguyên tên, giá hoặc trạng thái lịch sử dù dữ liệu nguồn thay đổi sau đó. |
| `before` / `after` | Trước / sau | So sánh thay đổi do nhân viên hoặc hệ thống thực hiện. |
| `request` | Yêu cầu đầu vào | Dữ liệu mà người dùng hoặc dịch vụ gửi đến. |
| `response` | Kết quả trả về | Kết quả đã trả cho bên gọi, có thể dùng lại khi yêu cầu được gửi lặp. |
| `attempt` | Lần thử | Một lần hệ thống hoặc nhân viên thử thực hiện công việc. |

### 1.3. Giải nghĩa thuật ngữ kỹ thuật và chỗ sử dụng

| Thuật ngữ | Nghĩa tiếng Việt | Dùng ở đâu và để làm gì |
|---|---|---|
| **Canonical schema** | Lược đồ cơ sở dữ liệu chuẩn duy nhất | Là cấu trúc chính thức mà migration tạo và entity phải khớp theo. |
| **Aggregate** | Cụm dữ liệu nghiệp vụ được quản lý như một thể thống nhất | `booking` là bản ghi gốc; các chi tiết, vé, hoàn tiền thay đổi theo quy tắc của đơn. |
| **Authoritative** | Nguồn có quyền quyết định cuối cùng | Movie Service quyết định ghế/giá giữ ghế; Payment Service quyết định kết quả tiền; Booking chỉ giữ bản chụp cần thiết. |
| **Immutable** | Không sửa lại dữ liệu lịch sử | Tên phim, ghế, giá và biên nhận được giữ nguyên để lịch sử không thay đổi theo dữ liệu hiện tại. |
| **State machine** | Máy trạng thái/quy tắc chuyển trạng thái | Chỉ cho phép đơn đi qua các bước hợp lệ, ví dụ chờ tiền → xác nhận → đã xác nhận. |
| **Orchestration** | Điều phối nhiều bước giữa nhiều dịch vụ | Booking gọi giữ ghế, chờ tiền, xác nhận ghế, phát vé hoặc hoàn tác theo đúng thứ tự. |
| **Idempotency** | Chống thực hiện lặp | Cùng một khóa và cùng nội dung yêu cầu chỉ tạo tác dụng một lần dù client gửi lại. |
| **Correlation ID** | Mã liên kết toàn bộ một luồng xử lý | Dùng tìm các log, sự kiện và tác vụ thuộc cùng một lần đặt/hủy vé. |
| **Request hash** | Giá trị băm của nội dung yêu cầu | Phát hiện một khóa chống trùng bị tái sử dụng cho nội dung khác. |
| **Optimistic lock** | Khóa lạc quan bằng số phiên bản | Cột `version` ngăn thanh toán, hết hạn và hủy cùng lúc ghi đè nhau. |
| **Inbox** | Hộp nhận sự kiện | Lưu sự kiện trước khi xử lý, chống nhận trùng và cho phép thử lại sau lỗi. |
| **Outbox** | Hộp chờ gửi sự kiện | Lưu sự kiện cùng giao dịch cơ sở dữ liệu rồi gửi lại đến khi thành công. |
| **Compensation** | Bù trừ/hoàn tác phần đã làm | Ví dụ giữ ghế thành công nhưng lưu đơn lỗi thì tạo việc nhả ghế. |
| **Reconciliation** | Đối soát | So sánh Booking với Payment/Movie/Ticket để tìm và sửa trạng thái không khớp. |
| **Ledger** | Sổ cái giao dịch | Lịch sử tiền chính thức thuộc Payment Service, không được tạo trong Booking Service. |
| **Provider** | Nhà cung cấp/cổng thanh toán | Hệ thống bên ngoài mà Payment Service tích hợp; Booking không lưu dữ liệu thẻ/cổng. |
| **Retry** | Thử lại | Worker chạy lại việc tạm lỗi với cùng mã chống trùng để không tạo tác dụng kép. |
| **Worker** | Tiến trình xử lý nền | Xử lý inbox, outbox, hết hạn, bù trừ và đối soát mà không cần người dùng chờ. |
| **Scheduler** | Bộ lập lịch | Định kỳ tìm đơn/giữ chỗ đã hết hạn để xử lý. |
| **Callback/Event** | Thông báo sự kiện từ dịch vụ khác | Payment Service báo thanh toán/hoàn tiền; Booking xác thực rồi đưa vào inbox. |
| **TTL (Time To Live)** | Thời gian còn hiệu lực | Dùng cho giữ ghế, báo giá và dữ liệu chống trùng; hết TTL thì không còn được dùng. |
| **UTC** | Giờ chuẩn quốc tế | Lưu mốc kỹ thuật thống nhất; khi hiển thị sẽ đổi sang múi giờ của rạp. |
| **Timezone** | Múi giờ | Ghép đúng ngày chiếu và giờ chiếu của từng rạp. |
| **Foreign key (FK)** | Khóa ngoại | Bảo đảm bản ghi con trong cùng Booking Service phải có bản ghi cha. |
| **Unique** | Ràng buộc không trùng | Ngăn hai bản ghi có cùng mã booking, mã sự kiện hoặc khóa chống trùng. |
| **Index** | Chỉ mục tra cứu | Tăng tốc tìm đơn theo trạng thái, hạn xử lý hoặc mã tham chiếu. |
| **Nullable** | Được phép chưa có giá trị | Dùng khi dữ liệu chỉ xuất hiện ở bước sau, ví dụ chưa có `paid_at` trước khi trả tiền. |
| **Cascade delete** | Xóa lan truyền bản ghi con | Khi xóa dữ liệu thử nghiệm của bản ghi cha thì bản ghi con liên quan cũng được xóa; không thay cho quy trình hủy nghiệp vụ. |
| **Raw/Plaintext** | Dữ liệu gốc/chưa mã hóa | Không lưu token QR, token giữ ghế hoặc bí mật dưới dạng đọc trực tiếp. |
| **Ciphertext** | Dữ liệu đã mã hóa | Chỉ đọc lại được khi có khóa hợp lệ; dùng cho QR pass cần trả lại cho chủ vé. |
| **Scope** | Phạm vi nhận diện/phân quyền | Tách khóa chống trùng và quyền thao tác theo tài khoản, nhân viên, cổng hoặc dịch vụ. |
| **Terminal state** | Trạng thái kết thúc | Thành công hoặc thất bại cuối cùng, không cần tự động chuyển bước tiếp. |
| **Manual review** | Cần người kiểm tra thủ công | Dùng khi hệ thống không thể tự quyết định an toàn sau nhiều lần thử. |
| **Audit** | Kiểm tra/truy vết | Ghi ai làm gì, lúc nào, lý do và dữ liệu trước/sau. |
| **PII** | Thông tin nhận dạng cá nhân | Phải loại khỏi log/sự kiện nếu không thật sự cần cho nghiệp vụ. |

### 1.4. Nghĩa các trạng thái thường gặp

| Trạng thái tiếng Anh | Nghĩa tiếng Việt |
|---|---|
| `PENDING`, `PENDING_PAYMENT` | Đang chờ xử lý / đang chờ thanh toán. |
| `PROCESSING`, `IN_PROGRESS` | Hệ thống đang xử lý. |
| `SUCCEEDED`, `COMPLETED`, `CONFIRMED`, `SOLD` | Thành công / hoàn tất / đã xác nhận / ghế đã bán. |
| `FAILED`, `FAILED_RETRYABLE` | Thất bại / thất bại nhưng có thể thử lại. |
| `FAILED_TERMINAL` | Thất bại cuối cùng, không tự thử lại. |
| `UNKNOWN` | Chưa xác định chắc chắn; phải truy vấn hoặc đối soát, không được đoán là thất bại. |
| `CANCEL_REQUESTED`, `CANCELLED` | Đã yêu cầu hủy / đã hủy xong. |
| `EXPIRED` | Đã hết hạn. |
| `HELD`, `RESERVED` | Đã tạm giữ. |
| `RELEASE_PENDING`, `RELEASED` | Đang chờ nhả / đã nhả tài nguyên. |
| `CONFIRM_PENDING` | Đã có điều kiện xác nhận nhưng còn chờ bước xác nhận hoàn tất. |
| `VALID`, `USED`, `REVOKED` | Vé còn hợp lệ / đã sử dụng / đã bị thu hồi. |
| `OPEN`, `CLOSED`, `RESOLVED` | Đang mở / đã đóng / đã giải quyết. |
| `MANUAL_REVIEW`, `BLOCKED` | Cần người kiểm tra / đang bị chặn. |
| `QUEUED` | Đã xếp hàng chờ tiến trình nền xử lý. |
| `PUBLISHED`, `DEAD_LETTER` | Đã phát sự kiện / chuyển sang hàng lỗi cần xử lý riêng. |

## 2. Nguyên tắc sở hữu dữ liệu

* Booking Service sở hữu đơn đặt vé, bản chụp giao dịch, quy tắc chuyển trạng thái, vé, cơ chế chống xử lý lặp, hộp nhận/phát sự kiện, hủy đơn, bù trừ và đối soát.
* Movie Service sở hữu kho ghế theo suất chiếu, giá giữ ghế có quyền quyết định cuối cùng, thời hạn giữ ghế và trạng thái `AVAILABLE` (còn trống), `RESERVED` (đang giữ), `SOLD` (đã bán). Booking chỉ lưu mã tham chiếu bên ngoài, token nội bộ, hạn sử dụng và bản chụp; không có bảng `seat_lock` (khóa ghế).
* Payment Service sở hữu sổ cái thanh toán/hoàn tiền và tích hợp cổng thanh toán. Booking không có bảng giao dịch thanh toán; chỉ lưu `payment_reference` (mã tham chiếu thanh toán), bản chụp trạng thái, sự kiện trong hộp nhận và trạng thái điều phối hoàn tiền.
* User Service sở hữu số dư điểm thành viên; Promotion Service sở hữu luật và hạn mức khuyến mãi; dịch vụ đồ ăn/uống sở hữu tồn kho. Booking chỉ lưu mã tham chiếu lần giữ và bản chụp không thay đổi.
* Mốc thời gian kỹ thuật dùng `TIMESTAMPTZ`/`OffsetDateTime` (ngày-giờ có kèm múi giờ); ngày và giờ suất chiếu được chụp riêng để hiển thị đúng nghiệp vụ.

## 3. Quan hệ tổng quát

```text
booking
 ├── booking_item ── ticket ── ticket_check_in
 ├── inventory_reservation
 ├── booking_ticket_pass
 ├── booking_operation
 ├── booking_cancellation ── booking_refund
 ├── payment_event_inbox
 ├── compensation_task
 ├── outbox_event
 ├── booking_reconciliation ── booking_reconciliation_attempt
 ├── counter_payment
 ├── promotion_reservation
 ├── loyalty_reservation
 ├── booking_concession_item
 └── booking_audit_log

booking_quote ── booking_quote_item
```

Không có foreign key sang database của Movie, Payment, User hoặc Promotion Service.

---

## 4. `booking`

### Công dụng

Đây là bảng gốc của một đơn đặt vé. Bảng lưu chủ sở hữu đơn, bản chụp thông tin suất chiếu không bị thay đổi theo dữ liệu nguồn, tổng tiền và từng nhóm trạng thái độc lập. Bảng được dùng khi tạo đơn, chờ/nhận kết quả thanh toán, xử lý hết hạn, xem lịch sử, hủy đơn và đối soát sai lệch (`FB` mục 3–7; `BR` mục 3–8; `SC-01`, `SC-12`–`SC-39`, `SC-47`–`SC-55`; `PI BK-P0-00`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `booking_id` | Mã định danh duy nhất của đơn đặt vé. Mã được tạo trước khi gọi Movie Service giữ ghế, để mọi yêu cầu giữ/nhả ghế và sự kiện sau đó cùng tham chiếu đúng một đơn. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | `FB` mục 3; `BR` Booking Creation; `SC-01`; `PI BK-P0-01/02` |
| `booking_code` | Mã ngắn để khách hàng/nhân viên tra cứu, in biên nhận và hỗ trợ tại quầy. Ví dụ: `booking_code = "BK-20260726-8F3A"`: khách đọc mã này cho nhân viên để tra cứu đơn. | `FB` Main Entity Fields; `API` employee query; `SC-50`; `PI BK-P1-03A` |
| `booking_type` | Loại kênh đặt vé: `ONLINE` là khách tự đặt trực tuyến, `COUNTER` là nhân viên bán tại quầy. Hệ thống dựa vào cột này để kiểm tra đúng quyền, quy trình thu tiền và nội dung nhật ký. Ví dụ: khách đặt trên ứng dụng lưu `ONLINE`; nhân viên thu tiền mặt và in vé tại rạp lưu `COUNTER`. | `FB` Employee Operations; `SC-52`; `PI BK-P1-03B` |
| `account_id` | Mã tài khoản chủ đơn lấy từ thông tin đăng nhập JWT. Dùng để kiểm tra người xem/hủy có sở hữu đơn không, lấy lịch sử và giới hạn số lần giữ ghế đang hoạt động; không phải khóa ngoại sang cơ sở dữ liệu User Service. Ví dụ: `account_id = "acc_1024"`: tài khoản `acc_1024` chỉ được xem hoặc hủy đơn của chính mình. | `BR` Request/Customer Read Rules; `SC-01`, `SC-47`–`SC-49` |
| `member_id` | Mã thành viên được chụp lại nếu có, nhằm tương thích dữ liệu cũ hoặc liên kết nghiệp vụ điểm thưởng. Booking Service không sở hữu hay sửa hồ sơ thành viên. Ví dụ: `member_id = "mem_889"`: đơn được liên kết với thành viên `mem_889`; khách vãng lai có thể để trống. | `FB` Ownership; `PI BK-P2-01B` |
| `showtime_id` | Mã suất chiếu dạng số do Movie Service quản lý. Booking dùng mã này khi yêu cầu giữ ghế, hiển thị lịch sử và đối chiếu xem ghế của đúng suất đã được bán chưa. Ví dụ: `showtime_id = 20260726193001` là suất chiếu ngày 26/07 lúc 19:30. | `BR` Inventory Rules; `API` Movie contract; `SC-01`, `SC-50` |
| `movie_id` | Mã phim dạng số tại thời điểm mua do Movie Service cấp. Chỉ là mã tham chiếu, không tạo khóa ngoại sang cơ sở dữ liệu Movie Service. Ví dụ: `movie_id = 101` tham chiếu phim số 101 ở Movie Service. | `BR` snapshot rule; `SC-48`; `PI BK-P0-00/02` |
| `movie_name` | Tên phim được chụp tại lúc đặt vé. Nhờ vậy lịch sử và vé vẫn hiện tên cũ nếu danh mục phim về sau bị sửa hoặc xóa. Ví dụ: `movie_name = "Avengers: Endgame"`: lịch sử vẫn giữ tên này nếu danh mục phim đổi sau đó. | `BR` Pricing/Customer Read; `SC-01`, `SC-48` |
| `cluster_id` | Mã cụm rạp dạng số do Movie Service cấp. Dùng để kiểm tra nhân viên, cổng soát vé và máy bán vé có thuộc đúng cụm rạp của đơn hay không. Ví dụ: `cluster_id = 12` đại diện cụm CGV Vincom Thủ Đức; chỉ nhân viên/cổng thuộc cụm 12 được thao tác. | `BR` Employee/Security Rules; `SC-45`, `SC-50`–`SC-53` |
| `cluster_name` | Tên cụm rạp được chụp lúc đặt vé để hiển thị lịch sử và biên nhận mà không cần gọi lại Movie Service. Ví dụ: `cluster_name = "CGV Vincom Thủ Đức"`: tên được in trên vé và biên nhận. | `FB` snapshot; `SC-01`, `SC-48` |
| `cinema_room_id` | Mã phòng chiếu dạng số do Movie Service cấp. Dùng truy vết đơn thuộc phòng nào và đối soát khi thông tin suất chiếu/ghế không khớp. Ví dụ: `cinema_room_id = 5` là phòng chiếu số 5 trong dữ liệu Movie Service. | `BR` Inventory snapshot; `PI BK-P0-00/02` |
| `cinema_room_name` | Tên phòng chiếu được chụp lúc đặt vé để hiển thị trong chi tiết đơn, vé và biên nhận. Ví dụ: `cinema_room_name = "Cinema 5"`: khách nhìn thấy phòng này trên vé. | `API` create response; `SC-01`, `SC-48` |
| `show_date` | Ngày chiếu theo múi giờ của rạp được chụp lúc đặt vé. Dùng chia lịch sử sắp chiếu/đã chiếu và kiểm tra còn được phép hủy hay không. Ví dụ: `show_date = 2026-07-26`: dùng xếp đơn vào mục “sắp chiếu” trước ngày này. | `BR` Customer Read/Cancellation; `SC-30`, `SC-47` |
| `start_time` | Giờ bắt đầu suất chiếu; dùng cutoff và check-in window. Ví dụ: `start_time = 19:30:00`: giờ bắt đầu chiếu tại rạp. | `BR` Cancellation/Check-in; `SC-30`, `SC-45` |
| `showtime_timezone` | Múi giờ nghiệp vụ của rạp để ghép ngày và giờ chiếu chính xác; các mốc kỹ thuật vẫn quy về UTC. Ví dụ: `showtime_timezone = "Asia/Ho_Chi_Minh"` giúp hiểu `start_time = 19:30` là 19:30 tại Việt Nam, không phải 19:30 UTC. | `BR` General Rules; `PI` invariants |
| `hold_reference` | Mã giữ ghế do Booking tạo trước khi gọi Movie Service. Khi phải gọi lại hoặc nhả ghế sau lỗi lưu cơ sở dữ liệu, hệ thống vẫn gửi đúng mã cũ để Movie Service không tạo lần giữ mới. Ví dụ: `hold_reference = "hold:bkg_7f3a"`: mọi lần giữ, xác nhận hoặc nhả ghế của đơn đều dùng mã này. | `FB` Online Booking; `BR` Inventory Rules; `SC-10`, `SC-11`; `PI BK-P0-01` |
| `total_amount` | Tổng giá ghế và mặt hàng trước giảm giá, do máy chủ tính từ giá Movie Service trả về; không tin tổng tiền do trình duyệt gửi lên. Ví dụ: `total_amount = 300000`: hai ghế 150.000 đồng trước giảm giá. | `BR` Pricing Rules; `SC-01`; `PI BK-P0-02` |
| `discount_amount` | Tổng số tiền được giảm bởi khuyến mãi/điểm. Dùng hiển thị lịch sử và tính chính xác số tiền được hoàn khi hủy. Ví dụ: `discount_amount = 50000`: mã `SUMMER50` giảm 50.000 đồng. | `FB` Commercial Extensions; `SC-56`, `SC-57`; `PI BK-P2-01A` |
| `points_used` | Số điểm thành viên đã chọn và được User Service tạm giữ. Đây chỉ là số liệu của lần đặt vé, không phải số dư điểm hiện tại của thành viên. Ví dụ: `points_used = 200`: User Service tạm giữ 200 điểm cho đơn. | `BR` Loyalty Rules; `SC-58`; `PI BK-P2-01B` |
| `points_discount` | Giá trị tiền quy đổi từ điểm theo chính sách tại thời điểm đặt vé. Ví dụ: khách dùng 200 điểm với tỷ lệ 1 điểm = 100 VND thì `points_discount = 20000`, làm giảm 20.000 đồng. | `BR` Pricing/Refund; `PI BK-P2-01B` |
| `final_amount` | Số tiền cuối cùng phải thanh toán; có check không âm và không lớn hơn total. Ví dụ: `final_amount = 260000`: 300.000 - 50.000 + 10.000 đồng. | `BR` Pricing Rules; `SC-01`, `SC-56` |
| `currency` | Đơn vị tiền tệ của toàn bộ số tiền trong đơn, hiện mặc định là `VND`. Khi nhận sự kiện thanh toán/hoàn tiền, hệ thống phải kiểm tra đơn vị này khớp để tránh ghi nhận nhầm. Ví dụ: `currency = "VND"`: `250000` được hiểu là 250.000 đồng, không phải USD. | `BR` Payment Event Rules; `SC-12`, `SC-15` |
| `booking_status` | Trạng thái chính của đơn: `PENDING_PAYMENT` = đã giữ ghế và đang chờ khách trả tiền (ví dụ vừa tạo đơn); `CONFIRM_PENDING` = đã nhận tiền nhưng đang chờ Movie Service xác nhận bán ghế; `CONFIRMED` = tiền và ghế đều thành công, vé đã/có thể được phát; `CANCEL_REQUESTED` = đã nhận yêu cầu hủy nhưng các bước hoàn tiền/nhả ghế chưa xong; `CANCELLED` = hủy hoàn tất; `EXPIRED` = quá hạn thanh toán. Ví dụ: khách tạo đơn lúc 10:00 thì là `PENDING_PAYMENT`; thanh toán xong và bán ghế thành công thì thành `CONFIRMED`. | `FB` Status; `BR` State Dimensions; toàn bộ `SC-01`–`SC-39` |
| `payment_status` | Bản chụp kết quả Payment Service: `NOT_STARTED` = chưa tạo/khởi động thanh toán; `PENDING` = đang chờ khách hoặc cổng thanh toán; `PROCESSING` = Payment Service đang xử lý; `SUCCEEDED` = tiền đã thành công; `FAILED` = thanh toán thất bại; `UNKNOWN` = chưa xác định chắc chắn, phải truy vấn/đối soát; `CANCELLED` = phiên thanh toán đã bị hủy. Ví dụ: cổng thanh toán timeout nhưng chưa biết có trừ tiền hay không thì lưu `UNKNOWN`, tuyệt đối không tự coi là `FAILED`. | `BR` Payment Rules; `SC-12`–`SC-19`, `SC-27` |
| `payment_reference` | Mã thanh toán duy nhất do Payment Service cấp. Dùng nhận biết thông báo thanh toán trùng, truy vấn trạng thái và yêu cầu hoàn tiền; không phải khóa ngoại tới bảng thanh toán trong Booking Service. Ví dụ: `payment_reference = "pay_20260726_001"`: sự kiện có mã khác phải bị từ chối hoặc đưa đi đối soát. | `BR` Payment/Refund Rules; `SC-15`, `SC-17`, `SC-37`; `PI BK-P0-03` |
| `refund_status` | Tiến độ hoàn tiền: `NOT_REQUESTED` = chưa gửi yêu cầu hoàn; `PENDING` = đã gửi và đang chờ; `SUCCEEDED` = Payment Service xác nhận hoàn thành; `FAILED` = hoàn thất bại; `UNKNOWN` = mất kết nối hoặc kết quả không rõ, cần truy vấn/đối soát. Ví dụ: khách hủy đơn đã trả tiền thì chuyển từ `NOT_REQUESTED` sang `PENDING`; nhận sự kiện hoàn thành thì thành `SUCCEEDED`. | `BR` Refund Rules; `SC-19`, `SC-25`–`SC-39` |
| `inventory_status` | Trạng thái ghế mà Booking đang biết: `HELD` = Movie Service đang giữ ghế; `RELEASE_PENDING` = đã yêu cầu nhả nhưng chưa có kết quả; `RELEASED` = đã nhả; `CONFIRM_PENDING` = đang yêu cầu chuyển ghế giữ thành đã bán; `SOLD` = Movie Service xác nhận đã bán; `CANCEL_SALE_PENDING` = đang yêu cầu hủy ghế đã bán; `CANCELLED` = hủy bán hoàn tất. Ví dụ: đơn mới giữ ghế là `HELD`; thanh toán xong sẽ qua `CONFIRM_PENDING`, thành công thì `SOLD`. | `BR` State Dimensions; `SC-18`–`SC-29` |
| `expires_at` | Thời điểm giữ ghế hết hạn do Movie Service trả về. Tiến trình nền dùng mốc này để chuyển đơn còn chờ thanh toán sang hết hạn và yêu cầu nhả ghế. Ví dụ: `expires_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `FB` Expiry; `BR` Expiry Rules; `SC-20`–`SC-24` |
| `paid_at` | Thời điểm Booking xác nhận đã nhận kết quả thanh toán thành công từ Payment Service. Dùng điều tra giao dịch và đo thời gian từ lúc tạo đơn đến lúc trả tiền. Ví dụ: `paid_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `PI BK-P0-03`; `SC-01`, `SC-23` |
| `created_by` | Mã người hoặc dịch vụ đã tạo đơn. Dùng phân biệt khách đặt trực tuyến với nhân viên bán tại quầy và truy vết trách nhiệm. Ví dụ: `created_by = "acc_1024"` khi khách tạo đơn hoặc `"emp_204"` khi bán tại quầy. | `BR` Employee Operations; `SC-52` |
| `version` | Số phiên bản để ngăn các luồng thanh toán, hết hạn, hủy và xác nhận ghế cùng ghi đè lên nhau. Luồng nào đọc phiên bản cũ phải tải lại và xử lý theo trạng thái mới. Ví dụ: `version = 4`: luồng cập nhật với phiên bản 3 sẽ bị từ chối vì dữ liệu đã đổi. | `BR` race matrix; `SC-21`, `SC-22`, `SC-34`, `SC-46` |
| `created_at` | Thời điểm tạo đơn theo giờ UTC. Dùng sắp xếp lịch sử và kiểm tra quá trình xử lý. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `BR` Customer Read; `SC-47`; `PI BK-P1-05` |
| `updated_at` | Thời điểm gần nhất bất kỳ dữ liệu/trạng thái nào của đơn thay đổi, dùng phát hiện đơn bị kẹt lâu không tiến triển. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `BR` reliability/audit |

### Constraint/index chính

* Unique: `booking_code`, `hold_reference`, `payment_reference`.
* Check constraint cho từng state dimension và các amount.
* Index `(booking_status, expires_at)` cho expiry worker.
* Index `(account_id, created_at)` cho customer history.
* Index `(cluster_id, created_at)` cho employee query.

---

## 5. `booking_item`

### Công dụng

Một dòng cho mỗi ghế trong booking. Đây là immutable seat/price allocation snapshot và là nguồn tạo đúng một ticket (`BR` Booking/Pricing Rules; `SC-01`, `SC-07`, `SC-48`; `PI BK-P0-00`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `booking_item_id` | Mã duy nhất của dòng chi tiết trong hệ thống. Ví dụ: `booking_item_id = "bki_a10"`: dòng chi tiết của ghế A10 trong đơn mẫu. | `PI BK-P0-00` |
| `booking_id` | Khóa ngoại trỏ về đơn đặt vé cha. Khi xóa dữ liệu đơn trong môi trường thử nghiệm, cơ sở dữ liệu tự xóa các dòng ghế con; quy tắc này không thay cho quy trình hủy vé. Ví dụ: `booking_id = "bkg_7f3a"` nối ghế A10 với đúng đơn `bkg_7f3a`. | Quan hệ core |
| `showtime_seat_id` | Mã số của ghế cụ thể trong một suất chiếu do Movie Service trả về. Dùng xác định chính xác ghế nào đã giữ/bán và tránh nhầm cùng số ghế ở suất khác. Ví dụ: `showtime_seat_id = 88010` là ghế A10 của suất mẫu; ghế A10 ở suất khác có mã số khác. | `API` reserve response; `SC-01`, `SC-07` |
| `seat_code` | Bản chụp nhãn ghế như `G7`. Ví dụ: `seat_code = "A10"`: nhãn khách nhìn thấy trên vé. | `BR` Inventory Rules; `SC-01`, `SC-48` |
| `seat_type` | Loại ghế được chụp từ Movie Service, ví dụ `STANDARD` = ghế thường, `VIP` = ghế cao cấp, `COUPLE` = ghế đôi. Dùng hiển thị và kiểm tra giá của từng ghế. | `BR` Inventory Rules; `SC-01` |
| `unit_price` | Giá một ghế trước giảm giá, lấy từ kết quả giữ ghế của Movie Service. Dùng tính tổng tiền ở máy chủ. Ví dụ: `unit_price = 150000`: giá một ghế/món trước giảm giá. | `BR` Pricing Rules; `SC-01` |
| `discount_amount` | Phần tiền giảm giá được phân bổ riêng cho ghế này, dùng in biên nhận và tính số tiền hoàn của ghế khi hủy. Ví dụ: `discount_amount = 50000`: mã `SUMMER50` giảm 50.000 đồng. | `PI BK-P0-00`, `BK-P2-01A` |
| `points_redeemed` | Số điểm thành viên được phân bổ cho ghế này, dùng hoàn đúng số điểm và kiểm tra lịch sử khi chỉ hoàn một phần đơn. Ví dụ: `points_redeemed = 100`: ghế A10 sử dụng 100 trong tổng 200 điểm. | `BR` Loyalty/Refund; `SC-58` |
| `final_price` | Giá cuối của dòng ghế sau khi trừ giảm giá và giá trị điểm. Ví dụ: `final_price = 125000`: ghế 150.000 đồng được phân bổ giảm 25.000 đồng. | `BR` Pricing/Refund |
| `is_from_points` | Cờ đúng/sai cho biết ghế có được thanh toán bằng điểm hay không, dùng hiển thị và tính cách hoàn phù hợp. Ví dụ: `is_from_points = true`: ghế này có phần thanh toán bằng điểm; `false` là không dùng điểm. | `BR` Loyalty Rules |
| `version` | Số phiên bản ngăn bước phát vé, hoàn tiền và hủy cùng cập nhật chi tiết ghế rồi ghi đè kết quả của nhau. Ví dụ: `version = 4`: luồng cập nhật với phiên bản 3 sẽ bị từ chối vì dữ liệu đã đổi. | `BR` race/reliability |

Unique `(booking_id, showtime_seat_id)` ngăn cùng một seat xuất hiện hai lần trong một booking.

---

## 6. `inventory_reservation`

### Công dụng

Lưu reference và trạng thái orchestration của hold thuộc Movie Service. Bảng này không quyết định seat availability và không thay thế Movie inventory (`FB` Ownership; `BR` General/Inventory Rules; `SC-01`, `SC-10`, `SC-18`–`SC-24`; `PI BK-P0-01`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `inventory_reservation_id` | Mã duy nhất của bản ghi theo dõi việc giữ ghế trong Booking Service. Ví dụ: `inventory_reservation_id = "inventory-reservation-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `PI BK-P0-00/01` |
| `booking_id` | Mã đơn sở hữu lần giữ ghế. Mỗi đơn chỉ có một bản ghi giữ ghế chính để tránh giữ hai nhóm ghế ngoài ý muốn. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | Một hold authoritative cho booking P0 |
| `hold_reference` | Mã giữ ghế cố định do Booking tạo và gửi Movie Service. Mọi lần gọi lại, xác nhận hoặc nhả ghế phải dùng đúng mã này. Ví dụ: `hold_reference = "hold:bkg_7f3a"`: mọi lần giữ, xác nhận hoặc nhả ghế của đơn đều dùng mã này. | `SC-10`, `SC-11`; `PI BK-P0-01` |
| `hold_token` | Chuỗi bí mật do Movie Service trả, dùng chứng minh Booking được quyền xác nhận hoặc nhả lần giữ ghế. Chỉ tiến trình nội bộ được đọc; không trả qua API và không ghi log. Ví dụ: `hold_token = "<encrypted-secret>"`: chỉ gửi nội bộ khi xác nhận/nhả ghế, không hiển thị cho khách. | `BR` Inventory/Security; `SC-01`, `SC-61` |
| `inventory_status` | Tiến độ của lần giữ ghế: `HELD` = đang giữ; `RELEASE_PENDING` = đang chờ nhả; `RELEASED` = đã nhả; `CONFIRM_PENDING` = đang chờ xác nhận bán; `SOLD` = đã bán; `CANCEL_SALE_PENDING` = đang chờ hủy bán; `CANCELLED` = đã hủy bán. Ví dụ: khách chưa trả tiền thì thường là `HELD`; đơn hết hạn chuyển `RELEASE_PENDING`, Movie Service trả thành công thì `RELEASED`. | `BR` State Dimensions; `SC-18`–`SC-29` |
| `expires_at` | Thời điểm lần giữ ghế hết hiệu lực do Movie Service quyết định. Sau mốc này Booking không được xem ghế là còn giữ. Ví dụ: `expires_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `BR` Expiry Rules; `SC-20` |
| `confirmed_at` | Thời điểm Movie Service xác nhận lần giữ ghế đã chuyển thành ghế bán thành công (`SOLD`). Ví dụ: `confirmed_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `SC-01`, `SC-18` |
| `released_at` | Thời điểm Movie Service xác nhận đã nhả ghế xong. Có giá trị này nghĩa là lần nhả đã kết thúc thành công. Ví dụ: `released_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `SC-20`, `SC-25` |
| `version` | Số phiên bản ngăn xác nhận bán, nhả ghế và hủy bán chạy đồng thời rồi ghi đè trạng thái nhau. Ví dụ: `version = 4`: luồng cập nhật với phiên bản 3 sẽ bị từ chối vì dữ liệu đã đổi. | `BR` race matrix; `SC-22`, `SC-28` |
| `created_at` | Thời điểm Booking lưu mã giữ ghế theo giờ UTC, dùng kiểm tra lịch sử gọi Movie Service. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit/reliability |
| `updated_at` | Thời điểm trạng thái giữ ghế thay đổi gần nhất, dùng biết việc nào cần gọi lại hoặc mở đối soát. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Retry/reconciliation |

---

## 7. `booking_refund`

### Công dụng

Lưu workflow/refund snapshot mà Booking điều phối; payment ledger thật vẫn ở Payment Service. Bảng hỗ trợ late payment, cancellation, duplicate callback và refund breakdown (`FB` Cancellation; `BR` Refund Rules; `SC-19`, `SC-25`–`SC-39`; `PI BK-P1-01`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `refund_id` | Mã duy nhất của quy trình hoàn tiền mà Booking đang theo dõi. Ví dụ: `refund_id = "booking-refund-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `BR` Refund Rules |
| `booking_id` | Mã đơn được hoàn tiền, dùng lấy số tiền gốc, giảm giá, điểm và lý do hủy. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | Cancellation/late payment |
| `payment_reference` | Mã giao dịch thanh toán thuộc Payment Service. Booking gửi mã này khi yêu cầu hoàn đúng giao dịch; đây không phải khóa ngoại tới bảng thanh toán nội bộ. Ví dụ: `payment_reference = "pay_20260726_001"`: sự kiện có mã khác phải bị từ chối hoặc đưa đi đối soát. | `BR` ownership; `SC-19`, `SC-37` |
| `refund_reference` | Mã hoàn tiền do Payment Service trả. Dùng hỏi lại kết quả và nhận biết thông báo hoàn tiền bị gửi lặp. Ví dụ: `refund_reference = "refund_20260726_001"`: dùng hỏi Payment Service xem khoản hoàn đã xong chưa. | `API` Payment refund contract; `SC-37`–`SC-39` |
| `idempotency_key` | Khóa chống hoàn tiền hai lần, ví dụ tạo từ mã yêu cầu hủy. Mọi lần gọi lại Payment Service phải giữ nguyên khóa này. | `BR` Refund Rules; `SC-39` |
| `amount` | Tổng số tiền đủ điều kiện hoàn, do máy chủ tính từ giá đã chụp và chính sách hoàn; không lấy số tiền do client tự gửi. Ví dụ: đơn đã trả 250.000 đồng và được hoàn toàn bộ thì `amount = 250000`. | `BR` Refund Rules; `SC-29` |
| `cash_amount` | Phần tiền hoàn về phương thức thanh toán ban đầu của khách. Ví dụ: `cash_amount = 200000`: 200.000 đồng được trả về phương thức thanh toán ban đầu. | `PI BK-P2` refund allocation |
| `points_amount` | Phần giá trị cần khôi phục bằng điểm. Ví dụ: `points_amount = 20000`: giá trị điểm cần hoàn tương đương 20.000 đồng. | `BR` Loyalty/Refund; `SC-58` |
| `promotion_amount` | Phần giảm giá từ khuyến mãi ảnh hưởng tới số tiền hoàn và việc trả lại hạn mức mã khuyến mãi. Ví dụ: `promotion_amount = 30000` nghĩa là đơn đã hưởng 30.000 đồng; khi hủy, Promotion Service quyết định có trả lại lượt dùng mã hay không. | `BR` Promotion/Refund |
| `concession_amount` | Phần tiền hoàn liên quan đến đồ ăn/uống kèm đơn. Ví dụ: `concession_amount = 50000`: phần hoàn cho bắp/nước là 50.000 đồng. | `BR` Concession/Refund; `SC-59` |
| `currency` | Đơn vị tiền tệ của khoản hoàn. Booking kiểm tra giá trị này khớp với đơn và thông báo từ Payment Service. Ví dụ: `currency = "VND"`: `250000` được hiểu là 250.000 đồng, không phải USD. | `BR` Payment Event Rules |
| `reason_code` | Mã nguyên nhân chuẩn để chương trình chọn chính sách xử lý và tổng hợp báo cáo. Ví dụ: `reason_code = "CUSTOMER_REQUEST"` cho biết khách chủ động hủy; hệ thống áp dụng chính sách hoàn tương ứng, còn cột `reason` lưu diễn giải cụ thể. | `BR` Cancellation Rules |
| `reason` | Nội dung lý do hoàn tiền đã loại thông tin nhạy cảm, để nhân viên hiểu và điều tra trường hợp hoàn. Ví dụ: `reason = "Khách yêu cầu hủy trước giờ chiếu 3 giờ"`: đủ rõ để nhân viên kiểm tra nhưng không chứa dữ liệu thẻ. | `SC-36`, `SC-38` |
| `refund_status` | Trạng thái riêng của yêu cầu hoàn này: `NOT_REQUESTED` = mới tạo bản ghi nhưng chưa gọi Payment Service; `PENDING` = đã gọi và đang chờ; `SUCCEEDED` = đã hoàn; `FAILED` = thất bại rõ ràng; `UNKNOWN` = chưa biết kết quả. Ví dụ: gọi Payment Service bị timeout sau khi gửi yêu cầu thì đặt `UNKNOWN` và truy vấn bằng `refund_reference`, không gửi một yêu cầu mới với khóa khác. | `BR` State Dimensions; `SC-37`–`SC-39` |
| `completed_at` | Thời điểm Payment Service xác nhận hoàn tiền đã thành công hoặc kết thúc cuối cùng. Chưa có giá trị nghĩa là còn phải chờ/kiểm tra. Ví dụ: `completed_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `SC-29`, `SC-39` |
| `version` | Số phiên bản ngăn thông báo từ Payment Service và tiến trình nền cùng cập nhật kết quả hoàn rồi ghi đè nhau. Ví dụ: `version = 4`: luồng cập nhật với phiên bản 3 sẽ bị từ chối vì dữ liệu đã đổi. | `BR` race matrix |
| `created_at` | Thời điểm Booking bắt đầu theo dõi quy trình hoàn tiền. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit |
| `updated_at` | Thời điểm trạng thái hoàn tiền thay đổi gần nhất, dùng quyết định thử lại hoặc đối soát. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Retry/reconciliation |

---

## 8. `booking_cancellation`

### Công dụng

Hủy đơn là một quy trình riêng, không chỉ đơn giản đổi `booking_status`. Bảng lưu yêu cầu hủy, người yêu cầu, dữ liệu chứng minh điều kiện hủy và tiến độ của từng bước hoàn tiền, nhả ghế, vô hiệu hóa vé (`FB` mục 5; `BR` mục 6; `API` cancellation routes; `SC-25`–`SC-39`; `PI BK-P1-01`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `cancellation_id` | Mã duy nhất của yêu cầu hủy. API trả mã này để ứng dụng có thể hỏi lại tiến độ hủy mà không tạo yêu cầu mới. Ví dụ: `cancellation_id = "booking-cancellation-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `API` Customer Cancellation; `SC-25` |
| `booking_id` | Mã đơn đang được yêu cầu hủy, dùng tải trạng thái tiền, ghế và vé cần xử lý. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | Cancellation workflow |
| `refund_id` | Mã quy trình hoàn tiền liên quan nếu đơn đã thu tiền. Một yêu cầu hủy chỉ nối tối đa một quy trình hoàn tiền. Ví dụ: yêu cầu hủy `cancel_001` có `refund_id = "refund_001"` để theo dõi đúng khoản hoàn; đơn chưa thanh toán thì cột này để trống. | `SC-27`–`SC-29` |
| `idempotency_key` | Khóa chống xử lý trùng của yêu cầu hủy. Nếu client gửi lại do mất mạng, hệ thống trả đúng yêu cầu cũ thay vì hủy/hoàn tiền lần hai. Ví dụ: `idempotency_key = "booking_cancellation:req_001"`: gửi lại cùng yêu cầu phải trả kết quả cũ, không tạo tác dụng lần hai. | `BR` General Cancellation; `SC-34` |
| `request_hash` | Giá trị băm của nội dung yêu cầu hủy. Nếu cùng khóa chống trùng nhưng lý do hoặc dữ liệu hủy khác, hệ thống phát hiện xung đột và từ chối. Ví dụ: `request_hash = "sha256:ab12..."`: cùng idempotency key nhưng hash khác phải trả `409 Conflict`. | `BR` idempotency; `SC-34` |
| `source` | Nguồn tạo yêu cầu hủy: `CUSTOMER` = khách tự hủy; `STAFF_OVERRIDE` = nhân viên hủy thay theo quyền đặc biệt; `ADMIN_OVERRIDE` = quản trị viên can thiệp; `SHOWTIME_CANCELLED` = suất chiếu bị Movie Service hủy; `SYSTEM` = hệ thống tự hủy theo quy tắc. Ví dụ: rạp hủy suất chiếu thì lưu `SHOWTIME_CANCELLED`, không ghi là khách hủy. | `BR` General Cancellation; `SC-35`, `SC-36` |
| `reason_code` | Mã lý do nằm trong danh sách hệ thống cho phép; dùng chọn chính sách xử lý. Ví dụ: `reason_code = "CUSTOMER_REQUEST"`: hệ thống có thể dùng mã này chọn chính sách hoàn tiền; phần `reason` ghi diễn giải. | `BR` Cancellation Eligibility |
| `reason` | Nội dung giải thích vì sao hủy; bắt buộc khi nhân viên/quản trị viên hủy thay khách hoặc bỏ qua một điều kiện thông thường. Ví dụ: `reason = "Khách yêu cầu hủy trước giờ chiếu 3 giờ"`: đủ rõ để nhân viên kiểm tra nhưng không chứa dữ liệu thẻ. | `SC-36` |
| `actor_id` | Mã thành viên, nhân viên, quản trị viên hoặc dịch vụ đã gửi yêu cầu hủy, dùng xác định trách nhiệm khi kiểm tra nhật ký. Ví dụ: `actor_id = "emp_204"`: xác định nhân viên 204 là người thực hiện thao tác. | `BR` audit; `SC-36` |
| `correlation_id` | Mã liên kết dùng chung cho toàn bộ một lần hủy. Cùng mã này được ghi vào yêu cầu hủy, yêu cầu hoàn tiền, yêu cầu Movie Service hủy bán/nhả ghế, sự kiện thanh toán nhận vào và sự kiện Booking phát ra. Khi một bước lỗi, nhân viên tìm theo mã này để xem đầy đủ log và biết luồng đã dừng ở bước nào. Ví dụ: `correlation_id = "corr_bkg_7f3a_cancel_01"` xuất hiện trong log gọi Movie, Payment, inbox và outbox của lần hủy đơn `bkg_7f3a`. | `BR` reliability; `SC-62`–`SC-64` |
| `cancellation_status` | Trạng thái quy trình hủy: `REQUESTED` = đã nhận và lưu yêu cầu nhưng chưa bắt đầu đủ các bước; `PROCESSING` = đang nhả/hủy bán ghế, hoàn tiền hoặc vô hiệu hóa vé; `COMPLETED` = tất cả bước bắt buộc đã hoàn tất; `FAILED` = quy trình thất bại rõ ràng và không thể tự hoàn tất theo lần xử lý hiện tại; `MANUAL_REVIEW` = kết quả tiền/ghế không chắc chắn hoặc thử lại nhiều lần vẫn lỗi, cần nhân viên kiểm tra. Ví dụ: khách bấm hủy tạo bản ghi `REQUESTED`; worker bắt đầu gọi Payment/Movie thì chuyển `PROCESSING`; tiền đã hoàn, ghế đã nhả và vé đã vô hiệu thì chuyển `COMPLETED`. Nếu Payment báo đã hoàn nhưng Movie không xác định được ghế đã hủy bán hay chưa thì chuyển `MANUAL_REVIEW`. | `BR` State Dimensions; `SC-25`–`SC-39` |
| `before_snapshot` | Bản chụp trạng thái đơn, tiền, ghế và vé trước khi thao tác hủy thủ công chạy; dùng chứng minh hệ thống đã thay đổi từ trạng thái nào. Ví dụ: `before_snapshot = {"bookingStatus":"CONFIRMED"}` trước khi nhân viên hủy. | `BR` Employee Rules; `SC-36`, `SC-55` |
| `after_snapshot` | Bản chụp trạng thái sau thao tác hủy, dùng so sánh trước/sau và đối soát nếu kết quả giữa các dịch vụ không khớp. Ví dụ: `after_snapshot = {"bookingStatus":"CANCEL_REQUESTED"}` sau khi nhận thao tác hủy. | `BR` Employee Rules |
| `requested_at` | Thời điểm hệ thống đã nhận và lưu bền vững yêu cầu hủy theo giờ UTC; API có thể trả mã theo dõi ngay cả khi hủy chưa xong. Ví dụ: `requested_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | API `201/202` semantics |
| `completed_at` | Thời điểm tất cả bước cần thiết đã có kết quả cuối cùng: hoàn tiền, nhả/hủy bán ghế và vô hiệu hóa vé. Chưa có giá trị nghĩa là quy trình còn đang chạy. Ví dụ: `completed_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `BR` Processing Order; `SC-29` |
| `version` | Số phiên bản ngăn hai yêu cầu hủy hoặc các luồng thanh toán, hết hạn và soát vé cập nhật cùng một đơn tại cùng thời điểm. Ví dụ: `version = 4`: luồng cập nhật với phiên bản 3 sẽ bị từ chối vì dữ liệu đã đổi. | `BR` race matrix; `SC-34`, `SC-46` |
| `updated_at` | Thời điểm quy trình hủy thay đổi gần nhất; ứng dụng dùng khi hỏi tiến độ và tiến trình nền dùng để phát hiện việc cần thử lại. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Polling/retry |

Partial unique index chỉ cho phép tối đa một workflow active (`REQUESTED/PROCESSING/MANUAL_REVIEW`) trên mỗi booking.

---

## 9. `ticket`

### Công dụng

Một ticket cho mỗi `booking_item`, chỉ phát hành sau payment success và inventory `SOLD`. Ticket lưu immutable display snapshot và state check-in/cancellation (`FB` mục 6; `BR` mục 7; `SC-01`, `SC-40`–`SC-46`; `PI BK-P1-02`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `ticket_id` | Mã duy nhất của vé, dùng lấy danh sách vé và chọn đúng vé cần soát. Ví dụ: `ticket_id = "ticket-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `API` Ticket APIs; `SC-43` |
| `booking_id` | Mã đơn chứa vé, dùng lấy toàn bộ vé cùng đơn và kiểm tra người sở hữu mã QR. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | Ticket ownership/pass resolution |
| `booking_item_id` | Liên kết duy nhất bảo đảm mỗi dòng ghế chỉ phát hành đúng một vé. Ví dụ: `booking_item_id = "bki_a10"`: dòng chi tiết của ghế A10 trong đơn mẫu. | `BR` Issuance Rules; `SC-01` |
| `account_id` | Mã tài khoản chủ vé được chụp lúc phát hành. Dùng kiểm tra chỉ chủ vé mới xem được vé của mình. Ví dụ: `account_id = "acc_1024"`: tài khoản `acc_1024` chỉ được xem hoặc hủy đơn của chính mình. | `SC-40`, `SC-49` |
| `showtime_id` | Mã số suất chiếu của vé, dùng hiển thị lịch sử và đối chiếu vé có thuộc đúng suất/ghế hay không. Ví dụ: `showtime_id = 20260726193001` là suất chiếu ngày 26/07 lúc 19:30. | Ticket/history/reconciliation |
| `movie_name` | Tên phim được chụp lúc phát vé để vé cũ vẫn hiển thị đúng dù danh mục phim thay đổi. Ví dụ: `movie_name = "Avengers: Endgame"`: lịch sử vẫn giữ tên này nếu danh mục phim đổi sau đó. | `SC-40`, `SC-48` |
| `cluster_id` | Mã số cụm rạp được phép soát vé; dùng từ chối nhân viên hoặc cổng ở rạp khác. Ví dụ: `cluster_id = 12` nghĩa là chỉ nhân viên/cổng được cấp quyền tại cụm 12 mới soát vé. | `BR` Ticket Access; `SC-45` |
| `cluster_name` | Tên rạp được chụp để hiển thị trên vé/lịch sử và phục vụ kiểm tra. Ví dụ: `cluster_name = "CGV Vincom Thủ Đức"`: tên được in trên vé và biên nhận. | Ticket pass/history |
| `cinema_room_name` | Bản chụp tên phòng chiếu dùng để hiển thị. Ví dụ: `cinema_room_name = "Cinema 5"`: khách nhìn thấy phòng này trên vé. | Ticket pass |
| `seat_code` | Nhãn ghế hiển thị. Ví dụ: `seat_code = "A10"`: nhãn khách nhìn thấy trên vé. | `SC-40`, `SC-43` |
| `seat_type` | Loại ghế được chụp trên vé, ví dụ `STANDARD`, `VIP`, `COUPLE`; dùng hiển thị đúng loại ghế đã mua dù Movie Service đổi cấu hình sau đó. | Ticket/history |
| `price` | Bản chụp giá cuối của vé, dùng hiển thị lịch sử và tính hoàn tiền; giá không nằm trong chuỗi QR. Ví dụ: `price = 125000` nghĩa là vé ghế A10 có giá cuối 125.000 đồng. | `BR` Security/Issuance |
| `ticket_status` | Trạng thái vé: `VALID` = còn hiệu lực và chưa soát; `USED` = đã soát vào rạp; `CANCELLED` = vé bị vô hiệu do hủy/hoàn đơn. Ví dụ: quét thành công vé `VALID` sẽ đổi thành `USED`; quét lại phải báo đã sử dụng chứ không tạo lượt vào mới. | `BR` State Dimensions; `SC-42`–`SC-46` |
| `checked_in_at` | Thời điểm check-in thành công; scan lặp trả lại giá trị cũ. Ví dụ: `checked_in_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `SC-42`–`SC-44` |
| `issued_by` | Mã người hoặc dịch vụ phát hành vé, dùng phân biệt vé phát tự động với vé bán tại quầy và truy vết khi có lỗi. Ví dụ: `issued_by = "booking-service"` nếu phát tự động hoặc `"emp_204"` nếu phát tại quầy. | `SC-52` |
| `version` | Số phiên bản dùng cập nhật có điều kiện, ngăn hai lần quét đồng thời hoặc hủy vé và soát vé cùng ghi đè nhau. Ví dụ: vé đang ở `version = 4` thì yêu cầu còn giữ phiên bản 3 bị từ chối và phải đọc lại trạng thái mới. | `SC-44`, `SC-46` |
| `issued_at` | Thời điểm phát hành vé theo giờ UTC sau khi đơn được xác nhận. Ví dụ: `issued_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `SC-01` |
| `updated_at` | Thời điểm trạng thái vé được cập nhật gần nhất theo giờ UTC. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit |

---

## 10. `booking_ticket_pass`

### Công dụng

Một opaque QR pass cho toàn booking. DB không lưu plaintext token; lưu lookup hash và ciphertext để có thể resolve/revoke/rotate an toàn (`FB` mục 6; `BR` Ticket Rules; `SC-40`–`SC-46`, `SC-61`; `PI BK-P1-02`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `ticket_pass_id` | Mã duy nhất của mã QR dùng chung cho đơn. Ví dụ: `ticket_pass_id = "booking-ticket-pass-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `PI BK-P1-02` |
| `booking_id` | Quan hệ một-một: mỗi đơn có tối đa một mã QR dùng chung. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | `BR` Issuance Rules; `SC-40` |
| `token_hash` | Giá trị băm một chiều của chuỗi trong mã QR. Khi quét, hệ thống băm chuỗi nhận được rồi tìm theo cột này; cơ sở dữ liệu không phải lưu chuỗi QR gốc có thể bị lợi dụng. Ví dụ: `token_hash = "sha256:9f8e..."`: dùng tìm mã QR mà không lưu chuỗi QR gốc. | `BR` Security; `PI BK-P1-02` |
| `token_ciphertext` | Chuỗi QR đã được mã hóa khi lưu trong cơ sở dữ liệu. Chỉ hệ thống có khóa giải mã mới có thể trả lại mã QR cho đúng chủ vé qua API được phân quyền. Ví dụ: `token_ciphertext = "enc:v2:..."`: chỉ giải mã khi chủ vé hợp lệ yêu cầu xem QR. | `PI BK-P1-02` |
| `key_version` | Mã phiên bản khóa mã hóa, dùng chọn đúng khóa khi giải mã và thay khóa định kỳ. Ví dụ: `key_version = "kms-key-v2"` nghĩa là dữ liệu được mã hóa bằng khóa KMS phiên bản 2. | `PI BK-P1-02` |
| `pass_status` | Trạng thái mã QR chung: `ACTIVE` = mã còn dùng để mở/soát các vé trong đơn; `REVOKED` = mã đã bị thu hồi và mọi lần quét phải bị từ chối. Ví dụ: khi đơn hủy hoặc hoàn tiền thành công, chuyển từ `ACTIVE` sang `REVOKED`. | `SC-41`, `SC-45` |
| `revoked_at` | Thời điểm mã QR bị vô hiệu hóa theo giờ UTC. Ví dụ: `revoked_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `SC-29`, `SC-41` |
| `revoked_reason` | Lý do mã QR bị thu hồi, ví dụ đơn đã hủy hoặc hoàn tiền; dùng giải thích cho ứng dụng và điều tra truy cập bị từ chối. | Cancellation/security |
| `version` | Ngăn đổi khóa mã hóa, thu hồi mã QR và soát vé cùng ghi đè dữ liệu của nhau. Ví dụ: `version = 4`: luồng cập nhật với phiên bản 3 sẽ bị từ chối vì dữ liệu đã đổi. | `SC-46` |
| `issued_at` | Thời điểm pass phát hành cùng confirmation transaction. Ví dụ: `issued_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `SC-01`, `SC-40` |
| `updated_at` | Thời điểm mã QR được cập nhật gần nhất. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit |

---

## 11. `ticket_check_in`

### Công dụng

Audit/idempotency record cho mỗi ticket được check-in. Bảng kết hợp với optimistic locking trên `ticket` để hỗ trợ mode `ALL/SELECTED`, duplicate scan và concurrent scan (`BR` Check-in Rules; `API` check-in; `SC-42`–`SC-46`; `PI BK-P1-02`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `check_in_id` | Mã duy nhất của một lần thử soát vé, để từng lần quét đều có thể được kiểm tra lại. Ví dụ: `check_in_id = "ticket-check-in-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | Check-in workflow |
| `ticket_id` | Mã vé được quét và cập nhật trong lần soát này. Ví dụ: lần soát `checkin_001` có `ticket_id = "ticket_001"` để chuyển đúng vé từ `VALID` sang `USED`. | `SC-42`, `SC-43` |
| `caller_scope` | Phạm vi bên quét vé, ví dụ mã nhân viên, cổng hoặc dịch vụ. Dùng kiểm tra quyền tại đúng rạp và tách khóa chống trùng giữa các bên quét. | `BR` Ticket Access/Security |
| `idempotency_key` | Khóa chống ghi nhận cùng một lần quét hai lần khi thiết bị gửi lại do mất mạng. Ví dụ: `idempotency_key = "ticket_check_in:req_001"`: gửi lại cùng yêu cầu phải trả kết quả cũ, không tạo tác dụng lần hai. | `SC-44` |
| `request_hash` | Giá trị băm nội dung quét. Nếu cùng khóa chống trùng nhưng đổi chế độ hoặc danh sách vé, hệ thống từ chối để tránh dùng nhầm khóa. Ví dụ: `request_hash = "sha256:ab12..."`: cùng idempotency key nhưng hash khác phải trả `409 Conflict`. | `BR` idempotency |
| `check_in_mode` | Cách soát vé: `ALL` = soát toàn bộ vé còn hợp lệ trong đơn; `SELECTED` = chỉ soát danh sách `ticket_id` được chọn. Ví dụ: nhóm bốn người cùng vào dùng `ALL`; hai người vào trước dùng `SELECTED` với hai mã vé. | `SC-42`, `SC-43` |
| `gate_id` | Cổng thực hiện quét vé; cổng phải thuộc đúng cụm rạp được cấp quyền. Ví dụ: `gate_id = "GATE-02"`: cổng số 2 tại đúng cụm rạp thực hiện quét. | `SC-45` |
| `checked_by` | Mã nhân viên hoặc cổng tin cậy đã thực hiện soát vé. Ví dụ: `checked_by = "emp_gate_07"`: nhân viên/cổng này chịu trách nhiệm lần soát. | `BR` Access Rules |
| `device_id` | Mã thiết bị quét vé, dùng tìm thiết bị gây nhiều lần quét lỗi hoặc có dấu hiệu lạm dụng. Ví dụ: `device_id = "scanner-TD-03"`: nhiều lỗi từ mã này giúp phát hiện máy quét số 3 có vấn đề. | `FB` Observability/Abuse; `SC-64` |
| `result` | Kết quả lần quét, nên lưu giá trị rõ nghĩa như `SUCCESS` = soát thành công, `REJECTED` = bị từ chối do sai rạp/vé hủy, `DUPLICATE` = yêu cầu hoặc vé đã được quét trước đó. Ví dụ: quét lại vé `USED` lưu `DUPLICATE` và không thay đổi vé lần nữa. | `SC-44`, `SC-45` |
| `checked_in_at` | Thời điểm nghiệp vụ mà vé được quét/soát thành công. Ví dụ: `checked_in_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `SC-42`–`SC-44` |
| `created_at` | Thời điểm kỹ thuật bản ghi được lưu bền vững vào cơ sở dữ liệu. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit |

Unique `(caller_scope, idempotency_key)` bảo đảm cùng caller/key không tạo side effect lần hai.

---

## 12. `booking_operation`

### Công dụng

Durable idempotency/orchestration record được persist trước cross-service mutation. Nó cho phép retry cùng request nhận cùng kết quả, phát hiện key reuse sai payload và resume sau restart (`FB` Online Booking/Reliability; `BR` General/Booking Creation Rules; `SC-02`, `SC-03`, `SC-10`, `SC-11`, `SC-62`; `PI BK-P0-00/02`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `operation_id` | Mã duy nhất của thao tác được lưu bền vững, để tiến trình có thể tiếp tục sau khi ứng dụng khởi động lại. Ví dụ: `operation_id = "booking-operation-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `PI BK-P0-00/02` |
| `caller_scope` | Phạm vi của bên gọi, thường là mã tài khoản hoặc tên dịch vụ. Kết hợp với khóa chống trùng để hai tài khoản khác nhau có thể dùng cùng chuỗi khóa mà không xung đột. Ví dụ: `caller_scope = "account:acc_1024"`: khóa chống trùng của khách này không xung đột với khách khác. | `BR` idempotency scope |
| `operation_name` | Loại mutation như `CREATE_BOOKING`, `CREATE_CANCELLATION`, `CHECK_IN`. Ví dụ: `operation_name = "CREATE_BOOKING"`: cho biết tác vụ đang tạo đơn; tác vụ bù trừ có thể là `RELEASE_INVENTORY`. | `BR` mutation rules |
| `idempotency_key` | Khóa chống xử lý trùng do bên gọi gửi. Khi mất mạng và gửi lại cùng khóa, hệ thống trả kết quả cũ thay vì thực hiện thao tác lần nữa. Ví dụ: `idempotency_key = "booking_operation:req_001"`: gửi lại cùng yêu cầu phải trả kết quả cũ, không tạo tác dụng lần hai. | `API` mutation headers; `SC-02`, `SC-03` |
| `request_hash` | Giá trị băm của nội dung yêu cầu đã chuẩn hóa. Nếu cùng khóa chống trùng nhưng nội dung khác, API trả lỗi `409 Conflict` để ngăn dùng nhầm khóa. Ví dụ: `request_hash = "sha256:ab12..."`: cùng idempotency key nhưng hash khác phải trả `409 Conflict`. | `SC-03` |
| `booking_id` | Mã đơn được tạo hoặc tác động sau khi thao tác thành công. Cột được phép trống khi thao tác còn chạy hoặc thất bại trước khi xác định được đơn. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | `SC-02`, `SC-11` |
| `operation_status` | Trạng thái thao tác chống trùng: `IN_PROGRESS` = yêu cầu đã được nhận và còn đang chạy; `SUCCEEDED` = đã thành công và có thể trả lại kết quả cũ; `FAILED_RETRYABLE` = lỗi tạm thời, tiến trình nền hoặc cùng yêu cầu được phép thử lại; `FAILED_TERMINAL` = lỗi cuối cùng, thử lại cùng thao tác cũng chỉ trả kết quả lỗi đã lưu. Ví dụ: Movie Service tạm mất kết nối là `FAILED_RETRYABLE`; dữ liệu ghế không hợp lệ là `FAILED_TERMINAL`. | `BR` State Dimensions; `PI BK-P0-02` |
| `http_status` | Mã trạng thái HTTP đã trả ở lần đầu, ví dụ `201`, `202` hoặc `409`; dùng trả lại đúng mã đó khi yêu cầu được gửi lặp. | Idempotent API response |
| `response_snapshot` | Bản sao kết quả API đã loại dữ liệu nhạy cảm và chuyển thành JSON. Cùng khóa và cùng nội dung yêu cầu sẽ nhận lại đúng kết quả này. Ví dụ: `response_snapshot = {"bookingId":"bkg_7f3a","status":"PENDING_PAYMENT"}` để trả lại khi client gửi lặp. | `BR` idempotency; `SC-02` |
| `poll_reference` | Mã theo dõi trả cho bên gọi khi thao tác chưa xong. Ứng dụng dùng mã này hỏi lại tiến độ mà không tạo thao tác mới. Ví dụ: `poll_reference = "op_create_0001"`: ứng dụng gọi API tra cứu tiến độ bằng mã này. | `PI BK-P0-02` |
| `correlation_id` | Mã liên kết của một thao tác đặt/hủy/soát vé. Mã được truyền sang Movie Service, Payment Service và các tiến trình nền, đồng thời ghi trong log; khi có lỗi có thể tìm một mã để ghép toàn bộ các bước thuộc cùng yêu cầu. Ví dụ: thao tác tạo đơn dùng `correlation_id = "corr_bkg_7f3a_create_01"` trong tất cả lời gọi và log liên quan. | `SC-62`–`SC-64` |
| `expires_at` | Thời điểm hết thời hạn lưu bản ghi chống trùng; sau mốc này tiến trình dọn dẹp mới được xóa theo chính sách lưu trữ. Ví dụ: thao tác tạo ngày 26/07 và giữ 24 giờ có `expires_at = 2026-07-27T19:35:00+07:00`. | `PI BK-P0-00`; production decisions |
| `version` | Số phiên bản ngăn nhiều yêu cầu gửi lại đồng thời cùng cập nhật một thao tác và tạo hai kết quả khác nhau. Ví dụ: `version = 4`: luồng cập nhật với phiên bản 3 sẽ bị từ chối vì dữ liệu đã đổi. | `SC-02`, `SC-34` |
| `created_at` | Thời điểm hệ thống nhận và lưu thao tác theo giờ UTC; dùng kiểm tra lịch sử và thời hạn lưu dữ liệu chống trùng. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit/retention |
| `updated_at` | Thời điểm thao tác đổi trạng thái gần nhất; dùng trả tiến độ và tiếp tục công việc sau khi ứng dụng khởi động lại. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Polling/recovery |

Unique `(caller_scope, operation_name, idempotency_key)` là idempotency scope chuẩn trong `BUSINESS_RULES.md`.

---

## 13. `payment_event_inbox`

### Công dụng

Inbox lưu normalized authenticated event mà Booking consume từ Payment Service. Đây không phải payment ledger; mục tiêu là deduplicate, validate snapshot và retry processing an toàn (`FB` Payment Confirmation; `BR` Payment Event/Event Reliability Rules; `API` consumed events; `SC-14`–`SC-19`, `SC-23`, `SC-37`–`SC-39`; `PI BK-P0-03`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `inbox_id` | Mã duy nhất của sự kiện trong hộp nhận. Ví dụ: `inbox_id = "payment-event-inbox-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | Inbox pattern |
| `event_source` | Tên dịch vụ gửi sự kiện, ví dụ `payment-service`. Kết hợp với `provider_event_id` thành khóa duy nhất; cùng mã sự kiện từ hai nguồn khác nhau không bị coi nhầm là một. | `BR` authenticated event rule |
| `provider_event_id` | Mã sự kiện duy nhất do dịch vụ gửi cấp. Nếu nhận lại cùng mã, Booking không xác nhận đơn, phát vé hoặc hoàn tiền thêm lần nữa. Ví dụ: `provider_event_id = "evt_pay_987"`: nhận lại mã này lần hai không được phát vé lần hai. | `SC-14`, `SC-39` |
| `event_type` | Loại thông báo nhận từ Payment Service: `PAYMENT_SUCCEEDED` = thanh toán thành công, dùng bắt đầu xác nhận ghế; `PAYMENT_FAILED` = thanh toán thất bại, đơn tiếp tục chờ hoặc hết hạn theo luật; `REFUND_SUCCEEDED` = hoàn tiền thành công, dùng hoàn tất bước hoàn; `REFUND_FAILED` = hoàn thất bại, dùng thử lại/đối soát. Ví dụ: Payment gửi `PAYMENT_SUCCEEDED` cho đúng số tiền thì Booking chuyển thanh toán sang thành công và yêu cầu Movie bán ghế. | `API` Consumed Events |
| `event_version` | Phiên bản hợp đồng/cấu trúc sự kiện để Booking chọn cách đọc tương thích. Ví dụ: `event_version = "2"` khiến consumer dùng bộ đọc cấu trúc sự kiện phiên bản 2. | `API` event envelope; `PI BK-P1-04` |
| `booking_id` | Mã đơn tìm được từ mã thanh toán. Cột được phép trống khi thông báo chưa ghép được với đơn hoặc dữ liệu không khớp, để giữ bằng chứng và mở đối soát thay vì bỏ sự kiện. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | `SC-15` |
| `payment_reference` | Mã thanh toán trong thông báo. Dùng tìm đúng đơn và kiểm tra nó trùng với mã Payment Service đã cấp cho đơn. Ví dụ: `payment_reference = "pay_20260726_001"`: sự kiện có mã khác phải bị từ chối hoặc đưa đi đối soát. | `SC-15`, `SC-17` |
| `amount` | Số tiền trong thông báo thanh toán/hoàn tiền. Booking so sánh với số tiền đã chụp trong đơn trước khi thay đổi trạng thái. Ví dụ: `amount = 250000`: số tiền thanh toán/hoàn phải khớp số tiền cuối của đơn. | `BR` Payment Event Rules; `SC-15` |
| `currency` | Đơn vị tiền tệ trong thông báo. Phải khớp cùng số tiền và đơn vị của đơn để sự kiện được chấp nhận. Ví dụ: `currency = "VND"`: `250000` được hiểu là 250.000 đồng, không phải USD. | `SC-15` |
| `correlation_id` | Mã nối sự kiện Payment Service gửi đến với bước xác nhận đơn, hoàn tiền, mở hồ sơ đối soát và sự kiện Booking phát ra. Dùng tìm toàn bộ log liên quan và chứng minh một thông báo tiền đã tạo ra những thay đổi nào. Ví dụ: `correlation_id = "corr_bkg_7f3a_payment_01"` nối sự kiện tiền thành công với bước xác nhận ghế và phát vé. | `SC-62`–`SC-64` |
| `payload` | Nội dung thông báo đã chuẩn hóa thành JSON và loại bí mật không cần thiết. Dùng xử lý lại/điều tra mà không cần yêu cầu Payment Service gửi lại. Ví dụ: `payload = {"bookingId":"bkg_7f3a","amount":250000}` sau khi đã loại token và dữ liệu thẻ. | `BR` Event/Security Rules |
| `processing_status` | Trạng thái xử lý hộp nhận; nên dùng bộ giá trị thống nhất như `RECEIVED` = đã lưu nhưng chưa xử lý, `PROCESSING` = một worker đang xử lý, `RETRY_PENDING` = lỗi tạm và đang chờ thử lại, `PROCESSED` = đã áp dụng xong, `FAILED` = không thể tự xử lý. Ví dụ: sự kiện sai số tiền được lưu `FAILED` và mở đối soát, không xác nhận đơn. | `SC-62` |
| `attempt_count` | Số lần tiến trình nền đã thử xử lý sự kiện; dùng tăng thời gian chờ giữa các lần thử và giới hạn số lần tự động. Ví dụ: `attempt_count = 3`: tác vụ đã lỗi ba lần, lần tiếp theo sẽ chờ lâu hơn hoặc chuyển kiểm tra thủ công. | Retry/backoff |
| `received_at` | Thời điểm sự kiện được lưu vào cơ sở dữ liệu trước khi làm thay đổi đơn. Dùng chứng minh đã nhận và tính thời gian chờ xử lý. Ví dụ: `received_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit/dedup |
| `processed_at` | Thời điểm sự kiện xử lý xong theo giờ UTC. Ví dụ: `processed_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Metrics/latency |
| `next_attempt_at` | Thời điểm sớm nhất được thử xử lý lại sau lỗi tạm thời, tránh gọi liên tục gây quá tải. Ví dụ: `next_attempt_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `SC-62`, `SC-63` |
| `last_error` | Nội dung lỗi gần nhất đã loại bí mật và dữ liệu cá nhân, để nhân viên biết vì sao sự kiện chưa xử lý được và có cần đối soát không. Ví dụ: `last_error = "Movie Service timeout after 3s"`: đủ để điều tra nhưng không chứa token bí mật. | `SC-15`, `SC-38` |

Unique `(event_source, provider_event_id)` ngăn confirm, ticket, refund hoặc outbox bị tạo hai lần.

---

## 14. `compensation_task`

### Công dụng

Durable command cho partial failure không thể xử lý ngay, ví dụ local DB fail sau Movie reserve, release timeout hoặc confirm chưa rõ. Worker có thể claim/retry sau restart (`FB` Durable Recovery; `BR` General/Release Rules; `DEMO` Failure Recovery; `SC-11`, `SC-18`, `SC-19`, `SC-62`; `PI BK-P0-00/01/04`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `task_id` | Mã duy nhất của tác vụ bù trừ. Ví dụ: `task_id = "compensation-task-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `PI BK-P0-00` |
| `booking_id` | Mã đơn liên quan, được phép để trống nếu giữ ghế đã thành công nhưng lưu đơn thất bại nên chưa có bản ghi đơn. Ví dụ: nếu đơn đã lưu thì dùng `booking_id = "bkg_7f3a"`; nếu chưa lưu được, tác vụ vẫn dùng `hold_reference` để nhả ghế. | `SC-11` |
| `operation_name` | Action cần recover như `RELEASE_INVENTORY`, `QUERY_CONFIRM`, `REQUEST_REFUND`. Ví dụ: `operation_name = "CREATE_BOOKING"`: cho biết tác vụ đang tạo đơn; tác vụ bù trừ có thể là `RELEASE_INVENTORY`. | `BR` Durable Recovery |
| `target_service` | Dịch vụ nhận lệnh, ví dụ `movie-service`. | Cross-service orchestration |
| `target_reference` | Mã tài nguyên cần sửa, có thể là mã giữ ghế, thanh toán hoặc hoàn tiền. Mọi lần truy vấn/thử lại dùng đúng mã này để không tác động nhầm tài nguyên. Ví dụ: `target_reference = "ref_compensationtask_001"`: mọi lần gọi lại dịch vụ ngoài phải giữ nguyên mã này. | `BR` stable downstream key |
| `idempotency_key` | Khóa chống thực hiện tác vụ bù trừ hai lần. Tiến trình nền phải giữ nguyên khóa qua mọi lần thử, không tự tạo khóa mới. Ví dụ: `idempotency_key = "compensation_task:req_001"`: gửi lại cùng yêu cầu phải trả kết quả cũ, không tạo tác dụng lần hai. | `SC-10`, `SC-11`, `SC-18` |
| `task_status` | Trạng thái tác vụ bù trừ; nên dùng `PENDING` = chờ chạy, `PROCESSING` = worker đã nhận, `SUCCEEDED` = sửa xong, `FAILED` = lần xử lý thất bại và có thể chờ lịch tiếp, `MANUAL_REVIEW` = hết khả năng tự xử lý. Ví dụ: lưu đơn lỗi sau khi đã giữ ghế sẽ tạo tác vụ nhả ghế `PENDING`; Movie xác nhận nhả thì thành `SUCCEEDED`. | `SC-62` |
| `command_payload` | Nội dung lệnh tối thiểu được lưu thành JSON, ví dụ mã ghế cần nhả. Nhờ đó tiến trình nền tiếp tục đúng việc sau khi ứng dụng khởi động lại. | `BR` durable state |
| `correlation_id` | Mã liên kết tác vụ bù trừ với yêu cầu hoặc sự kiện ban đầu đã làm phát sinh lỗi. Dùng tìm nguyên nhân gốc và kiểm tra tác vụ này có sửa đúng luồng hay không. Ví dụ: tác vụ nhả ghế sau lỗi tạo đơn giữ `correlation_id = "corr_bkg_7f3a_create_01"` giống yêu cầu tạo đơn ban đầu. | `SC-64` |
| `attempt_count` | Số lần hệ thống đã thử thực hiện tác vụ. Ví dụ: `attempt_count = 3`: tác vụ đã lỗi ba lần, lần tiếp theo sẽ chờ lâu hơn hoặc chuyển kiểm tra thủ công. | Retry/backoff |
| `next_attempt_at` | Thời điểm sớm nhất tiến trình nền được lấy tác vụ để thử lại, giúp giãn khoảng cách giữa các lần lỗi. Ví dụ: `next_attempt_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Worker scheduling |
| `claimed_by` | Tên máy/tiến trình đang nhận xử lý tác vụ. Dùng ngăn hai tiến trình chạy cùng một tác vụ tại một thời điểm. Ví dụ: `claimed_by = "booking-worker-02"`: worker số 2 đang giữ quyền xử lý tác vụ. | `BR` multi-instance worker; `SC-21` |
| `claim_until` | Thời hạn quyền xử lý của tiến trình hiện tại. Nếu tiến trình chết hoặc treo quá hạn, tiến trình khác được phép nhận lại tác vụ. Ví dụ: `claim_until = 2026-07-26T19:36:00+07:00` nghĩa là `booking-worker-02` giữ quyền đến 19:36; sau mốc đó worker khác được nhận tác vụ nếu nó chưa hoàn thành. | `SC-62` |
| `last_error` | Lỗi gần nhất của tác vụ, dùng quyết định còn tự thử lại được hay phải chuyển nhân viên kiểm tra. Ví dụ: `last_error = "Movie Service timeout after 3s"`: đủ để điều tra nhưng không chứa token bí mật. | Reconciliation/observability |
| `version` | Số phiên bản ngăn hai tiến trình cùng nhận hoặc cập nhật tác vụ. Ví dụ: `version = 4`: luồng cập nhật với phiên bản 3 sẽ bị từ chối vì dữ liệu đã đổi. | Concurrency |
| `created_at` | Thời điểm tạo tác vụ theo giờ UTC. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit/metrics |
| `updated_at` | Thời điểm tác vụ thay đổi gần nhất theo giờ UTC. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Stuck-task alert |

---

## 15. `outbox_event`

### Công dụng

Transactional outbox lưu domain event cùng transaction với state change. Kafka/Notification lỗi không rollback booking; publisher retry/replay sau đó (`FB` Reliable Events; `BR` Event Rules; `API` Published Events; `SC-01`, `SC-20`, `SC-29`, `SC-63`; `PI BK-P1-04`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `event_id` | Mã duy nhất toàn hệ thống của sự kiện. Dịch vụ nhận lưu mã này để cùng sự kiện được gửi lại cũng chỉ tạo tác dụng một lần. Ví dụ: `event_id = "outbox-event-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `PI BK-P1-04` |
| `booking_id` | Khóa ngoại có thể để trống tới đơn đặt vé; dùng khi sự kiện thuộc một đơn cụ thể. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | Booking events |
| `aggregate_type` | Loại đối tượng nghiệp vụ phát sự kiện: `BOOKING` = đơn đặt vé, `TICKET` = vé, `REFUND` = quy trình hoàn tiền. Ví dụ: sự kiện `BOOKING_CONFIRMED` có `aggregate_type = BOOKING` và `aggregate_id` là mã đơn. | Event envelope |
| `aggregate_id` | Mã đối tượng nghiệp vụ đã phát sinh sự kiện. Ví dụ: `aggregate_id = "bkg_7f3a"`: sự kiện `BOOKING_CONFIRMED` thuộc đơn mẫu này. | Event envelope |
| `aggregate_version` | Số phiên bản của đơn tại lúc tạo sự kiện. Dịch vụ nhận dùng nó phát hiện sự kiện cũ, trùng hoặc đến sai thứ tự. Ví dụ: đã xử lý phiên bản `5` mà sau đó nhận sự kiện `aggregate_version = 4` thì biết đây là sự kiện cũ và không được ghi đè trạng thái mới. | `PI BK-P1-04` |
| `event_type` | Loại sự kiện Booking phát: `BOOKING_PENDING_PAYMENT` = đơn đang chờ tiền; `BOOKING_CONFIRMED` = đơn đã xác nhận; `BOOKING_EXPIRED` = đơn hết hạn; `BOOKING_CANCELLED` = hủy xong; `REFUND_COMPLETED` = hoàn tiền xong; `TICKET_ISSUED` = vé đã phát. Ví dụ: sau khi Movie xác nhận ghế `SOLD` và vé được tạo, outbox ghi `BOOKING_CONFIRMED` để Notification Service gửi thông báo. | `API` Published Events |
| `schema_version` | Phiên bản cấu trúc nội dung sự kiện. Dịch vụ nhận dựa vào đây để chọn cách đọc đúng khi cấu trúc sự kiện được nâng cấp. Ví dụ: `schema_version = "1"` khiến dịch vụ nhận giải mã nội dung theo lược đồ phiên bản 1. | `API` event envelope |
| `correlation_id` | Mã liên kết sự kiện sắp phát với toàn bộ luồng đặt/hủy vé. Dịch vụ nhận sự kiện có thể dùng cùng mã để ghi log, giúp truy vết xuyên nhiều dịch vụ. Ví dụ: sự kiện xác nhận đơn giữ `correlation_id = "corr_bkg_7f3a_payment_01"` giống sự kiện thanh toán đã gây ra nó. | `SC-64` |
| `causation_id` | Mã của yêu cầu hoặc sự kiện trực tiếp gây ra sự kiện này. Ví dụ sự kiện `PAYMENT_SUCCEEDED` có thể là nguyên nhân tạo sự kiện `BOOKING_CONFIRMED`; cột này giúp thấy quan hệ nguyên nhân–kết quả. | Event traceability |
| `partition_key` | Khóa phân vùng Kafka, thường là mã đơn, để các sự kiện của cùng đơn được xử lý theo đúng thứ tự. Ví dụ: `partition_key = "bkg_7f3a"` đưa mọi sự kiện của đơn `bkg_7f3a` vào cùng một phân vùng. | Reliable event delivery |
| `payload` | Bản chụp nội dung sự kiện không sửa lại, đã loại bí mật và thông tin nhận dạng cá nhân không cần thiết; đây là dữ liệu thực tế được gửi cho dịch vụ khác. Ví dụ: `payload = {"bookingId":"bkg_7f3a","amount":250000}` sau khi đã loại token và dữ liệu thẻ. | `BR` Security/Event Rules; `SC-61` |
| `publish_status` | Trạng thái phát sự kiện: `PENDING` = chờ gửi; `PUBLISHING` = worker đang gửi; `PUBLISHED` = hệ thống nhận sự kiện đã xác nhận; `FAILED` = lần gửi lỗi và còn có thể thử lại; `DEAD_LETTER` = thử quá giới hạn hoặc lỗi không tự sửa được. Ví dụ: Kafka tạm ngắt khiến bản ghi thành `FAILED`, đến `next_attempt_at` sẽ gửi lại; lỗi lặp quá giới hạn chuyển `DEAD_LETTER`. | `SC-63` |
| `attempt_count` | Số lần tiến trình phát sự kiện đã thử gửi. Ví dụ: `attempt_count = 3`: tác vụ đã lỗi ba lần, lần tiếp theo sẽ chờ lâu hơn hoặc chuyển kiểm tra thủ công. | Retry/backoff |
| `next_attempt_at` | Thời điểm được phép thử gửi lại. Ví dụ: `next_attempt_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `SC-63` |
| `occurred_at` | Thời điểm nghiệp vụ/kỹ thuật mà sự kiện được tạo theo giờ UTC. Ví dụ: `occurred_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `PI BK-P1-04` |
| `published_at` | Thời điểm sự kiện được phát thành công theo giờ UTC. Ví dụ: `published_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Outbox latency metric |
| `last_error` | Lỗi phát sự kiện gần nhất, dùng cảnh báo và xử lý lại. Ví dụ: `last_error = "Movie Service timeout after 3s"`: đủ để điều tra nhưng không chứa token bí mật. | `SC-63`, `SC-64` |

---

## 16. `booking_reconciliation`

### Công dụng

Case lưu mismatch giữa booking, payment reference, inventory và ticket. Controller chỉ mở case/evidence; worker hoặc policy được duyệt mới retry/compensate (`FB` Employee Operations; `BR` Reconciliation Rules; `API` reconciliation APIs; `SC-15`, `SC-19`, `SC-53`–`SC-55`; `PI BK-P1-03C/P2-02`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `reconciliation_id` | Mã duy nhất của hồ sơ đối soát, dùng tra cứu và ghi các lần xử lý liên quan. Ví dụ: `reconciliation_id = "booking-reconciliation-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `API` reconciliation resource |
| `booking_id` | Mã đơn liên quan, được phép để trống nếu hồ sơ/sự kiện chưa ghép được với đơn. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | Mismatch investigation |
| `case_type` | Loại sai lệch, nên đặt tên thể hiện hai trạng thái không khớp, ví dụ `PAYMENT_SUCCEEDED_INVENTORY_NOT_SOLD` = tiền thành công nhưng ghế chưa bán, `REFUND_SUCCEEDED_BOOKING_NOT_CANCELLED` = tiền đã hoàn nhưng đơn chưa hủy. Dùng chọn quy trình kiểm tra/sửa phù hợp. | `PI BK-P1-03C` |
| `severity` | Mức ảnh hưởng để ưu tiên xử lý, ví dụ `LOW` = không ảnh hưởng tiền/ghế ngay, `MEDIUM` = cần kiểm tra sớm, `HIGH` = có nguy cơ mất tiền hoặc giữ ghế sai, `CRITICAL` = nhiều khách/giao dịch bị ảnh hưởng. Ví dụ: đã thu tiền nhưng chưa có ghế nên là `HIGH` hoặc `CRITICAL` theo phạm vi. | `PI BK-P1-03C/P2-02` |
| `reconciliation_status` | Trạng thái hồ sơ đối soát: `OPEN` = mới mở/chưa ai xử lý; `IN_PROGRESS` = worker hoặc nhân viên đang kiểm tra; `RESOLVED` = sai lệch đã được sửa; `MANUAL_REVIEW` = hệ thống không thể tự quyết định và cần người duyệt; `CLOSED` = hồ sơ đã được xác nhận kết thúc/không còn hành động. Ví dụ: tiền thành công nhưng ghế chưa bán tạo hồ sơ `OPEN`; nhân viên nhận xử lý thành `IN_PROGRESS`; xác nhận lại ghế thành công thì `RESOLVED`, sau kiểm tra có thể `CLOSED`. | `SC-54`, `SC-55` |
| `payment_reference` | Mã thanh toán cần so sánh với Payment Service để xác định tiền thật sự thành công, thất bại hay đã hoàn. Ví dụ: `payment_reference = "pay_20260726_001"`: sự kiện có mã khác phải bị từ chối hoặc đưa đi đối soát. | `SC-15`, `SC-53` |
| `hold_reference` | Mã giữ ghế cần so sánh với Movie Service để xác định ghế còn giữ, đã bán hay đã nhả. Ví dụ: `hold_reference = "hold:bkg_7f3a"`: mọi lần giữ, xác nhận hoặc nhả ghế của đơn đều dùng mã này. | `SC-18`, `SC-19` |
| `cluster_id` | Mã số cụm rạp của sự cố, dùng giới hạn chỉ nhân viên đúng cụm được xem và xử lý. Ví dụ: `cluster_id = 12` giới hạn hồ sơ đối soát cho đội phụ trách cụm 12. | `SC-50`, `SC-51`, `SC-54` |
| `evidence` | Bằng chứng được lưu thành JSON, ví dụ trạng thái Booking/Payment/Movie tại lúc phát hiện lệch. Dữ liệu client cung cấp chỉ hỗ trợ điều tra, không tự được coi là kết quả chính thức. | `BR` Employee Rules; `SC-54` |
| `owner_id` | Mã nhân viên hoặc đội đang chịu trách nhiệm xử lý hồ sơ, tránh không ai nhận hoặc nhiều người làm trùng. Ví dụ: `owner_id = "ops-team-1"`: đội vận hành số 1 đang chịu trách nhiệm hồ sơ. | `PI BK-P2-02` |
| `created_by` | Mã người hoặc dịch vụ đã mở hồ sơ đối soát, dùng truy trách nhiệm và nguồn phát hiện. Ví dụ: `created_by = "acc_1024"` khi khách tạo đơn hoặc `"emp_204"` khi bán tại quầy. | Audit |
| `correlation_id` | Mã liên kết hồ sơ đối soát với sự kiện đã nhận, tác vụ bù trừ và sự kiện đã phát. Nhân viên dùng mã này mở toàn bộ bằng chứng của cùng một sự cố thay vì tìm riêng từng bảng. Ví dụ: hồ sơ “đã thu tiền nhưng chưa bán ghế” dùng `correlation_id = "corr_bkg_7f3a_payment_01"` để tìm sự kiện tiền và lời gọi Movie liên quan. | `SC-64` |
| `idempotency_key` | Khóa chống tạo hồ sơ trùng; cùng một yêu cầu phát hiện sai lệch chỉ mở một hồ sơ đối soát. Ví dụ: `idempotency_key = "booking_reconciliation:req_001"`: gửi lại cùng yêu cầu phải trả kết quả cũ, không tạo tác dụng lần hai. | `SC-54` |
| `version` | Số phiên bản ngăn tiến trình nền và nhân viên cùng cập nhật rồi ghi đè kết quả xử lý của nhau. Ví dụ: `version = 4`: luồng cập nhật với phiên bản 3 sẽ bị từ chối vì dữ liệu đã đổi. | Reliability |
| `created_at` | Thời điểm hồ sơ đối soát được mở theo giờ UTC. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit/alert |
| `updated_at` | Thời điểm hồ sơ đối soát được cập nhật gần nhất theo giờ UTC. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Stuck-case alert |

---

## 17. `booking_reconciliation_attempt`

### Công dụng

Mỗi retry/manual action trên reconciliation case được lưu thành attempt riêng để không bypass state machine và có before/after audit (`BR` Employee Rules; `API` reconciliation-attempt API; `SC-55`; `PI BK-P1-03C/P2-02`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `attempt_id` | Mã duy nhất của một lần thử xử lý. Ví dụ: `attempt_id = "booking-reconciliation-attempt-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `SC-55` |
| `reconciliation_id` | Mã hồ sơ đối soát cha; dữ liệu lần thử được xóa cùng hồ sơ cha theo ràng buộc cơ sở dữ liệu. Ví dụ: lần thử `attempt_001` có `reconciliation_id = "recon_001"` để xuất hiện trong lịch sử xử lý của hồ sơ `recon_001`. | Reconciliation relationship |
| `action_type` | Loại hành động đối soát, ví dụ `QUERY_PAYMENT` = hỏi lại Payment Service, `QUERY_INVENTORY` = hỏi lại Movie Service, `RETRY_CONFIRM` = thử xác nhận bán ghế, `REQUEST_REFUND` = yêu cầu hoàn tiền, `RELEASE_INVENTORY` = nhả ghế. Ví dụ: tiền đã thành công nhưng ghế chưa rõ thì chọn `QUERY_INVENTORY` trước khi quyết định hoàn tiền. | `SC-55` |
| `attempt_status` | Trạng thái một lần xử lý: `QUEUED` = đã xếp hàng; `PROCESSING` = đang chạy; `SUCCEEDED` = hành động thành công; `FAILED` = hành động lỗi; `BLOCKED` = chưa được phép chạy vì thiếu quyền, dữ liệu hoặc điều kiện. Ví dụ: yêu cầu hoàn tiền chưa được quản trị viên duyệt thì để `BLOCKED`, không tự gọi Payment Service. | `API` operation attempt |
| `reason` | Lý do nhân viên vận hành bắt buộc phải nhập khi yêu cầu hành động. Ví dụ: `reason = "Khách yêu cầu hủy trước giờ chiếu 3 giờ"`: đủ rõ để nhân viên kiểm tra nhưng không chứa dữ liệu thẻ. | `SC-55` |
| `requested_by` | Mã nhân viên, quản trị viên hoặc người vận hành yêu cầu hành động. Ví dụ: `requested_by = "emp_204"`: nhân viên này đã yêu cầu lần xử lý đối soát. | Security/audit |
| `before_snapshot` | Bản chụp trạng thái trước lần xử lý. Ví dụ: `before_snapshot = {"bookingStatus":"CONFIRMED"}` trước khi nhân viên hủy. | `BR` manual action audit |
| `after_snapshot` | Bản chụp trạng thái sau lần xử lý. Ví dụ: `after_snapshot = {"bookingStatus":"CANCEL_REQUESTED"}` sau khi nhận thao tác hủy. | `SC-55` |
| `idempotency_key` | Yêu cầu thử lại bị gửi lặp không được tạo thêm một lần xử lý trùng. Ví dụ: `idempotency_key = "booking_reconciliation_attempt:req_001"`: gửi lại cùng yêu cầu phải trả kết quả cũ, không tạo tác dụng lần hai. | Idempotency |
| `last_error` | Lỗi gần nhất của lần xử lý. Ví dụ: `last_error = "Movie Service timeout after 3s"`: đủ để điều tra nhưng không chứa token bí mật. | Operations |
| `created_at` | Thời điểm lần xử lý được xếp hàng theo giờ UTC. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit |
| `updated_at` | Thời điểm lần xử lý đổi trạng thái gần nhất theo giờ UTC. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Polling/metrics |

---

## 18. `counter_payment`

### Công dụng

Immutable receipt/collection record cho bán vé tại quầy. Đây là audit record thuộc counter-sale flow của Booking Service, không phải online payment/provider ledger thuộc Payment Service (`FB` Employee Operations; `BR` Counter Rules; `API` counter booking; `SC-52`, `SC-53`; `PI BK-P1-03B`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `counter_payment_id` | Mã duy nhất của bản ghi thu tiền tại quầy. Ví dụ: `counter_payment_id = "counter-payment-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `PI BK-P1-03B` |
| `booking_id` | Quan hệ một-một với đơn bán tại quầy. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | `SC-52` |
| `payment_reference` | Mã thu tiền cố định do luồng bán tại quầy/máy POS tạo; không phải khóa ngoại tới Payment Service. Ví dụ: `payment_reference = "counter-pay-TD-001"` giúp gửi lại yêu cầu sau khi POS mất mạng mà không ghi nhận thu tiền hai lần. | `BR` immutable ledger/reference |
| `receipt_reference` | Mã biên nhận để in, tra cứu hoặc tiếp tục xử lý khi máy POS mất kết nối. Ví dụ: `receipt_reference = "RCPT-TD-000123"`: nhân viên dùng mã này in lại biên nhận tại quầy. | `SC-52`; `PI BK-P1-03B` |
| `cashier_id` | Mã nhân viên đã trực tiếp thu tiền. Ví dụ: `cashier_id = "emp_cashier_12"`: nhân viên thu tiền cho giao dịch tại quầy. | `SC-52` |
| `terminal_id` | Mã máy POS; máy phải thuộc đúng cụm rạp được cấp quyền. Ví dụ: `terminal_id = "POS-TD-04"`: máy POS số 4 tại cụm Thủ Đức. | `SC-52`, `SC-53` |
| `cluster_id` | Mã số cụm rạp của giao dịch, máy POS và nhân viên. Ví dụ: `cluster_id = 12` yêu cầu cả `terminal_id` và `cashier_id` đều được cấp quyền ở cụm 12. | `SC-51`, `SC-52` |
| `payment_method` | Phương thức thu tiền tại quầy, ví dụ `CASH` = tiền mặt, `CARD` = thẻ qua máy POS, hoặc mã phương thức khác đã được hệ thống phê duyệt. Đây là bản chụp để in/đối chiếu biên nhận. Ví dụ: khách đưa tiền mặt thì lưu `CASH`; không lưu số thẻ. | `BR` Counter Rules |
| `amount` | Số tiền thực tế đã thu và không được sửa lại sau khi ghi nhận. Ví dụ: `amount = 250000`: số tiền thanh toán/hoàn phải khớp số tiền cuối của đơn. | `SC-52`, `SC-53` |
| `currency` | Đơn vị tiền tệ trên biên nhận tại quầy. Ví dụ: `currency = "VND"`: `250000` được hiểu là 250.000 đồng, không phải USD. | Pricing/audit |
| `collected_at` | Thời điểm nhân viên thu tiền theo giờ UTC. Ví dụ: `collected_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `PI BK-P1-03B` |
| `created_at` | Thời điểm bản ghi được lưu bền vững theo giờ UTC. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit |

---

## 19. `booking_quote`

### Công dụng

Pricing quote P2 có expiry; quote tính line items/promotion/fees nhưng không giữ ghế. Booking tạo từ quote vẫn phải reserve inventory authoritative (`FB` Commercial Extensions; `BR` Promotion Rules; `API` quote APIs; `SC-56`, `SC-57`; `PI BK-P2-01A`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `quote_id` | Mã duy nhất của báo giá, được dùng khi tạo đơn đặt vé. Ví dụ: `quote_id = "booking-quote-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | `API` quoteId |
| `account_id` | Mã tài khoản sở hữu; tài khoản khác không được dùng báo giá này. Ví dụ: `account_id = "acc_1024"`: tài khoản `acc_1024` chỉ được xem hoặc hủy đơn của chính mình. | `SC-57` |
| `showtime_id` | Mã số suất chiếu mà báo giá áp dụng. Ví dụ: `showtime_id = 20260726193001` nghĩa là báo giá không được dùng cho một suất khác. | `SC-56`, `SC-57` |
| `subtotal` | Tổng tiền trước khi trừ giảm giá và cộng phí. Ví dụ: `subtotal = 300000`: tổng các dòng trước giảm giá và phí. | `SC-56` |
| `discount_amount` | Tổng tiền giảm từ khuyến mãi và điểm thành viên trong báo giá. Ví dụ: `discount_amount = 50000`: mã `SUMMER50` giảm 50.000 đồng. | `SC-56` |
| `fee_amount` | Tổng phí được áp dụng theo chính sách giá. Ví dụ: `fee_amount = 10000`: phí đặt vé trực tuyến 10.000 đồng. | `PI BK-P2-01A` |
| `final_amount` | Số tiền cuối sau khi cộng/trừ từng thành phần; không được âm. Ví dụ: `final_amount = 260000`: 300.000 - 50.000 + 10.000 đồng. | `SC-56` |
| `currency` | Đơn vị tiền tệ và quy tắc làm tròn áp dụng cho báo giá. Ví dụ: `currency = "VND"`: `250000` được hiểu là 250.000 đồng, không phải USD. | `BR` Pricing Rules |
| `quote_status` | Trạng thái báo giá: `ACTIVE` = còn hiệu lực và có thể dùng tạo đơn; `CONSUMED` = đã dùng để tạo đơn; `EXPIRED` = quá `expires_at`; `CANCELLED` = bị hủy/không còn được dùng. Ví dụ: tạo đơn thành công từ báo giá thì chuyển `ACTIVE` sang `CONSUMED`; gửi lại cùng báo giá không tạo đơn thứ hai. | `SC-57` |
| `request_hash` | Giá trị băm dùng chống tạo lặp và kiểm tra cùng dữ liệu đầu vào báo giá. Ví dụ: `request_hash = "sha256:ab12..."`: cùng idempotency key nhưng hash khác phải trả `409 Conflict`. | Reliable quote creation |
| `expires_at` | Thời điểm báo giá hết hạn, độc lập với thời điểm giữ ghế hết hạn. Ví dụ: `expires_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | `BR` Promotion Rules; `SC-56` |
| `created_at` | Thời điểm tạo báo giá theo giờ UTC. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit |

---

## 20. `booking_quote_item`

### Công dụng

Line-item snapshot của quote cho seat, promotion, concession hoặc fee. Nó cho phép response breakdown và chuyển snapshot sang booking/receipt/refund (`SC-56`, `SC-57`; `PI BK-P2-01A/P2-01C`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `quote_item_id` | Mã duy nhất của dòng chi tiết báo giá. Ví dụ: `quote_item_id = "booking-quote-item-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | Quote breakdown |
| `quote_id` | Mã báo giá cha chứa dòng chi tiết này. Ví dụ: dòng ghế `quote_item_001` có `quote_id = "quote_001"` để tổng hợp vào đúng báo giá `quote_001`. | Quote relationship |
| `item_type` | Loại dòng báo giá: `SEAT` = ghế; `CONCESSION` = đồ ăn/uống; `PROMOTION` = khoản giảm do khuyến mãi; `FEE` = phí. Ví dụ: hai ghế, một bắp và mã giảm giá tạo các dòng `SEAT`, `CONCESSION`, `PROMOTION` riêng để thấy cách ra tổng tiền. | `SC-56`, `SC-59` |
| `external_item_id` | Mã ghế, mã sản phẩm hoặc mã khuyến mãi do dịch vụ sở hữu dữ liệu cấp. Ví dụ: `external_item_id = "seat-show-01-A10"` cho dòng ghế hoặc `"POPCORN-L"` cho dòng đồ ăn. | Cross-service ownership |
| `item_name` | Bản chụp tên hiển thị không thay đổi theo dữ liệu nguồn về sau. Ví dụ: `item_name = "Bắp rang cỡ lớn"`: tên này được giữ trên biên nhận dù danh mục đổi. | History/receipt |
| `quantity` | Số lượng mặt hàng; ràng buộc phải lớn hơn 0. Ví dụ: `quantity = 2`: khách mua hai phần của mặt hàng này. | `SC-59` |
| `unit_price` | Giá một đơn vị lấy từ dịch vụ có quyền quyết định giá. Ví dụ: `unit_price = 150000`: giá một ghế/món trước giảm giá. | Pricing |
| `discount_amount` | Số tiền giảm được phân bổ cho dòng chi tiết. Ví dụ: `discount_amount = 50000`: mã `SUMMER50` giảm 50.000 đồng. | Refund allocation |
| `final_amount` | Tổng tiền của dòng sau giảm giá. Ví dụ: `final_amount = 260000`: 300.000 - 50.000 + 10.000 đồng. | `SC-56` |

---

## 21. `promotion_reservation`

### Công dụng

Booking-side reference/snapshot cho promotion quota reservation do Promotion Service sở hữu. Booking không tự sửa quota (`FB` Commercial Extensions; `BR` Promotion Rules; `SC-56`, `SC-57`; `PI BK-P2-01A`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `promotion_reservation_id` | Mã duy nhất của bản ghi trong Booking Service. Ví dụ: `promotion_reservation_id = "promotion-reservation-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | Promotion orchestration |
| `booking_id` | Mã đơn đang áp dụng khuyến mãi. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | `SC-57` |
| `promotion_id` | Mã khuyến mãi do Promotion Service quản lý. Ví dụ: `promotion_id = "promo_summer_50"`: tham chiếu chương trình ở Promotion Service. | Ownership |
| `promotion_code` | Bản chụp mã khuyến mãi dùng trên biên nhận và lịch sử. Ví dụ: `promotion_code = "SUMMER50"`: mã giảm giá được giữ lại trên lịch sử/biên nhận. | Promotion checkout |
| `external_reservation_id` | Mã lần giữ hạn mức do Promotion Service cấp. Ví dụ: `external_reservation_id = "reserve_ext_456"`: dùng commit, release hoặc hỏi lại đúng lần giữ ở dịch vụ sở hữu. | `PI BK-P2-01A` |
| `discount_amount` | Số tiền giảm đã được giữ hoặc chốt cho đơn. Ví dụ: `discount_amount = 50000`: mã `SUMMER50` giảm 50.000 đồng. | `SC-56` |
| `reservation_status` | Trạng thái giữ khuyến mãi: `RESERVED` = hạn mức đã được tạm giữ; `COMMITTED` = đã dùng chính thức khi đơn xác nhận; `RELEASED` = đã trả lại hạn mức khi đơn hủy/hết hạn; `UNKNOWN` = chưa biết kết quả từ Promotion Service. Ví dụ: vừa áp mã là `RESERVED`; thanh toán và xác nhận đơn thành công thì `COMMITTED`. | `BR` Promotion Rules |
| `expires_at` | Thời điểm lần giữ hạn mức khuyến mãi hết hạn. Ví dụ: `expires_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Promotion compensation |
| `idempotency_key` | Khóa cố định ngăn giữ, chốt hoặc trả hạn mức khuyến mãi hai lần. Ví dụ: `idempotency_key = "promotion_reservation:req_001"`: gửi lại cùng yêu cầu phải trả kết quả cũ, không tạo tác dụng lần hai. | `SC-57` |
| `created_at` | Thời điểm lần giữ được lưu theo giờ UTC. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit |
| `updated_at` | Thời điểm trạng thái được cập nhật gần nhất theo giờ UTC. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Retry/reconciliation |

---

## 22. `loyalty_reservation`

### Công dụng

Booking-side reference/snapshot của điểm đã reserve tại User Service. Booking không sở hữu hoặc trực tiếp cộng/trừ balance (`FB` Ownership/Commercial Extensions; `BR` Loyalty Rules; `SC-58`; `PI BK-P2-01B`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `loyalty_reservation_id` | Mã duy nhất của bản ghi trong Booking Service. Ví dụ: `loyalty_reservation_id = "loyalty-reservation-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | Loyalty orchestration |
| `booking_id` | Quan hệ một-một với đơn sử dụng lần giữ điểm. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | `SC-58` |
| `external_reservation_id` | Mã lần giữ điểm do User Service cấp, dùng chốt điểm, trả điểm hoặc hỏi lại kết quả. Ví dụ: `external_reservation_id = "loyalty-reserve-456"` được giữ nguyên khi Booking yêu cầu chốt 200 điểm sau khi đơn xác nhận. | `PI BK-P2-01B` |
| `points_reserved` | Số điểm đã được tạm giữ theo chính sách điểm thành viên. Ví dụ: `points_reserved = 200`: 200 điểm bị tạm khóa đến khi đơn xác nhận hoặc hủy. | `SC-58` |
| `discount_amount` | Bản chụp giá trị quy đổi sang VND của số điểm. Ví dụ: `discount_amount = 50000`: mã `SUMMER50` giảm 50.000 đồng. | Pricing/refund |
| `reservation_status` | Trạng thái giữ điểm: `RESERVED` = User Service đã tạm khóa điểm; `COMMITTED` = điểm đã bị trừ chính thức; `RELEASED` = điểm đã được mở khóa/trả lại; `UNKNOWN` = chưa xác định kết quả. Ví dụ: đơn hết hạn trước thanh toán thì chuyển từ `RESERVED` sang `RELEASED`. | `BR` Loyalty Rules |
| `expires_at` | Thời điểm lần giữ điểm hết hạn do User Service trả về. Ví dụ: `expires_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Compensation |
| `idempotency_key` | Khóa cố định ngăn giữ, chốt hoặc trả điểm hai lần. Ví dụ: `idempotency_key = "loyalty_reservation:req_001"`: gửi lại cùng yêu cầu phải trả kết quả cũ, không tạo tác dụng lần hai. | `SC-58` |
| `created_at` | Thời điểm lần giữ được lưu theo giờ UTC. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit |
| `updated_at` | Thời điểm trạng thái được cập nhật gần nhất theo giờ UTC. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Retry |

---

## 23. `booking_concession_item`

### Công dụng

Immutable concession line-item và external stock reservation reference. Booking không sở hữu concession stock (`FB` Commercial Extensions; `BR` Concession Rules; `SC-59`; `PI BK-P2-01C`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `concession_item_id` | Mã duy nhất của dòng chi tiết trong hệ thống. Ví dụ: `concession_item_id = "booking-concession-item-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | Concession orchestration |
| `booking_id` | Mã đơn chứa đồ ăn/uống bán kèm. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | `SC-59` |
| `sku` | Mã sản phẩm do dịch vụ đồ ăn/uống quản lý. Ví dụ: `sku = "POPCORN-L"`: mã sản phẩm bắp rang cỡ lớn. | `BR` Concession Rules |
| `item_name` | Bản chụp tên sản phẩm không thay đổi, dùng trên biên nhận và lịch sử. Ví dụ: `item_name = "Bắp rang cỡ lớn"`: tên này được giữ trên biên nhận dù danh mục đổi. | `SC-59` |
| `quantity` | Số lượng món; ràng buộc phải lớn hơn 0. Ví dụ: `quantity = 2`: khách mua hai phần của mặt hàng này. | `SC-59` |
| `unit_price` | Giá một đơn vị do dịch vụ sở hữu sản phẩm quyết định. Ví dụ: `unit_price = 150000`: giá một ghế/món trước giảm giá. | Pricing |
| `discount_amount` | Số tiền giảm được phân bổ cho món ăn/uống. Ví dụ: `discount_amount = 50000`: mã `SUMMER50` giảm 50.000 đồng. | Refund breakdown |
| `final_amount` | Tổng tiền dòng món sau giảm giá. Ví dụ: `final_amount = 260000`: 300.000 - 50.000 + 10.000 đồng. | Receipt/refund |
| `fulfillment_cluster_id` | Mã số cụm rạp phải giao/chuẩn bị món. Ví dụ: `fulfillment_cluster_id = 12` nghĩa là bắp/nước phải được chuẩn bị tại cụm 12, không chuyển nhầm sang rạp khác. | `BR` cluster validation; `SC-59` |
| `external_reservation_id` | Mã lần giữ tồn kho do dịch vụ sở hữu đồ ăn/uống cấp. Ví dụ: `external_reservation_id = "reserve_ext_456"`: dùng commit, release hoặc hỏi lại đúng lần giữ ở dịch vụ sở hữu. | `PI BK-P2-01C` |
| `reservation_status` | Trạng thái giữ tồn kho đồ ăn/uống: `RESERVED` = đã giữ hàng; `COMMITTED` = đơn xác nhận và hàng được chốt để chuẩn bị; `RELEASED` = đã trả lại tồn kho; `UNKNOWN` = chưa biết dịch vụ kho đã xử lý hay chưa. Ví dụ: hủy đơn trước khi chuẩn bị món sẽ đổi `RESERVED` thành `RELEASED`. | `BR` Concession Rules |
| `idempotency_key` | Khóa cố định ngăn thao tác giữ/chốt/trả tồn kho bị thực hiện hai lần. Ví dụ: `idempotency_key = "booking_concession_item:req_001"`: gửi lại cùng yêu cầu phải trả kết quả cũ, không tạo tác dụng lần hai. | `SC-59` |
| `created_at` | Thời điểm dòng món được lưu theo giờ UTC. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit |
| `updated_at` | Thời điểm trạng thái chuẩn bị món hoặc giữ tồn kho thay đổi gần nhất theo giờ UTC. Ví dụ: `updated_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Retry |

---

## 24. `booking_audit_log`

### Công dụng

Append-oriented audit cho manual/employee/admin/system action. Không dùng audit log thay thế state machine; nó lưu actor, reason và before/after để điều tra/reconciliation (`FB` Employee Operations; `BR` Employee/Security Rules; `SC-35`, `SC-36`, `SC-52`–`SC-55`, `SC-61`; `PI BK-P1-03A/B/C`, `BK-P2-02`).

| Cột | Công dụng | Nguồn/Yêu cầu |
|---|---|---|
| `audit_id` | Mã duy nhất của một dòng nhật ký kiểm tra. Ví dụ: `audit_id = "booking-audit-log-001"`: mã này xác định đúng bản ghi trong ví dụ và được bảng liên quan tham chiếu. | Audit requirement |
| `booking_id` | Mã đơn liên quan, được phép để trống nếu hồ sơ/sự kiện chưa ghép được với đơn. Ví dụ: `booking_id = "bkg_7f3a"`: cùng mã này xuất hiện ở chi tiết ghế, vé, hoàn tiền và nhật ký của một đơn. | Operation trace |
| `action` | Tên hành động đã thực hiện, ví dụ `CANCEL_OVERRIDE` = nhân viên hủy theo quyền đặc biệt, `RETRY_CONFIRM` = thử xác nhận ghế lại, `CHECK_IN_REJECTED` = từ chối soát vé. Dùng lọc nhật ký theo loại thao tác. Ví dụ: nhân viên hủy sau hạn theo quyền quản lý thì ghi `CANCEL_OVERRIDE`. | `SC-36`, `SC-55` |
| `actor_id` | Mã người hoặc hệ thống thực hiện hành động. Ví dụ: `actor_id = "emp_204"`: xác định nhân viên 204 là người thực hiện thao tác. | Security/audit |
| `actor_type` | Loại chủ thể thực hiện: `MEMBER` = khách/thành viên; `EMPLOYEE` = nhân viên rạp; `ADMIN` = quản trị viên; `SERVICE` = dịch vụ khác gọi; `SYSTEM` = tiến trình tự động nội bộ. Ví dụ: scheduler tự làm hết hạn đơn thì ghi `SYSTEM`, còn nhân viên hủy thay khách ghi `EMPLOYEE`. | Namespace separation |
| `reason` | Lý do thực hiện hành động; bắt buộc theo chính sách đối với thao tác vận hành. Ví dụ: `reason = "Khách yêu cầu hủy trước giờ chiếu 3 giờ"`: đủ rõ để nhân viên kiểm tra nhưng không chứa dữ liệu thẻ. | `SC-36`, `SC-55` |
| `before_snapshot` | Bản chụp trạng thái an toàn trước hành động, đã loại dữ liệu nhạy cảm. Ví dụ: `before_snapshot = {"bookingStatus":"CONFIRMED"}` trước khi nhân viên hủy. | `BR` Manual Action Rules |
| `after_snapshot` | Bản chụp trạng thái an toàn sau hành động, đã loại dữ liệu nhạy cảm. Ví dụ: `after_snapshot = {"bookingStatus":"CANCEL_REQUESTED"}` sau khi nhận thao tác hủy. | `BR` Manual Action Rules |
| `correlation_id` | Mã liên kết dòng nhật ký với yêu cầu API, sự kiện, tác vụ nền hoặc hồ sơ đối soát đã gây ra thay đổi. Dùng tìm tất cả hành động của cùng một luồng khi điều tra. Ví dụ: dòng nhật ký nhân viên hủy đơn dùng `correlation_id = "corr_bkg_7f3a_cancel_01"` giống yêu cầu hủy và hoàn tiền tương ứng. | `SC-64` |
| `created_at` | Thời điểm dòng nhật ký được ghi thêm theo giờ UTC. Ví dụ: `created_at = 2026-07-26T19:35:00+07:00`: mốc này cho biết chính xác thời điểm sự kiện xảy ra. | Audit/retention |

---

## 25. Những bảng cố ý không tồn tại

| Bảng không có | Lý do |
|---|---|
| `seat_lock` | Movie Service là inventory owner duy nhất; Booking chỉ lưu `inventory_reservation`. |
| `showtime`, `seat`, `movie`, `cinema_room` | Thuộc Movie Service; Booking chỉ lưu external ID và immutable snapshot. |
| `payment_transaction`, `payment_ledger`, provider/card tables | Thuộc Payment Service; Booking chỉ lưu `payment_reference`, status snapshot, event inbox và refund orchestration reference. |
| `member/account`, loyalty balance | Thuộc User Service. |
| `promotion_rule/quota` | Thuộc Promotion Service. |
| `concession_stock/catalog` | Thuộc service sở hữu concession. |
| `notification_delivery` | Thuộc Notification Service; Booking publish qua outbox. |

## 26. Traceability theo nhóm scenario

| Scenario | Bảng chính |
|---|---|
| `SC-01`–`SC-11` Create/idempotency/concurrency | `booking`, `booking_item`, `inventory_reservation`, `booking_operation`, `compensation_task`, `outbox_event` |
| `SC-12`–`SC-19` Payment/confirmation | `booking`, `payment_event_inbox`, `inventory_reservation`, `ticket`, `booking_refund`, `booking_reconciliation`, `outbox_event` |
| `SC-20`–`SC-24` Expiry/late payment | `booking`, `inventory_reservation`, `payment_event_inbox`, `booking_refund`, `compensation_task`, `outbox_event` |
| `SC-25`–`SC-39` Cancellation/refund | `booking_cancellation`, `booking_refund`, `booking`, `inventory_reservation`, `ticket`, `booking_ticket_pass`, `payment_event_inbox`, `booking_audit_log` |
| `SC-40`–`SC-46` Ticket/check-in | `ticket`, `booking_ticket_pass`, `ticket_check_in`, `booking_audit_log` |
| `SC-47`–`SC-49` Customer history | `booking`, `booking_item`, `ticket`, `booking_refund` |
| `SC-50`–`SC-55` Operations/counter/reconciliation | `booking`, `counter_payment`, `booking_reconciliation`, `booking_reconciliation_attempt`, `booking_audit_log` |
| `SC-56`–`SC-59` Promotion/loyalty/concession | `booking_quote`, `booking_quote_item`, `promotion_reservation`, `loyalty_reservation`, `booking_concession_item` |
| `SC-60`–`SC-61` Security/secrets | Mọi bảng; đặc biệt `booking_ticket_pass`, `inventory_reservation`, `booking_audit_log` |
| `SC-62`–`SC-64` Restart/reliability/observability | `booking_operation`, `payment_event_inbox`, `compensation_task`, `outbox_event`, `booking_reconciliation` |

## 27. Lưu ý triển khai

* Flyway tạo schema; Hibernate dùng `ddl-auto=validate`, không tự sửa production schema.
* Raw `hold_token`, raw QR token, provider secret, signature và card data không được đưa vào response/log/event/audit.
* Các cột `payload`, `evidence`, `before_snapshot`, `after_snapshot`, `response_snapshot` phải dùng JSON đã sanitize và có schema/version ở application layer.
* Index/constraint bảo vệ persistence invariant nhưng không thay thế application state machine, authorization hoặc idempotent downstream contract.
* External reference không được biến thành foreign key cross-service.
