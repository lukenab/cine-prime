# Luồng tạo Movie - dữ liệu và test case Postman chi tiết

> Snapshot source: 2026-07-14
>
> Phạm vi: `server/movie-service`, tập trung vào `POST /api/movies` và các bước xác minh/lifecycle ngay sau khi tạo.
>
> Căn cứ: controller, DTO validation, service, repository, database constraint và security configuration hiện tại.

## Dùng trực tiếp trong Postman

Nếu bạn muốn test bằng giao diện Postman thay vì tự tạo request từ tài liệu này, hãy
import collection sau:

- [`CinePrime-Movie-Creation.postman_collection.json`](CinePrime-Movie-Creation.postman_collection.json)
- [JSON body cho từng case test thủ công](CinePrime-Movie-Creation.manual-test-data.json)

Sau khi import, chạy các folder theo thứ tự `00 - Setup` -> `01 - Happy Path` ->
`02 - Validation Cases` -> `03 - Current Gap Cases`. Mỗi request trong collection là
một test case độc lập và đã có script kiểm tra Pass/Fail trong tab `Scripts`.

## 1. Luồng cần kiểm thử

1. Lấy ID thật của genre, format, age rating, company và person.
2. ADMIN hoặc EMPLOYEE tạo Movie.
3. Movie mới có trạng thái `DRAFT`.
4. Các quan hệ genre, format, translations và cast được lưu đủ.
5. `DRAFT` không xuất hiện trong danh sách public.
6. Movie đi qua `DRAFT -> PENDING_REVIEW -> COMING_SOON`.
7. Request lỗi không để lại Movie hoặc quan hệ dở dang.

## 2. Cấu hình Postman

### 2.1 Collection variables

| Variable | Giá trị mẫu | Ý nghĩa |
|---|---|---|
| `baseUrl` | `http://localhost:8081` | Gọi trực tiếp movie-service |
| `adminToken` | JWT có `ROLE_ADMIN` | Tạo và duyệt Movie |
| `employeeToken` | JWT có `ROLE_EMPLOYEE` | Tạo và submit Movie |
| `runId` | Sinh tự động | Tránh trùng title |
| `releaseDate` | Sinh tự động | Hôm nay + 30 ngày |
| `endDate` | Sinh tự động | Hôm nay + 60 ngày |
| `genreId` | `1` nếu dùng seed | Genre hợp lệ |
| `formatId` | `1` nếu dùng seed | Format hợp lệ |
| `ageRatingId` | `3` nếu dùng seed | T13 |
| `companyId` | `1` nếu dùng seed | Warner Bros. Pictures |
| `directorId` | `1` nếu dùng seed | Denis Villeneuve |
| `actorId` | `9` nếu dùng seed | Timothee Chalamet |
| `movieId` | Lưu sau khi tạo | Dùng cho các bước sau |

Xóa biến `runId` trước một lượt test mới. Dùng collection-level pre-request script:

```javascript
if (!pm.collectionVariables.get("runId")) {
  pm.collectionVariables.set("runId", Date.now().toString());
}

function localDatePlusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

pm.collectionVariables.set("releaseDate", localDatePlusDays(30));
pm.collectionVariables.set("endDate", localDatePlusDays(60));
```

Header cho request tạo:

```http
Content-Type: application/json
Authorization: Bearer {{employeeToken}}
```

Lưu ý: endpoint tạo Movie hiện trả HTTP `200`, không phải `201`.

## 3. Chuẩn bị dữ liệu tham chiếu

### PRE-01 - Genre

```http
GET {{baseUrl}}/api/genres
```

Seed thường có `1=Hành động`, `5=Tâm lý`, `9=Khoa học viễn tưởng`.

```javascript
const items = pm.response.json().result;
const selected = items.find(x => x.genreId === 1) || items[0];
pm.expect(selected, "Cần ít nhất một genre").to.exist;
pm.collectionVariables.set("genreId", selected.genreId);
```

### PRE-02 - Screening format

```http
GET {{baseUrl}}/api/screening-formats
Authorization: Bearer {{employeeToken}}
```

Seed thường có `1=2D`, `2=3D`, `3=IMAX`, `4=4DX`, `5=SCREENX`, `6=ATMOS`.

