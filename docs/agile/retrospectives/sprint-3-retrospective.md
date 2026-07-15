# BÁO CÁO HỒI TƯỞNG SPRINT 3

## Tái xác lập phạm vi theo định hướng sản phẩm và mức độ sẵn sàng vận hành

> **Thông điệp trọng tâm:** Nhóm chuyển từ tư duy **hoàn tất chức năng** sang tư duy **kỹ thuật hướng sản phẩm**, trong đó khả năng vận hành tin cậy là điều kiện bắt buộc trước khi xem một chức năng là hoàn thành.

---

## Thông tin báo cáo

| Nội dung | Thông tin |
|---|---|
| Sprint | Sprint 3 - Lớp quản lý nội dung và lịch chiếu |
| Thời gian kế hoạch | 07/07/2026 - 21/07/2026 |
| Mốc trình diễn | 16/07/2026 |
| Thời điểm đóng băng tính năng | 15/07/2026 |
| Nhóm | HCM26_CPL_JAVA_05_Group1 |
| Phạm vi đánh giá | `movie-service`, lịch chiếu, cụm rạp, phòng chiếu và các luồng hỗ trợ liên quan |
| Trạng thái tài liệu | Báo cáo hồi tưởng tại mốc trình diễn; số liệu cuối cùng được chốt khi kết thúc Sprint |

> Sprint 3 theo kế hoạch vẫn kết thúc ngày 21/07/2026. Vì vậy, đây là báo cáo hồi tưởng tại mốc trình diễn, không phải báo cáo đóng Sprint cuối cùng.

---

## 1. Tóm tắt điều hành

Sprint 3 ban đầu được lập kế hoạch với mục tiêu hoàn thiện các luồng chức năng có thể trình diễn trong phạm vi một dự án học thuật, bao gồm vòng đời phim, quản lý lịch chiếu và cấu hình phòng chiếu - ghế ngồi.

Sau buổi nhận xét tuần trước, mentor yêu cầu nhóm nâng tiêu chuẩn kỹ thuật của dự án theo hướng một sản phẩm có khả năng vận hành thực tế. Theo định hướng mới, `movie-service` không chỉ cần chạy được luồng thành công mà còn phải bảo đảm:

- tính toàn vẹn và nhất quán của dữ liệu;
- an toàn giao dịch khi cập nhật nhiều bảng liên quan;
- di trú cơ sở dữ liệu có phiên bản và có khả năng kiểm soát thay đổi;
- phân quyền đầy đủ và tách biệt dữ liệu quản trị với dữ liệu công khai;
- quy tắc chuyển trạng thái phim rõ ràng và có thể kiểm chứng;
- an toàn khi có nhiều yêu cầu đồng thời;
- khả năng kiểm toán và truy vết thay đổi;
- khả năng phục hồi khi tích hợp dịch vụ bên ngoài;
- kiểm thử hồi quy, tích hợp và đồng thời ở mức phù hợp.

Đây là một thay đổi đáng kể về phạm vi và tiêu chuẩn chất lượng sau khi Sprint đã bắt đầu. Yêu cầu mới tác động xuyên suốt cơ sở dữ liệu, mô hình miền nghiệp vụ, tầng truy xuất dữ liệu, tầng dịch vụ, hợp đồng API, giao diện và bộ kiểm thử.

Nhóm đã ưu tiên xử lý các rủi ro nền tảng thay vì chỉ cố gắng đóng nhiều issue. Tuy nhiên, Sprint Backlog chưa được tái xác lập tương ứng với năng lực và thời gian còn lại. Vì vậy, tại thời điểm đóng băng tính năng vẫn còn 14 issue ở trạng thái đang thực hiện, đồng thời một phần mục tiêu chức năng ban đầu chưa đáp ứng đầy đủ Định nghĩa Hoàn thành.

Quyết định dừng phát triển tính năng mới ngày 15/07/2026 để chuyển sang ổn định hệ thống, kiểm thử hồi quy và diễn tập trình diễn là một quyết định kiểm soát rủi ro. Quyết định này không có nghĩa nhóm từ bỏ mục tiêu Sprint.

### Đánh giá tổng quan

| Khía cạnh | Mức đánh giá | Nhận định |
|---|:---:|---|
| Giá trị đã bàn giao | Tốt | Đã có phần tăng trưởng có giá trị ở vòng đời phim, nhập dữ liệu TMDB, phòng chiếu - ghế và nền tảng lịch chiếu |
| Khả năng thích ứng | Tốt | Nhóm đã điều chỉnh đúng hướng khi tiêu chuẩn kỹ thuật được nâng lên |
| Mức hoàn thành phạm vi ban đầu | Cần cải thiện | Chưa hoàn tất toàn bộ chức năng đã cam kết ban đầu |
| Mức hoàn thành phạm vi điều chỉnh | Cần cải thiện | Đã xử lý một phần công việc nâng cấp; phần còn lại cần triển khai qua nhiều giai đoạn |
| Chất lượng kỹ thuật | Cần cải thiện | Bộ kiểm thử đã phát hiện lỗi tương thích lược đồ; toàn bộ kiểm thử chưa đạt tuyệt đối tại thời điểm đóng băng |
| Hiệu quả dòng công việc | Chưa đạt | Số lượng công việc đang thực hiện cao và phụ thuộc kỹ thuật phức tạp |
| Mức sẵn sàng trình diễn | Có điều kiện | Giao diện biên dịch thành công; backend và luồng đầu cuối cần hoàn tất kiểm tra chặn phát hành |

