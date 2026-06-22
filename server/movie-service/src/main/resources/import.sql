-- Seed data for movie-service (runs automatically after ddl-auto: create recreates schema)

-- ── Movie genres ──────────────────────────────────────────────────────────────
INSERT INTO type (type_name) VALUES ('Action');
INSERT INTO type (type_name) VALUES ('Comedy');
INSERT INTO type (type_name) VALUES ('Drama');
INSERT INTO type (type_name) VALUES ('Sci-Fi');
INSERT INTO type (type_name) VALUES ('Horror');
INSERT INTO type (type_name) VALUES ('Romance');
INSERT INTO type (type_name) VALUES ('Animation');
INSERT INTO type (type_name) VALUES ('Thriller');

-- ── Cinema rooms ─────────────────────────────────────────────────────────────
INSERT INTO cinema_room (cinema_room_name, seat_quantity, status) VALUES ('Room A', 50, true);
INSERT INTO cinema_room (cinema_room_name, seat_quantity, status) VALUES ('Room B', 80, true);
INSERT INTO cinema_room (cinema_room_name, seat_quantity, status) VALUES ('Room C', 100, true);
INSERT INTO cinema_room (cinema_room_name, seat_quantity, status) VALUES ('IMAX Room', 120, true);
