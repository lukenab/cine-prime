# Landmark 81 — Price Book và Concession Demo Data

## 1. Phạm vi

Tài liệu này cung cấp:

- dữ liệu Price Book để định giá vé cho CinePrime Landmark 81;
- mô hình quản lý bắp, nước, snack và combo để nối sang booking;
- dữ liệu JSON mẫu để test thủ công;
- luồng nghiệp vụ tối thiểu phục vụ demo.

> Các mức giá CinePrime bên dưới là **dữ liệu demo giả lập**, được xây dựng
> theo mô hình giá phổ biến của chuỗi rạp. Đây không phải bảng giá chính thức
> hiện hành của CGV, BHD Star, Galaxy hay Lotte Cinema.

---

## 2. Phân chia domain

### Movie service

Movie service chịu trách nhiệm:

- Price Book và Rate Card của vé;
- chọn rate theo cụm rạp, ngày, giờ và định dạng trình chiếu;
- chụp giá cuối cùng vào `showtime_seat.price` khi materialize inventory;
- công khai duy nhất showtime `ON_SALE`.

`showtime_seat.price` là **final ticket-price snapshot**. Booking không tự tính
lại giá vé từ Price Book.

### Booking service

Booking service chịu trách nhiệm:

- giỏ hàng và booking;
- tham chiếu các ghế đang được giữ;
- chụp lại tên, SKU, lựa chọn và giá bắp–nước vào order line;
- tính subtotal, discount và grand total;
- điều phối trạng thái thanh toán.

### Concession domain

Khuyến nghị dài hạn: một `concession-service` riêng.

MVP học thuật: có thể đặt trong booking-service nhưng phải tách package và bảng
riêng, không đưa bắp–nước vào movie-service.

---

## 3. Price Book dùng để làm gì?

Price Book là bộ chính sách giá vé có hiệu lực theo thời gian tại một cụm rạp.
Mỗi Rate Card bên trong có thể áp dụng theo:

- ngày thường hoặc cuối tuần;
- khung giờ;
- định dạng trình chiếu;
- hệ số ghế Standard, VIP, Couple và Accessible;
- độ ưu tiên khi nhiều rate cùng khớp.

Thứ tự nguồn giá:

1. giá override trực tiếp trên showtime;
2. Price Book đang `ACTIVE` và còn hiệu lực tại cụm rạp;
3. giá mặc định trên ghế của phòng.

Khi tạo hoặc publish showtime, giá được resolve một lần và chụp xuống từng
`showtime_seat`. Việc sửa Price Book sau đó không được làm thay đổi vé của
showtime đã mở bán.

---

## 4. Dữ liệu Price Book cho CinePrime Landmark 81

Thông tin đang có:

- `clusterId`: `43`
- `clusterCode`: `CP-023`
- định dạng: `2D=1`, `3D=2`, `IMAX=3`, `4DX=4`, `SCREENX=5`
- `ATMOS=6` là audio capability cũ, không dùng như presentation format để định giá.

### 4.1 Tạo Price Book

`POST /api/price-books`

```json
{
  "clusterId": 43,
  "code": "L81-REGULAR-2026-H2",
  "name": "Landmark 81 Regular Ticket Rates — H2 2026",
  "currencyCode": "VND",
  "validFrom": "2026-07-27",
  "validTo": "2026-12-31",
  "priority": 100,
  "rates": [
    {
      "name": "Weekday — Off Peak",
      "dayType": "WEEKDAY",
      "startTime": "08:00:00",
      "endTime": "16:59:59",
      "formatId": null,
      "standardPrice": 75000,
      "vipMultiplier": 1.2,
      "coupleMultiplier": 2.0,
      "accessibleMultiplier": 1.0,
      "priority": 10,
      "active": true
    },
    {
      "name": "Weekday — Prime Time",
      "dayType": "WEEKDAY",
      "startTime": "17:00:00",
      "endTime": "23:59:59",
      "formatId": null,
      "standardPrice": 90000,
      "vipMultiplier": 1.2,
      "coupleMultiplier": 2.0,
      "accessibleMultiplier": 1.0,
      "priority": 10,
      "active": true
    },
    {
      "name": "Weekend — Daytime",
      "dayType": "WEEKEND",
      "startTime": "08:00:00",
      "endTime": "16:59:59",
      "formatId": null,
      "standardPrice": 95000,
      "vipMultiplier": 1.2,
      "coupleMultiplier": 2.0,
      "accessibleMultiplier": 1.0,
      "priority": 10,
      "active": true
    },
    {
      "name": "Weekend — Prime Time",
      "dayType": "WEEKEND",
      "startTime": "17:00:00",
      "endTime": "23:59:59",
      "formatId": null,
      "standardPrice": 110000,
      "vipMultiplier": 1.2,
      "coupleMultiplier": 2.0,
      "accessibleMultiplier": 1.0,
      "priority": 10,
      "active": true
    },
    {
      "name": "3D — Weekday",
      "dayType": "WEEKDAY",
      "startTime": "08:00:00",
      "endTime": "23:59:59",
      "formatId": 2,
      "standardPrice": 110000,
      "vipMultiplier": 1.15,
      "coupleMultiplier": 2.0,
      "accessibleMultiplier": 1.0,
      "priority": 100,
      "active": true
    },
    {
      "name": "3D — Weekend",
      "dayType": "WEEKEND",
      "startTime": "08:00:00",
      "endTime": "23:59:59",
      "formatId": 2,
      "standardPrice": 130000,
      "vipMultiplier": 1.15,
      "coupleMultiplier": 2.0,
      "accessibleMultiplier": 1.0,
      "priority": 100,
      "active": true
    },
    {
      "name": "IMAX — Weekday",
      "dayType": "WEEKDAY",
      "startTime": "08:00:00",
      "endTime": "23:59:59",
      "formatId": 3,
      "standardPrice": 150000,
      "vipMultiplier": 1.1,
      "coupleMultiplier": 2.0,
      "accessibleMultiplier": 1.0,
      "priority": 110,
      "active": true
    },
    {
      "name": "IMAX — Weekend",
      "dayType": "WEEKEND",
      "startTime": "08:00:00",
      "endTime": "23:59:59",
      "formatId": 3,
      "standardPrice": 180000,
      "vipMultiplier": 1.1,
      "coupleMultiplier": 2.0,
      "accessibleMultiplier": 1.0,
      "priority": 110,
      "active": true
    }
  ]
}
```