**Kết luận:** Sprint 3 đạt kết quả một phần, đồng thời đã thực hiện được một lượng công việc sửa chữa kiến trúc có giá trị. Việc chưa hoàn tất toàn bộ issue xuất phát từ cả thay đổi tiêu chuẩn kỹ thuật ngoài kế hoạch và hạn chế trong quy trình quản trị thay đổi của nhóm.

---

## 2. Mục tiêu và giả định ban đầu

### 2.1. Mục tiêu Sprint ban đầu

1. Hoàn thiện vòng đời phim từ tạo mới, gửi duyệt, phê duyệt hoặc từ chối, phát hành và kết thúc.
2. Hoàn thiện quản lý lịch chiếu, bao gồm tạo, cập nhật, hủy, kiểm tra trùng lịch và giá cơ bản.
3. Hoàn thiện quản lý cụm rạp, phòng chiếu, sơ đồ ghế và sinh ghế tự động.
4. Cải thiện quy trình bằng cách cân bằng phân bổ công việc và tổ chức buổi trình diễn chính thức.

### 2.2. Các giả định khi lập kế hoạch

- Lược đồ cơ sở dữ liệu hiện tại đủ ổn định để tiếp tục xây dựng chức năng.
- Hợp đồng API chủ yếu phục vụ giao diện hiện hữu.
- Tích hợp TMDB chỉ cần tìm kiếm và nhập dữ liệu cơ bản.
- Một trường trạng thái phim có thể dùng đồng thời cho quá trình biên tập và quá trình trình chiếu.
- Kiểm soát đồng thời, kiểm toán, di trú an toàn và tách biệt danh mục công khai chưa phải điều kiện chặn hoàn thành.

Các giả định này phù hợp với một bản thử nghiệm học thuật nhưng không còn phù hợp khi dự án chuyển sang định hướng sản phẩm.

---

## 3. Thay đổi tiêu chuẩn sau buổi nhận xét

Mentor yêu cầu `movie-service` được tái thiết kế theo hướng có thể tiếp tục phát triển thành sản phẩm vận hành thực tế. Đây không phải một yêu cầu sửa lỗi đơn lẻ mà là thay đổi tiêu chuẩn chất lượng nền của toàn bộ mô-đun.

| Khu vực kỹ thuật | Tiêu chuẩn ban đầu | Tiêu chuẩn sau điều chỉnh |
|---|---|---|
| Cơ sở dữ liệu | Phục vụ luồng thành công | Có ràng buộc, khóa duy nhất, di trú có phiên bản và kiểm soát tương thích |
| Mô hình nghiệp vụ | Phản ánh dữ liệu màn hình | Thể hiện quy tắc bất biến và quan hệ nghiệp vụ rõ ràng |
| Cập nhật dữ liệu | Lưu hoặc thay thế trực tiếp | Giao dịch nguyên tử, cập nhật có chọn lọc và bảo toàn quan hệ |
| Vòng đời phim | Một trạng thái phục vụ nhiều mục đích | Phân biệt quá trình phê duyệt nội dung và quá trình trình chiếu |
| Danh mục phim | Quản trị và khách hàng dùng chung | API nội bộ tách khỏi API công khai |
| Phân quyền | Kiểm tra vai trò ở một số điểm | Ma trận phân quyền nhất quán cho toàn mô-đun |
| Tích hợp TMDB | Tìm kiếm và nhập dữ liệu cơ bản | Xem trước chỉ đọc, ánh xạ xác định, cảnh báo dữ liệu chưa ánh xạ và xử lý lỗi dịch vụ ngoài |
| Lịch chiếu | Thêm, sửa, xóa theo luồng chính | Kiểm tra điều kiện, khoảng đệm, tồn kho ghế, hủy và an toàn đồng thời |
| Kiểm toán | Ghi nhật ký đơn giản | Xác định đúng tác nhân, lưu lịch sử bất biến và hỗ trợ truy vết |
| Kiểm thử | Kiểm thử đơn vị các trường hợp chính | Kiểm thử hợp đồng, tích hợp, di trú, hồi quy và đồng thời |

### Chuỗi tác động kỹ thuật

```text
Di trú cơ sở dữ liệu
    -> Mô hình thực thể và mô hình nghiệp vụ
        -> Kho dữ liệu và câu truy vấn
            -> Quy tắc tại tầng dịch vụ
                -> Hợp đồng API và phân quyền
                    -> Tích hợp giao diện
                        -> Kiểm thử hồi quy và đầu cuối
```

Khi lược đồ hoặc quy tắc vòng đời thay đổi, các phần đã xây dựng trước đó có thể phải sửa lại. Một số issue phải được mở lại, tách nhỏ hoặc bổ sung tiêu chí nghiệm thu.

---

## 4. Tác động đến kế hoạch Sprint

Thay đổi định hướng là cần thiết về mặt kỹ thuật, nhưng nhóm chưa thực hiện đầy đủ quy trình tái xác lập phạm vi sau buổi nhận xét.

Những việc chưa được thực hiện kịp thời:

- đánh giá lại toàn bộ khối lượng nâng cấp;
- ước lượng lại công việc và năng lực còn lại;
- giảm phạm vi chức năng tương ứng;
- gom công việc sửa chữa nền tảng thành một nhóm công việc lớn riêng;
- xác định lại chuỗi phụ thuộc;
- thiết lập danh sách rủi ro và cơ chế chấp thuận thay đổi;
- phân loại lại mức ưu tiên theo rủi ro thay vì gắn tất cả là ưu tiên cao.