```javascript
const items = pm.response.json().result;
const selected = items.find(x => x.formatCode === "2D") || items[0];
pm.expect(selected, "Cần ít nhất một format").to.exist;
pm.collectionVariables.set("formatId", selected.formatId);
```

### PRE-03 - Age rating

```http
GET {{baseUrl}}/api/age-ratings
Authorization: Bearer {{employeeToken}}
```

Seed thường có `1=P`, `2=K`, `3=T13`, `4=T16`, `5=T18`, `6=C`.

```javascript
const items = pm.response.json().result;
const selected = items.find(x => x.ratingCode === "T13") || items[0];
pm.expect(selected, "Cần age rating").to.exist;
pm.collectionVariables.set("ageRatingId", selected.ratingId);
```

### PRE-04 - Production company

```http
GET {{baseUrl}}/api/companies?q=Warner
Authorization: Bearer {{employeeToken}}
```

```javascript
const items = pm.response.json().result;
pm.expect(items).to.be.an("array").that.is.not.empty;
pm.collectionVariables.set("companyId", items[0].companyId);
```

### PRE-05 - Director và actor

```http
GET {{baseUrl}}/api/persons?q=Denis
Authorization: Bearer {{employeeToken}}
```

Lưu phần tử đầu vào `directorId`, sau đó tìm `Timothee` và lưu vào `actorId`:

```javascript
const items = pm.response.json().result;
pm.expect(items).to.be.an("array").that.is.not.empty;
pm.collectionVariables.set("directorId", items[0].personId);
```

Nếu seed bị lỗi encoding tên, gọi `GET /api/persons` và chọn theo `personId`.

## 4. Dữ liệu tạo Movie hợp lệ

### MOV-CREATE-01 - Payload tối thiểu

```http
POST {{baseUrl}}/api/movies
Authorization: Bearer {{employeeToken}}
Content-Type: application/json
```

```json
{
  "originalTitle": "Postman Minimal Movie {{runId}}",
  "originalLanguage": "vi",
  "durationMinutes": 90,
  "genreIds": [{{genreId}}],
  "formatIds": [{{formatId}}]
}
```

Expected hiện tại:

- HTTP `200`, body `code=200`.
- Có `result.movieId`.
- `result.status="DRAFT"`.
- Age rating, company, dates, media, translations và cast có thể null/rỗng.

### MOV-CREATE-02 - Payload đầy đủ khuyến nghị

```json
{
  "originalTitle": "The Last Horizon {{runId}}",
  "originalLanguage": "en",
  "durationMinutes": 128,
  "releaseDate": "{{releaseDate}}",
  "endDate": "{{endDate}}",
  "country": "USA",
  "ageRatingId": {{ageRatingId}},
  "companyId": {{companyId}},
  "genreIds": [{{genreId}}],
  "formatIds": [{{formatId}}],
  "posterUrl": "https://placehold.co/780x1170/png?text=The+Last+Horizon",
  "thumbnailUrl": "https://placehold.co/342x513/png?text=The+Last+Horizon",
  "trailerUrl": "https://www.youtube.com/watch?v=test-{{runId}}",
  "synopsis": "Một đoàn thám hiểm thực hiện nhiệm vụ cuối cùng bên ngoài hệ Mặt Trời.",
  "translations": [
    {
      "languageCode": "en",
      "title": "The Last Horizon",
      "synopsis": "A crew undertakes one final mission beyond the solar system."
    },
    {
      "languageCode": "vi",
      "title": "Chân Trời Cuối Cùng",
      "synopsis": "Một đoàn thám hiểm thực hiện nhiệm vụ cuối cùng bên ngoài hệ Mặt Trời."
    }
  ],
  "cast": [
    {
      "personId": {{directorId}},
      "roleType": "DIRECTOR",
      "characterName": null,
      "billingOrder": 1
    },
    {
      "personId": {{actorId}},
      "roleType": "ACTOR",
      "characterName": "Commander Minh",
      "billingOrder": 2
    }
  ]
}
```

`tmdbId` và `imdbId` là optional. Nếu test hai trường này, phải dùng giá trị unique; `imdbId` tối đa 20 ký tự.

### Test script cho create thành công

