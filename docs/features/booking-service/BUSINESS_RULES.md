# BUSINESS_RULES.md

## 1. Source Document Reviewed

* `docs/feature/booking-service/BOOKING_SERVICE_PRODUCT_ISSUES.md`

> Đây là bộ rule của target design. Các rule phải được xác nhận bằng implementation, migration, contract test và concurrency test trước khi coi là production-ready.

## 2. General Rules

* Movie Service là nguồn truth duy nhất cho seat inventory, price và hold TTL; Booking Service không tạo authoritative `seat_lock`.
* Booking Service sở hữu order, snapshot, state machine, ticket, idempotency, inbox/outbox, compensation và reconciliation.
* Client không được gửi dữ liệu authoritative như `accountId`, movie/cinema, giá, TTL, refund amount hoặc trạng thái đích.
* Mọi mutation có thể retry phải idempotent. Scope unique tối thiểu là `callerScope + operation + idempotencyKey` và phải lưu canonical request hash.
* Cùng key/cùng request trả cùng operation/result; cùng key/khác request trả `409`.
* Timeout hoặc mất response là trạng thái chưa xác định; không tự chuyển payment/refund thành failed và không tạo retry bằng key mới.
* Mọi partial failure phải có forward recovery, compensation hoặc reconciliation state được persist.
* Timestamp kỹ thuật dùng UTC (`TIMESTAMPTZ`, `Instant`/`OffsetDateTime`); amount dùng `NUMERIC`, không dùng floating point.
* Không có cross-database foreign key; chỉ lưu external reference và immutable transaction snapshot.
* Public/member, operations và internal service API phải tách namespace và authorization.

## 3. Booking Creation Rules

### Request Rules

* Online P0 chỉ nhận `showtimeId` và `showtimeSeatIds`; `Idempotency-Key` là bắt buộc.
* `accountId` lấy từ JWT; danh sách ghế phải khác rỗng, không trùng và thuộc cùng showtime.
* Booking Service generate `bookingId/holdReference` và persist durable operation trước cross-service mutation.
* Promotion/loyalty/concession không được ghép nửa vời vào P0; chỉ mở rộng khi issue P2 tương ứng hoàn tất.

### Inventory Rules

* Reserve toàn bộ selection theo nguyên tắc all-or-nothing.
* Giá, seat code/type, movie, cluster, room, start time và expiry phải lấy từ response authoritative rồi snapshot.
* Booking chỉ được persist sau khi reserve thành công toàn bộ.
* Booking mới là `PENDING_PAYMENT`, inventory là `HELD`; create không được chuyển ghế thành `SOLD`.
* `expiresAt` của booking không được vượt quá hold expiry.
* Nếu local DB fail sau reserve, release bằng stable `holdToken + holdReference`; release fail phải tạo durable compensation.

### Pricing Rules

* `totalAmount`, discount, points và `finalAmount` được tính server-side.
* Currency/rounding phải thống nhất; `finalAmount` không âm.
* Snapshot phải đủ để xem lịch sử và tính refund mà không gọi catalog hiện tại.

### Abuse Rules

* Giới hạn active hold theo account và rate limit theo action/account/IP/device signal.
* Retry hợp lệ cùng key không bị tính là orchestration mới.

## 4. Payment & Confirmation Rules

### Payment Context Rules

* Payment Service tạo payment bằng `bookingId`, sau đó đọc owner, amount, currency và expiry qua internal Booking API.
* Chỉ service credential đúng audience/scope được đọc payment context.
* Booking đã confirmed/cancelled hoặc đã expired không còn payable.

### Payment Event Rules

* Booking chỉ tin normalized authenticated event từ Payment Service, không tin redirect/browser payload.
* Inbox unique theo `eventId`; duplicate event không confirm, issue ticket hoặc refund lần hai.
* `bookingId`, amount và currency trong event phải khớp snapshot; mismatch đi reconciliation.
* Một `paymentId` không được gắn với hai booking.
* Payment timeout giữ `paymentStatus=UNKNOWN`; không tự coi là `FAILED`.

### Confirmation Rules

* Payment success hợp lệ chuyển booking sang `CONFIRM_PENDING`, sau đó confirm authoritative inventory.
* Chỉ sau khi Movie Service trả `SOLD`, Booking mới chuyển `CONFIRMED` và issue ticket.
* Confirm retry cùng hold/booking phải trả success cũ và không tăng sold counter lần hai.
* Nếu Movie đã `SOLD` nhưng local commit/ticket fail, không release ghế; giữ durable `CONFIRM_PENDING` và forward-recover.
* Payment success nhưng hold expired/released phải tạo refund/reconciliation; không chiếm ghế khác và không im lặng mất tiền.