Do đó, số lượng issue chưa hoàn tất phản ánh cả công việc kỹ thuật phát sinh ngoài kế hoạch và điểm yếu trong quy trình quản trị thay đổi, không chỉ phản ánh tốc độ thực hiện của thành viên.

---

## 5. Kết quả bàn giao

### 5.1. Vòng đời phim và tính toàn vẹn dữ liệu

- **#188:** Xem trước chi tiết phim từ TMDB ở chế độ chỉ đọc, không thay đổi cơ sở dữ liệu nội bộ.
- **#189 và #190:** Thống nhất ánh xạ dữ liệu giữa xem trước và nhập phim; không âm thầm bỏ qua thể loại chưa được ánh xạ.
- **#152:** Chuẩn hóa loại ảnh phim bằng kiểu liệt kê.
- **#172:** Kiểm tra mức sẵn sàng của phim trước khi cho phép chuyển trạng thái.
- **#139:** Giao diện danh sách phim chờ duyệt, hỗ trợ phê duyệt, từ chối và ghi lý do.
- **#131, #132 và #133:** Bổ sung ngày kết thúc phim ở cơ sở dữ liệu, backend và giao diện.
- **#122 đến #125:** Nền tảng lược đồ phim phiên bản 2, API vòng đời, nhập phim từ TMDB và giao diện tạo - chỉnh sửa phim.

### 5.2. Cụm rạp, phòng chiếu và ghế

- Lược đồ, API, kiểm tra dữ liệu, tọa độ, quy trình duyệt và giao diện quản lý cụm rạp đã được triển khai qua **#86 đến #88 và #127 đến #130**.
- Phòng chiếu được liên kết đúng với cụm rạp qua **#162 và #163**.
- Thuật toán sinh ghế theo vùng cấu hình của phòng đã được tích hợp.
- API quản lý trạng thái ghế **#136** đã có phần triển khai.

### 5.3. Nền tảng lịch chiếu

- **#101:** Sinh hàng loạt lịch chiếu kèm xem trước xung đột đã được tích hợp.
- **#135:** Giá cơ bản theo lịch chiếu có phần triển khai và bằng chứng kiểm thử tự động.
- **#137:** Giao diện gọi đúng API lịch chiếu.
- Các quy tắc điều kiện lập lịch, khoảng đệm, tồn kho ghế và hủy lịch vẫn cần hoàn thiện theo đúng thứ tự phụ thuộc.

### 5.4. Các năng lực hỗ trợ

- Cấu hình CORS cho phương thức PATCH qua **#96**.
- Chuẩn hóa phản hồi lỗi từ API Gateway qua **#95**.
- Luồng đăng ký và kích hoạt tài khoản qua **#94, #159 và #160**.
- Danh sách phim dành cho khách hàng qua **#140**.

> Một thay đổi đã được hợp nhất vào nhánh phát triển chưa đồng nghĩa với việc issue đã hoàn thành. Issue chỉ đạt Định nghĩa Hoàn thành khi tiêu chí nghiệm thu, kiểm thử, di trú, tài liệu và kiểm tra vận hành đều đạt.

---

## 6. Bằng chứng chất lượng tại thời điểm đóng băng

Kết quả dưới đây được ghi nhận từ lần kiểm tra ngày 15/07/2026.

| Nội dung kiểm tra | Kết quả | Nhận định |
|---|:---:|---|
| Biên dịch bản sản xuất của giao diện | Đạt | Hoàn tất biên dịch; còn cảnh báo kích thước gói JavaScript lớn |
| Toàn bộ kiểm thử `movie-service` | 90/91 đạt | Một kiểm thử tích hợp lỗi do loại ảnh không tương thích ràng buộc cơ sở dữ liệu |
| Kiểm thử dịch vụ TMDB | 13/13 đạt | Có bao phủ cho ánh xạ xem trước, nhập phim và kiểm tra thể loại |
| Kiểm thử mức sẵn sàng của phim | 14/14 đạt | Các quy tắc chính có kiểm thử đơn vị |
| Kiểm thử tầng dịch vụ phim | 21/21 đạt | Các kiểm thử chính trong bộ hiện tại đạt |
| Kiểm thử sinh lịch và giá | Đạt | Các kiểm thử sinh hàng loạt, đồng thời và giá trong bộ hiện tại đạt |
| Luồng đầu cuối hoàn chỉnh | Chưa có đủ bằng chứng | Cần kiểm tra đăng nhập, xem trước, nhập hoặc tạo, gửi duyệt, phê duyệt và hiển thị công khai |
| Bản phát hành trình diễn bất biến | Chưa xác nhận | Máy cục bộ còn thay đổi giao diện chưa được ghi nhận vào Git tại thời điểm kiểm tra |

### Rủi ro chặn phát hành

1. **Không đồng bộ giữa kiểu liệt kê và ràng buộc cơ sở dữ liệu**  
   Kiểm thử tích hợp thất bại khi giá trị cũ `BackDrop` không thỏa ràng buộc của bảng ảnh phim. Cần đồng bộ mã nguồn, di trú, dữ liệu mẫu và dữ liệu cũ; không được bỏ kiểm thử để che lỗi.

2. **Cấu hình múi giờ chưa tương thích giữa các môi trường**  
   PostgreSQL có thời điểm từ chối `Asia/Saigon`. Cần chuẩn hóa sang `Asia/Ho_Chi_Minh` và bảo đảm lịch tự động dùng cùng một ngày nghiệp vụ.