```javascript
pm.test("HTTP 200", () => pm.response.to.have.status(200));
const body = pm.response.json();

pm.test("ApiResponse hợp lệ", function () {
  pm.expect(body.code).to.eql(200);
  pm.expect(body.result).to.be.an("object");
});

pm.test("Movie mới là DRAFT", function () {
  pm.expect(body.result.movieId).to.be.a("number");
  pm.expect(body.result.status).to.eql("DRAFT");
  pm.expect(body.result.durationMinutes).to.eql(128);
});

pm.test("Quan hệ được lưu", function () {
  pm.expect(body.result.genres).to.be.an("array").that.is.not.empty;
  pm.expect(body.result.formats).to.be.an("array").that.is.not.empty;
  pm.expect(body.result.translations).to.have.length(2);
  pm.expect(body.result.cast).to.have.length(2);
  pm.expect(body.result.ageRating.ratingId)
    .to.eql(Number(pm.collectionVariables.get("ageRatingId")));
});

pm.collectionVariables.set("movieId", body.result.movieId);
```

## 5. Xác minh sau khi tạo

### MOV-VERIFY-01 - GET chi tiết

```http
GET {{baseUrl}}/api/movies/{{movieId}}
```

```javascript
pm.test("GET thành công", () => pm.response.to.have.status(200));
const movie = pm.response.json().result;

pm.test("Đúng ID và DRAFT", function () {
  pm.expect(movie.movieId).to.eql(Number(pm.collectionVariables.get("movieId")));
  pm.expect(movie.status).to.eql("DRAFT");
});

pm.test("Có vi, en, DIRECTOR và ACTOR", function () {
  pm.expect(movie.translations.map(x => x.languageCode)).to.include.members(["vi", "en"]);
  pm.expect(movie.cast.map(x => x.roleType)).to.include.members(["DIRECTOR", "ACTOR"]);
});
```

### MOV-VERIFY-02 - Filter bản dịch

```http
GET {{baseUrl}}/api/movies/{{movieId}}?lang=vi
```

Expected: chỉ có một translation với `languageCode="vi"`.

### MOV-VERIFY-03 - DRAFT không nằm trong danh sách public

```http
GET {{baseUrl}}/api/movies/public
```

```javascript
const movies = pm.response.json().result;
const id = Number(pm.collectionVariables.get("movieId"));
pm.test("DRAFT không public", () => {
  pm.expect(movies.some(x => x.movieId === id)).to.eql(false);
});
```

### MOV-VERIFY-04 - DRAFT có trong danh sách nội bộ

```http
GET {{baseUrl}}/api/movies/all
Authorization: Bearer {{employeeToken}}
```

Expected: tìm thấy `movieId` với status `DRAFT`.

## 6. Submit và approve sau khi tạo

| ID | Request | Token | Expected |
|---|---|---|---|
| MOV-FLOW-01 | `POST /api/movies/{movieId}/submit` | EMPLOYEE | 200; DRAFT -> PENDING_REVIEW |
| MOV-FLOW-02 | Lặp lại submit | EMPLOYEE | 400, code 2020 |
| MOV-FLOW-03 | `POST /api/movies/{movieId}/approve` | EMPLOYEE | 403, code 1009 |
| MOV-FLOW-04 | `POST /api/movies/{movieId}/approve` | ADMIN | 200; PENDING_REVIEW -> COMING_SOON |
| MOV-FLOW-05 | GET `/api/movies/public` | Không token | Movie COMING_SOON xuất hiện |

## 7. Test case chi tiết cho POST /api/movies

Clone `MOV-CREATE-02`, đổi `originalTitle` cho mỗi case, rồi chỉ sửa trường đang test.

### 7.1 Authentication và core fields