## 5. Expiry & Release Rules

### Expiry Trigger

* `expiresAt` lấy từ hold expiry authoritative của Movie Service; frontend và Booking Service không tự kéo dài TTL.
* Chỉ booking `PENDING_PAYMENT` đã tới `expiresAt` mới thuộc tập expiry thông thường.
* Scheduler claim theo index `(booking_status, expires_at)`, xử lý batch bằng DB lock/conditional update an toàn khi có nhiều instance.
* `CONFIRM_PENDING` không được expiry như booking chưa thanh toán; trạng thái này phải được confirm retry/query hoặc reconciliation vì tiền có thể đã thu.
* Không expire booking `CONFIRMED`, `CANCEL_REQUESTED`, `CANCELLED`, `EXPIRED` hoặc booking đang có refund workflow.

### Expiry Case Matrix

| Trường hợp tại `expiresAt` | Booking action | Inventory action | Payment/refund action | Kết quả bắt buộc |
|---|---|---|---|---|
| `PENDING_PAYMENT` + `NOT_STARTED/PENDING`, chưa có payment success | Conditional update sang `EXPIRED` | Release hold `RESERVED` bằng stable key | Không refund | `booking=EXPIRED`, `inventory=RELEASED` |
| `PENDING_PAYMENT` + `paymentStatus=FAILED` | Chuyển `EXPIRED` hoặc giữ terminal cancellation theo transition đã thắng | Release đúng một lần | Không refund | Không còn active hold |
| `PENDING_PAYMENT` + `paymentStatus=UNKNOWN/PROCESSING` | Đến hạn vẫn kết thúc quyền mua; persist audit trạng thái chưa rõ | Release/reclaim hold theo expiry contract | Query/reconcile payment bằng reference cũ | Nếu failure: giữ `EXPIRED`; nếu late success: tạo refund |
| Payment success event thắng race trước expiry update | Expiry update phải fail bằng version/status guard | Không release; bắt đầu confirm `RESERVED -> SOLD` | Tiếp tục payment-confirm flow | `CONFIRM_PENDING` rồi `CONFIRMED` hoặc compensation |
| Expiry update thắng race trước payment success | Giữ booking terminal `EXPIRED` | Release/reclaim hold | Late success tạo refund/reconciliation | Không revive booking, không giữ ghế khác |
| `CONFIRM_PENDING` tại/qua `expiresAt` | Không chuyển `EXPIRED` tự động | Query/retry confirm với cùng key | Giữ payment success authoritative | Forward-recover hoặc refund/manual review |
| `CONFIRMED` | Không làm gì | Giữ `SOLD` | Không refund tự động | Booking vẫn `CONFIRMED` |
| `CANCEL_REQUESTED` hoặc refund pending | Cancellation worker sở hữu lifecycle | Theo cancellation state machine | Retry/query refund | Scheduler expiry bỏ qua |
| Scheduler chạy lặp hoặc hai instance cùng claim | Chỉ một conditional transition thắng | Release idempotent | Không tạo task/event trùng | Trả/ghi nhận terminal state hiện có |

### Release Rules

* Release chỉ áp dụng inventory hold còn `RESERVED/HELD`; không bao giờ dùng release để đổi ghế `SOLD -> AVAILABLE`.
* Release do expiry, cancel trước thanh toán hoặc create-booking compensation phải dùng stable idempotency key riêng theo operation.
* Release timeout/mất response không được giả định thất bại: retry/query bằng cùng key; nếu chưa thể hoàn tất thì ghi `inventoryStatus=RELEASE_PENDING` và durable compensation task.
* Movie Service tự reclaim hold quá TTL vẫn phải trả terminal result idempotent cho Booking; Booking cập nhật local state theo authoritative response.
* Sau expiry, payment context mới phải bị chặn bằng `410 BOOKING_EXPIRED`.

### Late Payment After Expiry

1. Persist/deduplicate payment event theo `eventId`.
2. Không chuyển `EXPIRED` về `PENDING_PAYMENT/CONFIRMED` và không reserve ghế thay thế.
3. Xác minh `bookingId`, `paymentId`, amount và currency với snapshot.
4. Đặt `paymentStatus=SUCCEEDED`, `refundStatus=PENDING` theo audit model và tạo refund bằng stable key.
5. Refund success giữ booking `EXPIRED`, cập nhật `refundStatus=SUCCEEDED`; refund timeout/failure đi retry hoặc reconciliation.
6. Phát event/audit `LATE_PAYMENT_SUCCESS`; không issue ticket.