3. **Chưa chốt bản phát hành trình diễn**  
   Cần xác định một mã cam kết hoặc thẻ phiên bản bất biến thay vì trình diễn trực tiếp từ thư mục làm việc còn thay đổi.

4. **Trạng thái bảng công việc chưa đồng bộ hoàn toàn với Git**  
   Một số phần đã có bằng chứng hợp nhất nhưng trạng thái issue chưa phản ánh đúng mức bàn giao.

---

## 7. Những điểm đã làm tốt

### 7.1. Thích ứng đúng hướng với tiêu chuẩn mới

Nhóm không tiếp tục xây thêm giao diện trên một nền tảng dữ liệu chưa ổn định. Các rủi ro về dữ liệu, vòng đời, phân quyền và tích hợp đã được ưu tiên xử lý.

### 7.2. Chuyển nợ kỹ thuật tiềm ẩn thành công việc có thể theo dõi

Các vấn đề trước đây chỉ tồn tại trong mã nguồn đã được chuyển thành issue có tiêu chí nghiệm thu rõ hơn, như tách API công khai - nội bộ, kiểm tra mức sẵn sàng, an toàn di trú và tính nhất quán của lịch chiếu.

### 7.3. Kiểm thử tự động phát hiện lỗi có giá trị

Bộ kiểm thử chưa đạt hoàn toàn nhưng đã phát hiện lỗi tương thích giữa mã nguồn và cơ sở dữ liệu trước khi trình diễn. Đây là loại lỗi khó nhận biết nếu chỉ kiểm tra luồng thành công trên giao diện.

### 7.4. Có kết quả xuyên suốt nhiều tầng

Nhóm đã bàn giao thay đổi ở cơ sở dữ liệu, backend, frontend và API Gateway. Điều này tạo nền tảng để tiếp tục nâng cấp thay vì chỉ hoàn thiện tầng hiển thị.

### 7.5. Chủ động đóng băng tính năng

Nhóm chuyển sang ổn định hệ thống trước buổi trình diễn, hạn chế tiếp tục hợp nhất các thay đổi lớn có khả năng gây lỗi hồi quy.

---

## 8. Những điểm cần cải thiện

### 8.1. Chưa tái lập kế hoạch chính thức khi phạm vi thay đổi

Tiêu chuẩn mới làm thay đổi khối lượng, độ phức tạp và chuỗi phụ thuộc, nhưng nhóm vẫn giữ gần như toàn bộ cam kết ban đầu.

### 8.2. Trộn công việc chức năng với sửa chữa kiến trúc trong cùng Sprint

Chức năng mới, di trú cơ sở dữ liệu, bảo mật, sửa vòng đời, tích hợp TMDB và kiểm thử hồi quy cùng cạnh tranh một nguồn lực.

### 8.3. Số lượng công việc đang thực hiện vượt khả năng xử lý

Tại thời điểm đóng băng, còn 14 issue đang thực hiện. Nhóm chưa phân biệt rõ công việc đã được giao, công việc sẵn sàng và công việc thực sự đang được triển khai.

### 8.4. Chưa tuân thủ đầy đủ thứ tự phụ thuộc

- Nhập ảnh được triển khai khi hợp đồng kiểu dữ liệu và di trú chưa ổn định.
- Giao diện vòng đời được thực hiện khi quy tắc trạng thái còn thay đổi.
- Chức năng lịch chiếu được mở rộng khi điều kiện phòng, khoảng đệm và tồn kho ghế chưa chốt.

### 8.5. Định nghĩa Hoàn thành chưa đồng nhất

Một issue hướng vận hành thực tế phải có đầy đủ mã nguồn, di trú, kiểm thử, hợp đồng API, bằng chứng chạy thực tế và trạng thái bảng công việc chính xác. Nhóm chưa áp dụng đồng nhất tiêu chuẩn này.

### 8.6. Hoạt động tích hợp diễn ra sát buổi trình diễn

Nhiều thay đổi quan trọng được hợp nhất gần ngày trình diễn, làm giảm thời gian cho kiểm thử hồi quy, diễn tập và chuẩn bị phương án quay lui.

### 8.7. Chưa chứng minh được mức cân bằng công việc

Mục tiêu không thành viên nào vượt 35% khối lượng chưa được xác nhận bằng dữ liệu issue hoặc điểm công việc. Việc đánh giá cần dựa trên cả số lượng, độ phức tạp và năng lực thực tế.

---

## 9. Trách nhiệm của leader

Với vai trò leader, tôi ghi nhận các trách nhiệm sau:

1. Tôi đã không thực hiện đánh giá tác động và tái xác lập phạm vi đủ sớm sau khi tiêu chuẩn kỹ thuật thay đổi.
2. Tôi chưa giảm cam kết chức năng tương ứng với khối lượng sửa chữa nền tảng phát sinh.
3. Tôi cho phép quá nhiều issue cùng ở trạng thái đang thực hiện, làm giảm tính minh bạch của tiến độ.
4. Tôi chưa phân quyền sở hữu kỹ thuật theo từng vùng nghiệp vụ đủ rõ, dẫn đến leader trở thành điểm nghẽn tích hợp.
5. Tôi chưa thiết lập cửa kiểm soát chất lượng và thời gian ổn định hệ thống ngay từ đầu Sprint.

Các quyết định đúng đã thực hiện:

- ưu tiên tính đúng đắn và toàn vẹn dữ liệu thay vì số lượng issue đã đóng;
- dừng mở rộng tính năng trước buổi trình diễn;
- yêu cầu có bằng chứng kiểm thử thay vì tuyên bố luồng đã ổn;
- tổ chức lại phần còn lại theo mức độ rủi ro sản phẩm.