### 4.2 Kích hoạt

Lấy `priceBookId` từ response tạo mới, sau đó:

`POST /api/price-books/{priceBookId}/activate`

Body: không có.

### 4.3 Kiểm tra

1. Tạo hoặc publish một showtime mới sau khi Price Book đã active.
2. Kiểm tra `show_time.price_source = PRICE_BOOK`.
3. Kiểm tra `show_time.price_book_id` và `price_rate_id` không null.
4. Kiểm tra mọi `showtime_seat.price > 0`.
5. Xác nhận VIP và Couple có giá theo multiplier.
6. Sửa Price Book và xác nhận inventory của showtime cũ không đổi.

> Plan #25 được publish trước khi tạo Price Book nên đang dùng
> `ROOM_DEFAULT`. Muốn demo Price Book, hãy tạo một generation run mới sau khi
> kích hoạt Price Book; không nên âm thầm đổi giá của 136 suất đã publish.

---

## 5. Mô hình concession tối thiểu

### 5.1 Bảng catalog

| Bảng | Mục đích |
|---|---|
| `concession_category` | POPCORN, DRINK, SNACK, COMBO, COLLECTIBLE |
| `concession_product` | SKU và thông tin sản phẩm/combo |
| `concession_variant` | size, flavor hoặc packaging |
| `concession_choice_group` | nhóm lựa chọn bắt buộc/tùy chọn trong combo |
| `concession_choice_option` | từng lựa chọn và phụ thu |
| `cluster_concession_listing` | cụm rạp nào đang bán hoặc tạm hết hàng |
| `concession_price_book` | giá theo cụm, channel và thời gian hiệu lực |
| `concession_price` | giá sản phẩm/variant/option |

### 5.2 Bảng transactional

| Bảng | Mục đích |
|---|---|
| `booking_concession_line` | snapshot SKU, tên, lựa chọn, số lượng và giá |
| `concession_fulfillment` | trạng thái chế biến/nhận hàng và pickup code |

Không liên kết order line chỉ bằng FK tới catalog. Phải lưu snapshot để việc sửa
tên hoặc giá sản phẩm không làm thay đổi lịch sử đơn.

### 5.3 Trạng thái

Catalog:

- `DRAFT`
- `ACTIVE`
- `INACTIVE`
- `ARCHIVED`

Availability theo cụm:

- `AVAILABLE`
- `SOLD_OUT`
- `NOT_SOLD`

Fulfillment:

- `ORDERED`
- `PREPARING`
- `READY`
- `REDEEMED`
- `CANCELLED`

P0 chỉ cần nút `SOLD_OUT` theo cụm rạp. Không nên xây tồn kho nguyên liệu bắp,
đá, syrup ở Sprint booking đầu tiên.

---

## 6. Dữ liệu concession demo

Giá dưới đây là giá giả lập cho CinePrime Landmark 81.