| ID | Dữ liệu/thao tác | Expected hiện tại |
|---|---|---|
| MC-AUTH-01 | Không Authorization | 401 |
| MC-AUTH-02 | Token sai/hết hạn | 401 |
| MC-AUTH-03 | Token EMPLOYEE | 200, tạo DRAFT |
| MC-AUTH-04 | Token ADMIN | 200, tạo DRAFT |
| MC-AUTH-05 | Role khác | 403, code 1009 |
| MC-CORE-01 | Bỏ/blank `originalTitle` | 400 |
| MC-CORE-02 | Title dài 501 ký tự | 400 |
| MC-CORE-03 | Bỏ `originalLanguage` | 400 |
| MC-CORE-04 | Language dài 1 hoặc 3 ký tự | 400 |
| MC-CORE-05 | `originalLanguage="12"` | 200; mới chỉ kiểm tra độ dài |
| MC-CORE-06 | Bỏ `durationMinutes` | 400 |
| MC-CORE-07 | Duration `0` hoặc âm | 400 |
| MC-CORE-08 | Duration `1` | 200; DTO cho phép |
| MC-CORE-09 | Country dài 101 ký tự | 400 |
| MC-CORE-10 | Một media URL dài 501 ký tự | 400 |
| MC-CORE-11 | Media URL là `abc` | 200; chưa validate URL |
| MC-CORE-12 | `imdbId` dài 21 ký tự | 400 |
| MC-CORE-13 | `synopsis=null` hoặc rất dài | 200; không giới hạn DTO |

### 7.2 Genre, format, age rating và company

| ID | Dữ liệu thay đổi | Expected hiện tại |
|---|---|---|
| MC-REF-01 | Bỏ `genreIds` hoặc `[]` | 400 |
| MC-REF-02 | `genreIds=[99999999]` | 404, code 2010 |
| MC-REF-03 | Genre hợp lệ + không tồn tại | 404, code 2010; rollback |
| MC-REF-04 | Lặp cùng genre ID | Có thể bị 404 do so sánh số phần tử; defect |
| MC-REF-05 | Bỏ `formatIds` hoặc `[]` | 400 |
| MC-REF-06 | `formatIds=[99999999]` | 404, code 2018 |
| MC-REF-07 | Format hợp lệ + không tồn tại | 404, code 2018; rollback |
| MC-REF-08 | Lặp cùng format ID | Có thể bị 404; defect |
| MC-REF-09 | `ageRatingId=null` | 200; optional |
| MC-REF-10 | Age rating không tồn tại | 404, code 2016 |
| MC-REF-11 | `companyId=null` | 200; optional |
| MC-REF-12 | Company không tồn tại | 404, code 2017 |

### 7.3 Dates

| ID | Dữ liệu thay đổi | Expected hiện tại |
|---|---|---|
| MC-DATE-01 | Hai ngày null | 200 |
| MC-DATE-02 | Ngày dạng `14/08/2026` | 400, code 1005 |
| MC-DATE-03 | `endDate < releaseDate` | Có thể được chấp nhận; defect |
| MC-DATE-04 | Release date trong quá khứ | Được chấp nhận |
| MC-DATE-05 | Release date bằng end date | Được chấp nhận |

### 7.4 Translations

| ID | Dữ liệu thay đổi | Expected hiện tại |
|---|---|---|
| MC-TR-01 | Bỏ/null/`[]` translations | 200 |
| MC-TR-02 | Thiếu/blank language code | 400 |
| MC-TR-03 | Language code dài 1 hoặc 3 | 400 |
| MC-TR-04 | `languageCode="12"` | 200; chưa validate ISO 639-1 |
| MC-TR-05 | Thiếu/blank title | 400 |
| MC-TR-06 | Title dài 501 ký tự | 400 |
| MC-TR-07 | Hai translation cùng language | 409, code 1006 |
| MC-TR-08 | Translation synopsis null | 200 |

Payload gây trùng language:

```json
"translations": [
  { "languageCode": "vi", "title": "Tên một", "synopsis": null },
  { "languageCode": "vi", "title": "Tên hai", "synopsis": null }
]
```

### 7.5 Cast

Role database cho phép: `ACTOR`, `DIRECTOR`, `WRITER`, `PRODUCER`, `COMPOSER`.

| ID | Dữ liệu thay đổi | Expected hiện tại |
|---|---|---|
| MC-CAST-01 | Bỏ/null/`[]` cast | 200 |
| MC-CAST-02 | Thiếu `personId` | 400 |
| MC-CAST-03 | Person không tồn tại | 404, code 2019; rollback |
| MC-CAST-04 | Thiếu/blank role | 400 |
| MC-CAST-05 | Role `actor` hoặc `INVALID` | 409, code 1006 từ DB constraint |
| MC-CAST-06 | Cùng person + role hai lần | 409, code 1006 |
| MC-CAST-07 | ACTOR không characterName | 200 |
| MC-CAST-08 | DIRECTOR có characterName | 200 |
| MC-CAST-09 | Billing order âm | 200; chưa validate |