> Leader chịu trách nhiệm về cơ chế lập kế hoạch, điều phối và kiểm soát thay đổi. Báo cáo không quy kết việc chưa hoàn tất cho mentor hoặc cho sự chủ động của từng thành viên.

---

## 10. Phân tích nguyên nhân gốc

| Hiện tượng | Nguyên nhân gốc | Biện pháp điều chỉnh |
|---|---|---|
| Chưa hoàn tất toàn bộ issue | Tiêu chuẩn chất lượng thay đổi nhưng phạm vi và năng lực không được tái xác lập | Thực hiện đánh giá tác động và cam kết sửa đổi ngay khi có thay đổi lớn |
| Nhiều issue đều ưu tiên cao | Chưa ưu tiên theo rủi ro sản phẩm | Chia mức P0, P1, P2 dựa trên khả năng gây mất dữ liệu, sai quyền hoặc chặn vận hành |
| Số công việc đang làm cao | Issue được kéo sang đang thực hiện ngay khi giao | Mỗi thành viên tối đa một issue triển khai chính tại một thời điểm |
| Sửa lại nhiều tầng | Chưa chốt hợp đồng kiến trúc và dữ liệu trước khi phát triển | Thực hiện khảo sát kỹ thuật và duyệt hợp đồng trước triển khai |
| Lỗi di trú xuất hiện muộn | Mã nguồn, di trú, ràng buộc và dữ liệu kiểm thử chưa có nguồn chuẩn duy nhất | Kiểm thử di trú trên cơ sở dữ liệu sạch trong quy trình tích hợp liên tục |
| Hợp nhất sát buổi trình diễn | Kế hoạch chưa dành thời gian ổn định | Đóng băng tính năng trước trình diễn tối thiểu 24 đến 48 giờ |
| Leader trở thành điểm nghẽn | Chưa có chủ sở hữu kỹ thuật theo vùng nghiệp vụ | Phân chủ sở hữu chịu trách nhiệm đầu cuối cho từng vùng |

---

## 11. Đề xuất tái xác lập phạm vi

Các yêu cầu hướng vận hành thực tế vẫn là phạm vi hợp lệ của sản phẩm, nhưng không nên được đưa vào Sprint 3 như các issue ngang hàng. Đề xuất tạo nhóm công việc lớn **Nâng mức sẵn sàng vận hành của Movie Service** và triển khai theo rủi ro.

### Giai đoạn 1 - An toàn dữ liệu và điều kiện phát hành

- Di trú cơ sở dữ liệu có phiên bản và kiểm tra tương thích.
- Cập nhật phim an toàn giao dịch, không làm mất quan hệ.
- Ma trận phân quyền **#186**.
- Tách API danh mục công khai và nội bộ **#171**.
- Quy tắc mức sẵn sàng và vòng đời phim.
- Lịch tự động an toàn múi giờ.
- Bộ kiểm thử hồi quy đạt hoàn toàn trên cơ sở dữ liệu sạch.

### Giai đoạn 2 - Tính đúng đắn của lịch chiếu và tồn kho ghế

- Điều kiện được phép lập lịch **#176**.
- Định dạng và giá cơ bản **#177**.
- Ngăn trùng lịch có khoảng đệm **#178**.
- Khởi tạo tồn kho ghế theo lịch chiếu **#179**.
- Vòng đời mở bán và hủy lịch **#185**.
- Di trú vùng ghế **#168** và phản hồi lỗi trên giao diện **#169**.

### Giai đoạn 3 - Hoàn thiện dữ liệu và khả năng vận hành

- Nhiều công ty sản xuất **#151**.
- Bổ sung dữ liệu người tham gia phim **#153**.
- Chọn trailer chính thức **#191**.
- Nhập poster, ảnh nền và ảnh cảnh phim **#192**.
- Mở rộng kiểm toán, nguồn gốc dữ liệu, đồng bộ lại và giám sát hệ thống.

Các mục ở Giai đoạn 3 không bị loại khỏi định hướng sản phẩm. Chúng chỉ có rủi ro thấp hơn tính toàn vẹn dữ liệu, phân quyền và quy tắc vòng đời.

---

## 12. Hành động cải tiến