## 6. Cancellation & Refund Rules

### General Cancellation Rules

* Mỗi booking có tối đa một cancellation workflow active.
* Cancellation lưu `cancellationId`, source, `reasonCode`, reason, actor, `requestedAt`, `completedAt`, version và trạng thái từng dimension.
* Customer chỉ hủy booking mình sở hữu; operations caller phải có permission và đúng cluster.
* MVP không hỗ trợ partial cancellation.
* Customer cancellation bị chặn sau cutoff, sau showtime start hoặc khi có ticket `USED`, trừ policy override hợp lệ.
* Client không gửi refund amount/method authoritative; server tính từ snapshot và policy.
* Nguồn hủy tối thiểu gồm `CUSTOMER`, `STAFF_OVERRIDE`, `ADMIN_OVERRIDE`, `SHOWTIME_CANCELLED` và system compensation; mỗi nguồn áp dụng permission/policy riêng.
* API trả `201` khi hủy hoàn tất đồng bộ, `202` khi workflow đã được persist nhưng còn chờ payment/refund/inventory và `200/202` khi trả lại workflow idempotent đã có.

### Cancellation Eligibility

| Kiểm tra | Customer cancellation | Staff/Admin/Showtime cancellation |
|---|---|---|
| Booking ownership | Bắt buộc đúng owner | Permission + cluster scope |
| Cancellation cutoff | Phải còn trong cutoff | Chỉ override khi policy/permission cho phép |
| Showtime đã bắt đầu | Không cho auto-cancel | Manual review/operation policy |
| Ticket `USED` | Không cho auto-cancel toàn phần | Không tự động refund; cần manual review rõ ràng |
| Partial cancellation | Không hỗ trợ trong MVP | Không bypass qua operations API |
| Reason | Phải thuộc allowlist | Bắt buộc reason, actor và audit |
| Refund eligibility | Theo payment method/promotion/cutoff | Theo cinema-incident/operation policy |

### Cancellation Case Matrix

| Booking/payment/inventory khi nhận cancel | API ban đầu | Xử lý bắt buộc | Trạng thái cuối/kết quả |
|---|---:|---|---|
| `PENDING_PAYMENT` + `NOT_STARTED/PENDING`, provider chưa xử lý | `201` | Chặn payment context; release hold và promotion/loyalty/concession reservation | `booking=CANCELLED`, `inventory=RELEASED`, `refund=NOT_REQUESTED` |
| `PENDING_PAYMENT` + `paymentStatus=FAILED` | `201` hoặc terminal result cũ | Release idempotent nếu chưa release | `booking=CANCELLED`, không refund |
| `paymentStatus=UNKNOWN/PROCESSING` | `202` | Chuyển `CANCEL_REQUESTED`; không release khi kết quả payment chưa rõ; query/reconcile reference hiện tại | Failure → release + `CANCELLED`; success → refund workflow |
| `CONFIRM_PENDING`, inventory chưa rõ | `202` | Serialize với confirm và query authoritative inventory | Chưa `SOLD` → refund nếu đã thu tiền rồi release; đã `SOLD` → refund + cancel-sale |
| `CONFIRMED` + mọi ticket `VALID` + còn cutoff | `202` | Conditional transition; request refund; sau refund xử lý cancel-sale; cancel ticket/revoke QR | `CANCELLED`, `refund=SUCCEEDED`, inventory theo cancel-sale policy |
| `CONFIRMED` nhưng quá customer cutoff | `409` | Không tạo customer workflow | Giữ `CONFIRMED`; error `CANCELLATION_CUTOFF_PASSED` |
| Có bất kỳ ticket `USED` | `409` với customer | Không auto-refund/cancel-sale | Giữ nguyên; staff/admin chỉ tạo manual review nếu policy cho phép |
| Request chỉ hủy một số ticket/item | `409` | Không tạo partial workflow | `PARTIAL_CANCELLATION_NOT_SUPPORTED` |
| `EXPIRED` | `200` terminal result | Không tạo cancellation/refund/release mới | Giữ `EXPIRED` |
| `CANCEL_REQUESTED`/workflow đang xử lý | `200/202` | Trả cùng cancellation resource | Không tạo refund/release/cancel-sale thứ hai |
| `CANCELLED` và cùng intent | `200` | Trả terminal result cũ | Không có side effect mới |
| `CANCELLED` nhưng intent/key khác xung đột | `409` | Không mở workflow mới | `CANCELLATION_NOT_ALLOWED` |
| Showtime bị hủy bởi Movie Service | Async | Deduplicate event; tạo stable cancellation cho từng active booking; customer cutoff có thể được override theo cinema policy | Refund/cancel-sale từng booking độc lập; một booking lỗi không rollback batch |
| Staff/admin override | `201/202` | Kiểm tra permission/cluster; server quyết định có override cutoff hay không | Lưu actor/reason/before-after audit |