Payload gây trùng cast:

```json
"cast": [
  { "personId": {{actorId}}, "roleType": "ACTOR", "characterName": "A", "billingOrder": 1 },
  { "personId": {{actorId}}, "roleType": "ACTOR", "characterName": "B", "billingOrder": 2 }
]
```

### 7.6 Duplicate và external IDs

| ID | Dữ liệu/thao tác | Expected hiện tại |
|---|---|---|
| MC-DUP-01 | Tạo lại cùng original title | 409, code 2014 |
| MC-DUP-02 | Cùng title nhưng khác hoa/thường | 409, code 2014 |
| MC-DUP-03 | Cùng title nhưng format khác | Vẫn 409; code chỉ so original title |
| MC-DUP-04 | Movie khác title nhưng trùng `tmdbId` | 409, code 1006 |
| MC-DUP-05 | Movie khác title nhưng trùng `imdbId` | 409, code 1006 |

## 8. Kiểm tra transaction rollback

### MC-TX-01 - Person không tồn tại

1. Gửi title `Rollback Cast {{runId}}` với `personId=99999999`.
2. Expected: 404, code 2019.
3. Sửa person ID thành hợp lệ và gửi lại đúng title.
4. Expected: tạo thành công. Nếu nhận 2014 thì request lỗi trước đã để lại Movie rác.

### MC-TX-02 - Translation trùng language

1. Gửi title `Rollback Translation {{runId}}` với hai translation `vi`.
2. Expected: 409, code 1006.
3. Xóa một translation và gửi lại đúng title.
4. Expected: tạo thành công.

## 9. Gap cần ghi nhận

| ID | Case chẩn đoán | Source hiện tại | Kỳ vọng đề xuất |
|---|---|---|---|
| MC-GAP-01 | Tạo minimal draft rồi submit | Submit chỉ kiểm tra status | Chặn nếu thiếu metadata bắt buộc |
| MC-GAP-02 | Public GET trực tiếp draft ID | GET theo ID permit và không lọc status | Không lộ DRAFT/PENDING/REJECTED |
| MC-GAP-03 | End date trước release date | Chưa có validator | 400 |
| MC-GAP-04 | Language code `12` | Chỉ kiểm tra 2 ký tự | Chỉ nhận ISO 639-1 |
| MC-GAP-05 | Media URL là `abc` | Chỉ kiểm tra chiều dài | Validate URL |
| MC-GAP-06 | Invalid cast role | DB trả integrity chung | DTO enum, trả 400 rõ ràng |
| MC-GAP-07 | `createdBy` và audit create | Service ghi cứng `SYSTEM`/`Admin` | Ghi đúng principal |
| MC-GAP-08 | Duplicate title | Message nói title VN + format, code chỉ so original title | Đồng bộ rule và message |

## 10. Checklist kết thúc

- [ ] PRE-01 đến PRE-05 lấy được ID thật.
- [ ] Minimal payload tạo DRAFT thành công.
- [ ] Full payload trả và lưu đủ quan hệ.
- [ ] GET chi tiết và filter language đúng.
- [ ] DRAFT không nằm trong public list.
- [ ] EMPLOYEE submit được nhưng không approve được.
- [ ] ADMIN approve được, COMING_SOON xuất hiện public.
- [ ] Validation trả đúng HTTP/body code.
- [ ] Hai case rollback không để lại dữ liệu rác.
- [ ] Mỗi `MC-GAP-*` có actual result và issue nếu tái hiện.

## 11. Bảng ghi kết quả

| Case ID | Actual HTTP | Body code | Pass/Fail | Issue/ghi chú |
|---|---:|---:|---|---|
| MOV-CREATE-02 |  |  |  |  |
| MOV-VERIFY-01 |  |  |  |  |
| MOV-FLOW-01 |  |  |  |  |
| MOV-FLOW-04 |  |  |  |  |
| MC-TX-01 |  |  |  |  |
| MC-TX-02 |  |  |  |  |
| MC-GAP-01 |  |  |  |  |
| MC-GAP-02 |  |  |  |  |