| STT | Hành động | Người chịu trách nhiệm | Thời hạn | Tiêu chí thành công |
|---:|---|---|---|---|
| 1 | Đối soát bảng công việc với lịch sử hợp nhất và tiêu chí nghiệm thu | Leader và người được giao | 16/07 | Không còn issue đã hợp nhất nhưng ở sai trạng thái |
| 2 | Tái xác lập phạm vi Sprint 3 sau thay đổi tiêu chuẩn | Leader và mentor | Sau trình diễn | Có phạm vi sửa đổi, năng lực và phần chuyển tiếp được thống nhất |
| 3 | Tạo nhóm công việc nâng mức sẵn sàng vận hành | Chủ sở hữu `movie-service` | Trước Sprint 4 | Issue được nhóm theo giai đoạn và phụ thuộc |
| 4 | Áp dụng ưu tiên P0, P1, P2 theo rủi ro | Leader và chủ sở hữu kỹ thuật | Ngay lập tức | Không còn tất cả issue cùng mức ưu tiên cao |
| 5 | Giới hạn một issue triển khai chính trên mỗi thành viên | Cả nhóm | Phần còn lại Sprint 3 | Số issue đang làm không vượt năng lực nhóm |
| 6 | Bổ sung mẫu đánh giá tác động khi có thay đổi lớn | Leader | Sprint 4 | Mọi thay đổi có tác động, ước lượng và phê duyệt |
| 7 | Chuẩn hóa Định nghĩa Sẵn sàng | Chủ sở hữu kỹ thuật | Lập kế hoạch Sprint 4 | Issue có phụ thuộc, hợp đồng và cách kiểm thử trước khi giao |
| 8 | Chuẩn hóa Định nghĩa Hoàn thành hướng vận hành | Cả nhóm | Lập kế hoạch Sprint 4 | Hoàn thành gồm mã, di trú, kiểm thử, tài liệu và bằng chứng chạy |
| 9 | Kiểm thử di trú trên cơ sở dữ liệu sạch trong CI | Chủ sở hữu backend và dữ liệu | Sprint 4 | Lỗi lược đồ bị chặn trước khi hợp nhất |
| 10 | Tổ chức kiểm tra tích hợp giữa Sprint và đóng băng trước trình diễn | Leader | Sprint 4 | Có mốc kiểm tra 50% và đóng băng tối thiểu 24 đến 48 giờ |
| 11 | Phân chủ sở hữu kỹ thuật theo vùng nghiệp vụ | Leader và cả nhóm | Sprint 4 | Mỗi vùng có người chịu trách nhiệm đầu cuối |
| 12 | Báo cáo khối lượng theo điểm công việc và năng lực | Leader | Khi đóng Sprint 3 | Không thành viên nào vượt 35% hoặc có ngoại lệ được thống nhất |

---

## 13. Danh sách kiểm tra trước trình diễn

### Bản phát hành trình diễn

- [ ] Chốt mã cam kết hoặc thẻ phiên bản dùng để trình diễn.
- [ ] Thư mục làm việc sạch; không trình diễn từ thay đổi chưa ghi nhận.
- [ ] Sao lưu cơ sở dữ liệu và chạy đúng phiên bản di trú.
- [ ] Chuẩn hóa múi giờ thành `Asia/Ho_Chi_Minh`.
- [ ] Chuẩn bị tài khoản quản trị viên và nhân viên hợp lệ.
- [ ] Chuẩn bị điểm quay lui cho mã nguồn và cơ sở dữ liệu.

### Kiểm tra chặn phát hành

- [ ] Đồng bộ loại ảnh giữa mã nguồn, di trú, ràng buộc và dữ liệu mẫu.
- [ ] Chạy lại toàn bộ kiểm thử `movie-service` với mục tiêu đạt 100%.
- [ ] Biên dịch giao diện từ đúng bản phát hành trình diễn.
- [ ] Xác nhận quyền của các API xem trước, nhập, tạo, gửi duyệt và phê duyệt.
- [ ] Xác nhận xem trước TMDB không thay đổi cơ sở dữ liệu.

### Luồng trình diễn chính

- [ ] Đăng nhập đúng vai trò.
- [ ] Tìm kiếm hoặc duyệt phim từ TMDB.
- [ ] Xem trước phim ở chế độ chỉ đọc.
- [ ] Nhập hoặc tạo phim ở trạng thái đúng.
- [ ] Gửi phim để xét duyệt.
- [ ] Quản trị viên phê duyệt hoặc từ chối kèm lý do.
- [ ] Danh mục nội bộ hiển thị đúng trạng thái.
- [ ] Khách hàng chỉ thấy phim đáp ứng quy tắc công khai.
- [ ] Trình diễn một trường hợp dữ liệu thiếu hoặc sai quyền bị từ chối rõ ràng.

---

## 14. Phân công vận hành buổi trình diễn

| Vai trò | Người phụ trách đề xuất | Trách nhiệm |
|---|---|---|
| Điều phối và ra quyết định tích hợp | Nguyễn An Bình | Chốt bản trình diễn, trình bày và quyết định có nhận sửa lỗi chặn phát hành |
| Hỗ trợ backend | Tấn Lộc | Theo dõi nhật ký API và chuẩn bị Postman dự phòng |
| Hỗ trợ cơ sở dữ liệu và môi trường | Nhật Duy | Di trú, dữ liệu mẫu, sao lưu và quay lui |
| Kiểm tra giao diện | Mạnh Khải | Chạy luồng chính và kiểm tra các trạng thái tải, trống và lỗi |
| Ghi nhận bằng chứng và thời gian | Đăng Khoa | Ghi kết quả kiểm tra, theo dõi thời lượng và tổng hợp vấn đề |

---

## 15. Chỉ số cần chốt khi kết thúc Sprint

- Phạm vi ban đầu so với phạm vi điều chỉnh.
- Điểm công việc hoàn tất và điểm chuyển tiếp.
- Khối lượng phát sinh do nâng tiêu chuẩn vận hành.
- Phân bổ công việc theo thành viên và độ phức tạp.
- Số công việc đang làm, thời gian chu kỳ và thời gian bị chặn.
- Thời gian xem xét yêu cầu hợp nhất.
- Tỷ lệ kiểm thử đạt trên bản phát hành.
- Số lỗi phát hiện trước và trong buổi trình diễn.
- Tỷ lệ sửa lại do thay đổi hợp đồng kiến trúc hoặc dữ liệu.

### Số liệu đã có