### Cancellation Processing Order

1. Xác thực owner hoặc operation permission/cluster scope.
2. Validate reason, cutoff, showtime, ticket usage và refund policy.
3. Deduplicate `Idempotency-Key`, khóa booking/cancellation aggregate và tạo đúng một active workflow.
4. Chặn payment context mới nếu cancellation đã được chấp nhận.
5. Quyết định theo authoritative payment/inventory state: release hold hoặc refund/cancel-sale; không suy ra chỉ từ `bookingStatus`.
6. Với bước external chưa rõ kết quả, persist `PROCESSING/PENDING/UNKNOWN`, enqueue durable retry và trả `202`.
7. Chỉ chuyển `COMPLETED/CANCELLED` khi các bước bắt buộc đã có terminal result; sau đó cancel ticket, revoke QR và publish outbox.

### Refund Rules

* Payment/refund ledger thuộc Payment Service; Booking chỉ gọi contract và lưu orchestration state.
* Booking chưa thu tiền (`NOT_STARTED/PENDING` nhưng provider chưa capture, hoặc `FAILED`) không tạo refund; chỉ release resource.
* Refund chỉ được tạo khi có payment success/capture authoritative hoặc late payment success đã được xác minh.
* Refund amount tính từ booking/payment/promotion/loyalty/concession snapshot và policy; client không được gửi amount/method đích.
* MVP hủy toàn booking nên refund là toàn phần theo phần tiền đủ điều kiện; phí, promotion, điểm và concession phải có breakdown/audit, không tự đoán từ giá hiện tại.
* Refund command dùng stable key, ví dụ `refund:{cancellationId}` hoặc `refund:{bookingId}:late-payment`; duplicate callback/response không tạo refund lần hai.
* Refund timeout giữ `refundStatus=PENDING/UNKNOWN`, retry hoặc query cùng payment/refund reference và cùng idempotency key.
* Refund failure authoritative chuyển `refundStatus=FAILED`; workflow vẫn `PROCESSING` hoặc `MANUAL_REVIEW`, không báo booking đã hủy hoàn tất.
* Chỉ sau authoritative refund và các bước inventory/ticket bắt buộc mới chuyển cancellation sang `COMPLETED`.
* Ghế `SOLD` chỉ xử lý bằng cancel-sale contract nếu policy cho phép; tuyệt đối không gọi release.
* Loyalty/promotion/concession reservation phải được release/restore/commit theo contract riêng và cùng nguyên tắc idempotency; Booking không tự sửa balance/quota/stock.

### Refund Case Matrix

| Trường hợp | Refund action | Booking/cancellation result | Inventory/ticket result |
|---|---|---|---|
| Hủy trước khi payment được capture | Không refund | `CANCELLED/COMPLETED` sau release | Hold released; không có ticket |
| `PAYMENT_FAILED` authoritative | Không refund | `CANCELLED/COMPLETED` | Release hold/resources |
| Payment `UNKNOWN/PROCESSING` | Chưa gửi refund; query/reconcile payment | `CANCEL_REQUESTED/PROCESSING` | Chưa release nếu có nguy cơ payment success/confirm race |
| Payment success, hold còn `RESERVED` và cancel được chấp nhận | Request refund; sau đó release hold | Hoàn tất khi refund + release terminal | Không issue ticket |
| Payment success, inventory đã `SOLD`, ticket `VALID` | Request refund; sau success gọi cancel-sale và revoke ticket | `CANCELLED` khi workflow hoàn tất | Inventory cancelled theo policy; ticket `CANCELLED` |
| Payment success nhưng hold đã expired/released | Tạo refund ngay bằng stable key | Booking giữ `EXPIRED` hoặc terminal compensation state | Không reserve ghế khác, không issue ticket |
| Refund callback success bị gửi lặp | Deduplicate theo `eventId/refundId` | Giữ `SUCCEEDED/COMPLETED` cũ | Không cancel-sale/revoke lần hai |
| Refund provider timeout/mất response | Giữ `PENDING/UNKNOWN`, retry/query cùng key | API/workflow vẫn `202 PROCESSING` | Không báo completed sớm |
| Refund authoritative failure | Ghi `FAILED`, retry nếu retryable hoặc mở reconciliation | `PROCESSING`/`MANUAL_REVIEW` | Không che giấu lỗi; giữ audit |
| Amount/currency/payment reference không khớp | Không áp event vào booking | Mở reconciliation/security review | Không thay đổi inventory/ticket theo payload sai |

