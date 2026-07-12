## Overview / Objective

Them bang cinema_cluster vao movie_db de quan ly cum rap chieu phim theo dia diem/tinh thanh. Them FK cluster_id (nullable) vao cinema_room de link phong chieu vao cum rap. Bao gom seed data 6 cluster mau khop voi mock data frontend.

Related Issue: Closes #[database-cinema-cluster-issue]

---

## Changes Introduced

**Database / Migration (V3__add_cinema_cluster.sql):**
- Tao bang cinema_cluster:
  - cluster_id BIGSERIAL PRIMARY KEY
  - cluster_name VARCHAR(100) NOT NULL
  - province VARCHAR(100) NOT NULL
  - address VARCHAR(255) NOT NULL
  - phone_number VARCHAR(20)
  - status VARCHAR(10) CHECK (ACTIVE, INACTIVE) DEFAULT ACTIVE
  - created_at, updated_at voi trigger set_updated_at()
- ALTER TABLE cinema_room ADD COLUMN cluster_id BIGINT REFERENCES cinema_cluster ON DELETE SET NULL
- CREATE INDEX idx_cinema_room_cluster ON cinema_room(cluster_id)
- Seed 6 cluster mau (TP.HCM, Ha Noi, Da Nang, Can Tho)
- Gan 4 phong hien co vao cluster_id = 1 (CinePrime Quan 1)

**Docs:**
- dbdiagram_cineprime.dbml cap nhat schema diagram day du 17 bang bao gom cinema_cluster, paste vao dbdiagram.io de xem diagram

---

## Key Architectural Decisions

- FK nullable (ON DELETE SET NULL): phong chieu hien co khong bi break sau migration. Khi xoa cluster, phong khong bi xoa theo ma chi set cluster_id = NULL.

- ON DELETE SET NULL thay vi CASCADE: xoa cluster khong nen keo theo xoa phong (phong co lich su showtime, seat, booking). Service layer chan xoa cluster khi con phong (CLUSTER_HAS_ROOMS 409).

- Trigger set_updated_at(): dung lai function da co trong schema, khong tao them function moi.

- Seed data khop mock frontend: 6 cluster trong seed data giong het MOCK_CLUSTERS trong ManageCinemaClusterPage.tsx.

---

## How to Test

**Chay migration:**

1. Copy file vao container va execute:

   docker cp docs/database/movie-service/V3__add_cinema_cluster.sql postgres:/tmp/

   docker exec -it postgres psql -U postgres -d movie_db -f /tmp/V3__add_cinema_cluster.sql

   Hoac mo file trong DBeaver/pgAdmin, ket noi localhost:5433, database movie_db, chay Execute.

**Verify schema:**

2. Kiem tra bang ton tai va co du 8 cot + constraints trong DBeaver hoac chay:
   SELECT column_name FROM information_schema.columns WHERE table_name = 'cinema_cluster';

3. Kiem tra FK tren cinema_room:
   SELECT column_name FROM information_schema.columns WHERE table_name = 'cinema_room' AND column_name = 'cluster_id';

4. Kiem tra index:
   SELECT indexname FROM pg_indexes WHERE tablename = 'cinema_room' AND indexname = 'idx_cinema_room_cluster';

**Verify seed data:**

5. SELECT cluster_id, cluster_name, province, status FROM cinema_cluster ORDER BY cluster_id;
   Ket qua: 6 dong (2 TP.HCM, 2 Ha Noi, 1 Da Nang, 1 Can Tho - INACTIVE)

6. SELECT cinema_room_id, cinema_room_name, cluster_id FROM cinema_room;
   Ket qua: 4 phong deu co cluster_id = 1

**Verify trigger:**

7. UPDATE cinema_cluster SET cluster_name = 'CinePrime Quan 1 Test' WHERE cluster_id = 1;
   SELECT updated_at FROM cinema_cluster WHERE cluster_id = 1;
   Ket qua: updated_at tu cap nhat thanh thoi diem hien tai

**Verify ON DELETE SET NULL:**

8. Tao cluster moi, gan phong vao, sau do xoa cluster:
   - INSERT INTO cinema_cluster (cluster_name, province, address) VALUES ('Test', 'Ha Noi', 'Test addr');
   - UPDATE cinema_room SET cluster_id = 7 WHERE cinema_room_id = 1;
   - DELETE FROM cinema_cluster WHERE cluster_id = 7;
   - SELECT cluster_id FROM cinema_room WHERE cinema_room_id = 1;
   Ket qua: cluster_id tra ve NULL, phong khong bi xoa

---

## Checklist

**General**
- [x] Script idempotent: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, ON CONFLICT DO NOTHING
- [x] Khong break du lieu hien co (FK nullable, ON DELETE SET NULL)
- [x] Follows naming convention cua project (snake_case, _id suffix cho PK/FK)

**Database**
- [x] PK dung BIGSERIAL nhat quan voi cac bang khac
- [x] updated_at trigger dung lai set_updated_at() function da co
- [x] Index tren FK cluster_id de tranh full scan khi JOIN
- [x] setval sequence sau seed de tranh PK conflict khi INSERT tiep
- [x] Schema diagram dbdiagram_cineprime.dbml cap nhat dong bo

---

## Reviewer Notes

- Fresh setup: them noi dung V3__add_cinema_cluster.sql vao cuoi server/postgres-init/movie_db.sql de docker-compose up fresh tu chay luon (hien tai project khong dung Flyway/Liquibase)
- dbdiagram_cineprime.dbml: paste toan bo noi dung vao dbdiagram.io, chon Import DBML de render diagram
- Seed cluster_id = 1..6 hardcode de khop voi MOCK_CLUSTERS frontend, neu DB da co data thi ON CONFLICT DO NOTHING se skip