| Chỉ số | Giá trị | Mức bằng chứng |
|---|---:|:---:|
| Quy mô nhóm | 5 | Đã xác nhận |
| Issue đang thực hiện tại thời điểm đóng băng | 14 | Theo ảnh chụp bảng công việc |
| Biên dịch giao diện sản xuất | Đạt | Kiểm tra cục bộ ngày 15/07 |
| Kiểm thử tự động `movie-service` | 90 đạt, 1 lỗi, tổng 91 | Kiểm tra cục bộ ngày 15/07 |
| Diễn tập luồng đầu cuối | Chưa có đủ bằng chứng tại thời điểm kiểm tra | Cần cập nhật |
| Mức phân bổ tối đa 35% | Chưa xác nhận | Cần xuất dữ liệu bảng công việc |

---

## 16. Kịch bản báo cáo hoàn chỉnh dành cho leader

### Thời lượng đề xuất: 4 đến 5 phút

> Kính thưa mentor và các thành viên,
>
> Sprint 3 ban đầu được nhóm lập kế hoạch theo phạm vi của một dự án học thuật. Mục tiêu chính là hoàn thiện các luồng chức năng gồm vòng đời phim, quản lý lịch chiếu và cấu hình phòng chiếu - ghế ngồi.
>
> Sau buổi nhận xét tuần trước, mentor yêu cầu nhóm nâng `movie-service` theo định hướng một sản phẩm có khả năng vận hành thực tế. Tôi đánh giá đây là một điều chỉnh cần thiết. Theo tiêu chuẩn mới, một chức năng không chỉ cần chạy được luồng thành công mà còn phải bảo đảm tính toàn vẹn dữ liệu, an toàn di trú cơ sở dữ liệu, phân quyền, tính đúng đắn của vòng đời, an toàn đồng thời, khả năng kiểm toán và kiểm thử hồi quy.
>
> Vì cơ sở dữ liệu và mô hình nghiệp vụ là nền tảng của `movie-service`, thay đổi này ảnh hưởng xuyên suốt từ lược đồ, thực thể, kho dữ liệu, tầng dịch vụ, hợp đồng API đến giao diện. Một số phần đã thực hiện trước đó phải được xem xét và sửa lại để đáp ứng tiêu chuẩn mới.
>
> Từ thời điểm đó, nhóm chuyển trọng tâm từ tư duy hoàn tất chức năng sang tư duy kỹ thuật hướng sản phẩm. Chúng tôi không còn xem một chức năng là hoàn thành chỉ vì API trả về thành công hoặc giao diện hoạt động. Một chức năng chỉ được xem là hoàn thành khi quy tắc nghiệp vụ đúng, dữ liệu được bảo vệ, quyền truy cập phù hợp, di trú an toàn và có bằng chứng kiểm thử.
>
> Trong Sprint này, nhóm đã triển khai các phần quan trọng như xem trước dữ liệu TMDB ở chế độ chỉ đọc, thống nhất ánh xạ giữa xem trước và nhập phim, chặn việc âm thầm bỏ qua thể loại, kiểm tra mức sẵn sàng trước khi chuyển trạng thái, giao diện phim chờ duyệt, sinh ghế theo cấu hình phòng và nền tảng kiểm tra xung đột lịch chiếu.
>
> Tuy nhiên, nhóm chưa hoàn tất toàn bộ issue Sprint 3. Tại thời điểm đóng băng tính năng còn 14 issue đang thực hiện. Nguyên nhân chính là tiêu chuẩn chất lượng và phạm vi kỹ thuật đã thay đổi sau khi Sprint bắt đầu, trong khi nhóm chưa giảm cam kết ban đầu hoặc tái ước lượng năng lực đủ sớm.
>
> Với vai trò leader, tôi chịu trách nhiệm về điểm này. Tôi chưa thực hiện đánh giá tác động và tái xác lập Sprint Backlog ngay sau khi tiêu chuẩn thay đổi. Tôi cũng cho phép quá nhiều issue cùng ở trạng thái đang thực hiện, khiến tiến độ khó theo dõi và làm tăng chi phí tích hợp.
>
> Mặt khác, tôi cho rằng quyết định ưu tiên tính đúng đắn thay vì cố đóng issue là phù hợp. Trước buổi trình diễn, nhóm đã dừng phát triển tính năng mới để chuyển sang ổn định hệ thống và kiểm thử. Kết quả kiểm tra gần nhất cho thấy giao diện biên dịch thành công; `movie-service` đạt 90 trên 91 kiểm thử. Kiểm thử còn lại phát hiện lỗi không đồng bộ giữa loại ảnh trong mã nguồn và ràng buộc cơ sở dữ liệu. Nhóm ghi nhận đây là lỗi cần sửa, không bỏ qua kiểm thử để báo cáo kết quả xanh.
>
> Sau buổi trình diễn, nhóm sẽ gom phần sửa chữa còn lại thành nhóm công việc nâng mức sẵn sàng vận hành của `movie-service`. Giai đoạn đầu ưu tiên an toàn dữ liệu, phân quyền, vòng đời và di trú. Giai đoạn tiếp theo xử lý lịch chiếu và tồn kho ghế. Các nội dung làm giàu dữ liệu như trailer, nhiều ảnh và công ty sản xuất sẽ được thực hiện sau khi nền tảng ổn định.
>
> Bài học quan trọng nhất của Sprint 3 là: khi tiêu chuẩn chất lượng thay đổi đáng kể, leader phải thực hiện đánh giá tác động, tái ước lượng và tái xác lập phạm vi ngay lập tức. Không thể giữ nguyên cam kết cũ khi độ phức tạp và điều kiện hoàn thành đã thay đổi.
>
> Nhóm đánh giá Sprint 3 là một Sprint bàn giao một phần nhưng có giá trị sửa chữa kiến trúc đáng kể. Chúng tôi chưa tuyên bố hệ thống đã sẵn sàng vận hành thực tế, nhưng đã xác định được lộ trình, rủi ro và tiêu chuẩn cần đạt để tiếp tục phát triển theo hướng sản phẩm.
>
> Xin cảm ơn mentor và mọi người.