### Cancellation / Payment / Expiry Race Rules

| Race | Guard | Kết quả bắt buộc |
|---|---|---|
| Cancel vs payment success | Aggregate version + payment inbox unique | Nếu cancel thắng trước provider processing: block/release; nếu success authoritative: tiếp tục refund, không mất tiền |
| Cancel vs payment failure | Conditional transition + stable release key | Hội tụ về đúng một release và `CANCELLED` |
| Cancel vs expiry scheduler | Booking version/status guard | Chỉ một terminal transition `CANCELLED` hoặc `EXPIRED` thắng; release đúng một lần |
| Cancel vs inventory confirm | Lock/version + authoritative inventory query | Chưa SOLD thì release; đã SOLD thì refund/cancel-sale; không release SOLD |
| Cancel vs ticket check-in | Conditional update ticket/booking | Check-in thắng thì customer cancel bị chặn; cancel thắng thì scan nhận cancelled/revoked |
| Hai cancel đồng thời | Unique active cancellation per booking + request hash | Cùng intent trả cùng resource; không tạo hai refund |
| Showtime cancel vs customer cancel | Event inbox + unique active workflow | Merge về một workflow; lưu cả event và customer intent trong audit |
| Refund callback đến trước local response | Inbox persist + correlation theo refund/payment/booking | Apply khi workflow row sẵn sàng; không gửi refund mới |
| Service restart giữa workflow | Durable workflow/task/outbox | Worker resume từ bước đã commit, không dựa vào memory |

## 7. Ticket & Check-in Rules

### Issuance Rules

* Một ticket cho mỗi booking detail và chỉ phát hành sau inventory `SOLD`.
* Một opaque QR pass đại diện cho cả booking; không tạo credential công khai riêng cho từng ghế.
* DB lưu token hash và ciphertext; key mã hóa nằm ngoài DB; raw token không được log/audit.

### Access Rules

* Member chỉ đọc ticket pass/ticket của mình.
* Employee/trusted gate phải có `TICKET_CHECK_IN`, đúng cluster và gate hợp lệ.
* `gateId` từ request không tự nó là bằng chứng authorization.

### Check-in Rules

* `ALL` chuyển atomically mọi ticket `VALID -> USED`; `SELECTED` chỉ cập nhật ticket ID thuộc booking trong QR.
* Scan lặp trả trạng thái và `checkedInAt` cũ, không side effect lần hai.
* Token sai/revoked, sai cluster, quá sớm/quá muộn hoặc ticket cancelled phải bị reject.
* Cancel thắng race thì check-in bị chặn; check-in thắng thì customer cancellation bị chặn theo policy.

## 8. Customer Read Rules

* List mặc định sort `createdAt DESC`, không sort theo UUID.
* Hỗ trợ view `UPCOMING/PAST`, booking/payment status, date range và pagination có giới hạn.
* Detail trả movie/cluster/room/showtime/seat/amount/discount/payment/refund/ticket snapshot cùng action flags do backend tính.
* Read model không gọi Movie Service để dựng lại lịch sử.
* Booking không tồn tại và booking thuộc member khác cùng trả `BOOKING_NOT_FOUND` để tránh lộ dữ liệu.

## 9. Employee / Admin Operation Rules

* Query `scope=CLUSTER` lấy cluster scope từ principal; không tin cluster tùy ý từ client.
* Search response giảm thiểu PII.
* Counter sale vẫn reserve inventory và đi cùng confirm/ticket state machine; không cho controller đặt thẳng `PAID/CONFIRMED`.
* Counter payment phải có immutable ledger/reference, cashier, terminal, amount và collected time.
* Terminal và showtime phải thuộc cluster được phân quyền.
* Reconciliation controller chỉ tạo case/evidence; worker/policy mới được retry hoặc compensation.
* Manual action lưu before/after, actor, reason và correlation ID.

