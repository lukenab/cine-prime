# MR Description — [Database] Add cinema_cluster table and link cinema_room

> Copy nội dung bên dưới vào GitLab MR description.
> Branch: `feat/cinema-cluster-crud` → target: `develop`

---

## Overview / Objective

Thêm bảng `cinema_cluster` vào `movie_db` để quản lý cụm rạp chiếu phim theo địa điểm/tỉnh thành. Thêm FK `cluster_id` (nullable) vào `cinema_room` để link phòng chiếu vào cụm rạp. Bao gồm seed data 6 cluster mẫu khớp với mock data frontend.

Related Issue: Closes #[database-cinema-cluster-issue]

---

## Changes Introduced

**Database / Migration (`V3__add_cinema_cluster.sql`):**
- Tạo bảng `cinema_cluster`:
  - `cluster_id` BIGSERIAL PK
  - `cluster_name` VARCHAR(100) NOT NULL
  - `province` VARCHAR(100) NOT NULL — tỉnh/thành phố
  - `address` VARCHAR(255) NOT NULL
  - `phone_number` VARCHAR(20)
  - `status` VARCHAR(10) CHECK (`ACTIVE | INACTIVE`) DEFAULT `ACTIVE`
  - `created_at`, `updated_at` với trigger `set_updated_at()`
- `ALTER TABLE cinema_room ADD COLUMN cluster_id BIGINT REFERENCES cinema_cluster(cluster_id) ON DELETE SET NULL`
- `CREATE INDEX idx_cinema_room_cluster ON cinema_room(cluster_id)`
- Seed 6 cluster mẫu (TP.HCM, Hà Nội, Đà Nẵng, Cần Thơ)
- Gán 4 phòng hiện có vào cluster 1 (CinePrime Quận 1)

**Docs:**
- `dbdiagram_cineprime.dbml` — cập nhật schema diagram đầy đủ 17 bảng bao gồm `cinema_cluster`, paste vào [dbdiagram.io](https://dbdiagram.io) để xem diagram

---

## Key Architectural Decisions

- **FK nullable (`ON DELETE SET NULL`)** — phòng chiếu hiện có không bị break sau migration. Admin gán cluster cho phòng qua UI sau khi tạo cluster. Khi xóa cluster, phòng không bị xóa theo mà chỉ unlink (`cluster_id = NULL`).

- **`ON DELETE SET NULL` thay vì `CASCADE`** — xóa cluster không nên kéo theo xóa phòng (phòng có lịch sử showtime, seat, booking). Service layer chặn xóa cluster khi còn phòng (`CLUSTER_HAS_ROOMS 409`) để tránh orphaned rooms trước khi FK cho phép NULL.

- **Trigger `set_updated_at()`** — dùng lại function đã có trong schema, không tạo thêm function mới.

- **Seed data khớp mock frontend** — 6 cluster trong seed data giống hệt `MOCK_CLUSTERS` trong `ManageCinemaClusterPage.tsx`, giúp frontend render đúng ngay khi backend chạy mà không cần tạo data thủ công.

---

## How to Test

**Chạy migration:**

1. Copy file vào container và execute:
   ```bash
   docker cp docs/database/movie-service/V3__add_cinema_cluster.sql postgres:/tmp/
   docker exec -it postgres psql -U postgres -d movie_db -f /tmp/V3__add_cinema_cluster.sql
   ```
   Hoặc mở file trong DBeaver/pgAdmin → Execute (kết nối `localhost:5433`, db `movie_db`)

**Verify schema:**

2. Kiểm tra bảng tồn tại:
   ```sql
   \d cinema_cluster
   ```
   → hiển thị đủ 8 cột + constraints

3. Kiểm tra FK trên cinema_room:
   ```sql
   \d cinema_room
   ```
   → thấy cột `cluster_id bigint` + foreign key constraint

4. Kiểm tra index:
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename = 'cinema_room' AND indexname = 'idx_cinema_room_cluster';
   ```
   → trả về 1 dòng

**Verify seed data:**

5. ```sql
   SELECT cluster_id, cluster_name, province, status FROM cinema_cluster ORDER BY cluster_id;
   ```
   → 6 dòng: 2 TP.HCM, 2 Hà Nội, 1 Đà Nẵng, 1 Cần Thơ (INACTIVE)

6. ```sql
   SELECT cinema_room_id, cinema_room_name, cluster_id FROM cinema_room;
   ```
   → 4 phòng đều có `cluster_id = 1`

**Verify trigger:**

7. ```sql
   UPDATE cinema_cluster SET cluster_name = 'CinePrime Quận 1 Test' WHERE cluster_id = 1;
   SELECT updated_at FROM cinema_cluster WHERE cluster_id = 1;
   ```
   → `updated_at` tự cập nhật thành thời điểm hiện tại

**Verify ON DELETE SET NULL:**

8. Tạo cluster mới, gán 1 phòng vào cluster đó, sau đó xóa cluster:
   ```sql
   INSERT INTO cinema_cluster (cluster_name, province, address) VALUES ('Test', 'Hà Nội', 'Test addr');
   UPDATE cinema_room SET cluster_id = currval('cinema_cluster_cluster_id_seq') WHERE cinema_room_id = 1;
   DELETE FROM cinema_cluster WHERE cluster_name = 'Test';
   SELECT cluster_id FROM cinema_room WHERE cinema_room_id = 1;
   ```
   → `cluster_id` của phòng trở về NULL, phòng không bị xóa

---

## Checklist

**General**
- [x] Script idempotent: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`
- [x] Không break dữ liệu hiện có (FK nullable, `ON DELETE SET NULL`)
- [x] Follows naming convention của project (`snake_case`, `_id` suffix cho PK/FK)

**Database**
- [x] PK dùng `BIGSERIAL` nhất quán với các bảng khác (`cinema_room`, `production_company`…)
- [x] `updated_at` trigger dùng lại `set_updated_at()` function đã có
- [x] Index trên FK `cluster_id` để tránh full scan khi JOIN
- [x] `setval` sequence sau seed để tránh PK conflict khi INSERT tiếp
- [x] Schema diagram (`dbdiagram_cineprime.dbml`) cập nhật đồng bộ

---

## Reviewer Notes

- **Fresh setup**: thêm nội dung `V3__add_cinema_cluster.sql` vào cuối `server/postgres-init/movie_db.sql` để `docker-compose up` fresh tự chạy luôn (hiện tại chỉ chạy thủ công vì project không dùng Flyway/Liquibase)
- **`dbdiagram_cineprime.dbml`**: paste toàn bộ nội dung vào [dbdiagram.io](https://dbdiagram.io) → Import → DBML để render diagram trực quan
- **Seed `cluster_id = 1..6`**: hardcode để khớp với `MOCK_CLUSTERS` frontend — nếu DB đã có data thì chạy `ON CONFLICT DO NOTHING` sẽ skip