---

## 17. Câu trả lời chuẩn bị cho phần phản biện

### Câu hỏi 1: Vì sao nhóm không hoàn tất toàn bộ issue Sprint 3?

> Tiêu chuẩn chất lượng của `movie-service` thay đổi đáng kể sau khi Sprint đã bắt đầu. Công việc không còn chỉ là hoàn thiện chức năng mà bao gồm sửa lược đồ, mô hình nghiệp vụ, phân quyền, vòng đời và kiểm thử. Tuy nhiên, nhóm chưa tái xác lập phạm vi và năng lực đủ sớm. Đây là điểm tôi chịu trách nhiệm trong vai trò leader.

### Câu hỏi 2: Nhóm có đang dùng yêu cầu của mentor làm lý do chậm tiến độ không?

> Không. Định hướng mới là cần thiết và giúp dự án có chất lượng tốt hơn. Vấn đề của nhóm nằm ở cách quản trị thay đổi: chúng tôi tiếp nhận phạm vi mới nhưng chưa điều chỉnh cam kết cũ. Bài học là mọi thay đổi lớn phải đi kèm đánh giá tác động và kế hoạch sửa đổi.

### Câu hỏi 3: Hiện tại hệ thống đã sẵn sàng vận hành thực tế chưa?

> Chưa. Nhóm đang phát triển theo định hướng sản phẩm nhưng chưa tuyên bố đã sẵn sàng vận hành. Vẫn còn lỗi tích hợp cơ sở dữ liệu, cần hoàn tất luồng đầu cuối, phân quyền, di trú và các kiểm thử chặn phát hành.

### Câu hỏi 4: Vì sao phải sửa cả cơ sở dữ liệu?

> Cơ sở dữ liệu không chỉ lưu thông tin mà còn bảo vệ các quy tắc bất biến như khóa duy nhất, quan hệ, trạng thái hợp lệ và tính toàn vẹn tham chiếu. Nếu chỉ sửa tầng dịch vụ nhưng giữ lược đồ không an toàn, hệ thống vẫn có thể tạo dữ liệu sai khi có lỗi, nhiều yêu cầu đồng thời hoặc một dịch vụ khác truy cập dữ liệu.

### Câu hỏi 5: Vì sao board có quá nhiều issue đang thực hiện?

> Nhóm đã kéo issue sang đang thực hiện quá sớm và chưa áp dụng giới hạn công việc đang làm. Từ phần còn lại của Sprint, mỗi thành viên chỉ giữ một issue triển khai chính; issue tiếp theo ở trạng thái sẵn sàng cho đến khi có năng lực thực hiện.

### Câu hỏi 6: Leader sẽ làm gì khác ở Sprint tiếp theo?

> Tôi sẽ yêu cầu đánh giá tác động trước khi nhận thay đổi lớn, tái xác lập phạm vi với mentor, ưu tiên theo rủi ro P0 - P1 - P2, phân chủ sở hữu kỹ thuật theo vùng nghiệp vụ, áp dụng Định nghĩa Sẵn sàng và Định nghĩa Hoàn thành, đồng thời đóng băng tính năng trước trình diễn ít nhất 24 đến 48 giờ.

### Câu hỏi 7: Có phải các thành viên thiếu chủ động nên không hoàn thành không?

> Với vai trò leader, tôi không quy kết kết quả Sprint cho một cá nhân. Nếu thành viên chưa chủ động, leader cần cải thiện cách giao quyền sở hữu, làm rõ kết quả mong đợi, giới hạn công việc và cơ chế báo cáo trở ngại. Trách nhiệm điều phối và minh bạch tiến độ thuộc về leader.

---

## 18. Kết luận cuối cùng

Sprint 3 chưa hoàn tất toàn bộ issue đã cam kết. Tuy nhiên, nhóm đã nhận diện rằng tiếp tục bổ sung chức năng trên một nền tảng chưa đáp ứng tiêu chuẩn vận hành sẽ tạo thêm nợ kỹ thuật và làm tăng chi phí sửa chữa ở các Sprint sau.

Điểm chuyển biến quan trọng của Sprint 3 là sự thay đổi tư duy:

> **Từ hoàn tất chức năng sang kỹ thuật hướng sản phẩm; từ kiểm tra “có chạy hay không” sang kiểm chứng “có đúng, an toàn và đủ tin cậy để tiếp tục vận hành hay không”.**

Ba bài học chính:

1. Thay đổi lớn về tiêu chuẩn chất lượng phải dẫn đến tái xác lập phạm vi chính thức.
2. Nâng mức sẵn sàng vận hành là một lộ trình nhiều giai đoạn, không thể đưa toàn bộ vào một Sprint ngắn.
3. Một thay đổi đã hợp nhất nhưng chưa có di trú an toàn, kiểm thử và bằng chứng chạy thực tế thì chưa được xem là hoàn thành.

Sprint 3 được đánh giá là **bàn giao một phần, đồng thời tạo ra giá trị sửa chữa kiến trúc quan trọng**. Phần còn lại phải được tiếp tục theo lộ trình dựa trên rủi ro, có người sở hữu rõ ràng và có năng lực được thống nhất trước khi đưa vào Sprint tiếp theo.