```json
{
  "clusterId": 43,
  "currency": "VND",
  "channel": "WEB",
  "validFrom": "2026-07-27T00:00:00+07:00",
  "products": [
    {
      "sku": "CP-POP-L",
      "name": "Large Popcorn",
      "category": "POPCORN",
      "basePrice": 65000,
      "choices": {
        "flavor": [
          { "code": "SWEET", "name": "Sweet", "priceDelta": 0 },
          { "code": "CARAMEL", "name": "Caramel", "priceDelta": 9000 },
          { "code": "CHEESE", "name": "Cheese", "priceDelta": 15000 }
        ]
      }
    },
    {
      "sku": "CP-DRINK-L",
      "name": "Large Soft Drink",
      "category": "DRINK",
      "basePrice": 39000,
      "choices": {
        "drink": [
          { "code": "COKE", "name": "Coca-Cola", "priceDelta": 0 },
          { "code": "COKE_ZERO", "name": "Coca-Cola Zero", "priceDelta": 0 },
          { "code": "SPRITE", "name": "Sprite", "priceDelta": 0 }
        ]
      }
    },
    {
      "sku": "CP-COMBO-SOLO",
      "name": "Solo Combo",
      "category": "COMBO",
      "basePrice": 89000,
      "components": [
        { "productSku": "CP-POP-L", "quantity": 1 },
        { "productSku": "CP-DRINK-L", "quantity": 1 }
      ]
    },
    {
      "sku": "CP-COMBO-COUPLE",
      "name": "Couple Combo",
      "category": "COMBO",
      "basePrice": 129000,
      "components": [
        { "productSku": "CP-POP-L", "quantity": 1 },
        { "productSku": "CP-DRINK-L", "quantity": 2 }
      ]
    },
    {
      "sku": "CP-SNACK-CHIPS",
      "name": "Potato Chips",
      "category": "SNACK",
      "basePrice": 29000
    }
  ]
}
```

### Một order line phải được snapshot như sau

```json
{
  "productId": 103,
  "skuSnapshot": "CP-COMBO-COUPLE",
  "nameSnapshot": "Couple Combo",
  "quantity": 1,
  "unitPrice": 138000,
  "selectedOptions": [
    {
      "group": "Popcorn flavor",
      "code": "CARAMEL",
      "name": "Caramel",
      "priceDelta": 9000
    },
    {
      "group": "Drink 1",
      "code": "COKE_ZERO",
      "name": "Coca-Cola Zero",
      "priceDelta": 0
    },
    {
      "group": "Drink 2",
      "code": "SPRITE",
      "name": "Sprite",
      "priceDelta": 0
    }
  ],
  "lineTotal": 138000
}
```

---

## 7. Luồng booking có bắp–nước

1. Customer chọn showtime `ON_SALE`.
2. Movie service trả seat inventory và giá snapshot.
3. Booking service tạo atomic seat hold có owner, expiry và idempotency key.
4. Customer chọn bắp–nước đang `AVAILABLE` tại đúng cụm rạp của showtime.
5. Concession domain resolve giá và trả product snapshot.
6. Booking service tạo pending booking gồm ticket lines và concession lines.
7. Payment thành công:
   - booking chuyển `CONFIRMED`;
   - seat chuyển `SOLD`;
   - concession fulfillment chuyển `ORDERED`;
   - tạo QR/pickup code.
8. Nhân viên quầy chuyển `PREPARING → READY → REDEEMED`.

Nên hỗ trợ hai order context:

- `WITH_BOOKING`: mua kèm vé;
- `STORE_ONLY`: mua riêng và chọn cụm rạp/ngày nhận.

---

## 8. Acceptance checklist cho P0

- [ ] Không có giá vé hard-code trong frontend hoặc booking-service.
- [ ] `showtime_seat.price` là nguồn giá vé duy nhất của booking.
- [ ] Price Book chỉ tác động tới showtime/inventory tạo sau thời điểm áp dụng.
- [ ] Product/variant/combo có SKU ổn định.
- [ ] Giá concession phụ thuộc cụm rạp và thời gian hiệu lực.
- [ ] Combo hỗ trợ option và phụ thu, không chỉ lưu một chuỗi mô tả.
- [ ] Cluster có thể đánh dấu một món `SOLD_OUT`.
- [ ] Booking lưu snapshot của cả vé và concession.
- [ ] Hủy/thanh toán thất bại giải phóng seat hold; không tự động coi bắp–nước là đã nhận.
- [ ] Customer chỉ thấy sản phẩm bán tại cụm rạp của showtime.
- [ ] QR/pickup code chỉ redeem một lần.

---

## 9. Tài liệu tham khảo nghiệp vụ

- [CGV FAQ — kích cỡ, combo, đổi vị và mua online](https://www.cgv.vn/default/faq/)
- [CGV Store — mua bắp nước tách riêng với vé](https://www.cgv.vn/default/newsoffer/cgv-new-function/)
- [CGV Online Package — vé và bắp nước trong cùng hành trình](https://www.cgv.vn/en/newsoffer/cgv-onlinepackage/)
- [BHD Star Couple Combo](https://www.bhdstar.vn/mon-an/couple-combo-combo-bap-nuoc-mua-he-danh-cho-cap-doi/)
- [BHD Star Single Combo](https://www.bhdstar.vn/mon-an/%F0%9F%8C%9E-single-combo-uu-dai-he-gia-chi-85k-%F0%9F%8C%B4/)