## 10. Event & Reliability Rules

* Outbox event được commit cùng domain state; lỗi Kafka/email không rollback booking.
* Inbox deduplicate mọi external event theo `eventId`.
* Worker/scheduler claim durable state và resume được sau restart; không dựa vào memory.
* Event không chứa raw QR token, hold token, card data hoặc PII không cần thiết.
* Stable downstream key phải derive từ booking/operation/workflow; retry không generate key mới.

## 11. Promotion, Loyalty & Concession Rules (P2)

### Promotion

* Quote validate rule/quota và có expiry; reserve quota trước payment, commit khi confirmed, release khi fail/expire/cancel.
* Quote không thay thế seat hold.

### Loyalty

* Booking chỉ reserve/commit/release điểm qua User Service và lưu redemption snapshot/reference.
* Frontend gửi `pointsToUse`, không gửi discount amount.

### Concession

* Validate SKU/quantity/cluster/showtime/channel và lưu immutable line-item snapshot.
* Reserve/commit/release stock qua contract của owner tương ứng.

## 12. Security Rules

| Namespace | Caller | Required control |
|---|---|---|
| `/api/bookings`, `/api/tickets` | Member/customer | User JWT + ownership |
| `/api/operations/**` | Employee/admin UI | User JWT + permission + cluster scope |
| `/internal/**` | Service/worker | Service credential + audience/scope allowlist |

* Không forward member JWT để giả service credential.
* Internal endpoint không `permitAll`; member permission error không dùng `UNAUTHORIZED_SERVICE`.
* Không log hold token, raw QR, payment token, signature hoặc provider secret.

## 13. State Dimensions

| Dimension | Values |
|---|---|
| Booking | `PENDING_PAYMENT`, `CONFIRM_PENDING`, `CONFIRMED`, `CANCEL_REQUESTED`, `CANCELLED`, `EXPIRED` |
| Payment | `NOT_STARTED`, `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `UNKNOWN` |
| Refund | `NOT_REQUESTED`, `PENDING`, `SUCCEEDED`, `FAILED`, `UNKNOWN` |
| Inventory | `HELD`, `RELEASE_PENDING`, `RELEASED`, `CONFIRM_PENDING`, `SOLD`, `CANCEL_SALE_PENDING`, `CANCELLED` |
| Cancellation | `REQUESTED`, `PROCESSING`, `COMPLETED`, `FAILED`, `MANUAL_REVIEW` |
| Ticket | `VALID`, `USED`, `CANCELLED` |
| Idempotency operation | `IN_PROGRESS`, `SUCCEEDED`, `FAILED_RETRYABLE`, `FAILED_TERMINAL` |

## 14. Key Error Cases

| Condition | HTTP | Canonical error |
|---|---:|---|
| Empty/invalid seat selection | 400 | `INVALID_SEAT_SELECTION` |
| Showtime closed/cancelled/past cutoff | 400 | `SHOWTIME_NOT_AVAILABLE` |
| One or more seats unavailable | 409 | `SEATS_ALREADY_TAKEN` |
| Inventory unavailable after bounded retry | 503 | `INVENTORY_SERVICE_UNAVAILABLE` |
| Same key with a different request hash | 409 | `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` |
| Active hold limit exceeded | 429 | `ACTIVE_HOLD_LIMIT_EXCEEDED` |
| Booking missing or foreign to member | 404 | `BOOKING_NOT_FOUND` |
| Payment attempted after expiry | 410 | `BOOKING_EXPIRED` |
| Customer cancel after cutoff | 409 | `CANCELLATION_CUTOFF_PASSED` |
| Ticket already used | 409 | `TICKET_ALREADY_USED` |
| Invalid/revoked QR | 400/410 | `INVALID_QR_TOKEN` / `QR_TOKEN_REVOKED` |
| Employee outside cluster | 403 | `EMPLOYEE_OUTSIDE_CLUSTER_SCOPE` |

Error response thống nhất theo envelope `code/message/result`; `result` có thể `null` hoặc chứa chi tiết an toàn như danh sách seat ID không khả dụng.

## 15. Production Gaps / Decisions Required

* Chính sách refund/cancellation/cutoff và partial cancellation.
* Contract query/cancel-sale của Movie Service và refund/query của Payment Service.
* Error-code registry, permission/cluster scope, trusted gate và terminal registry.
* Retention/cleanup cho idempotency, inbox, outbox, audit, QR và PII.
* Kafka schema/versioning, retry/backoff/DLQ và runbook reconciliation.
