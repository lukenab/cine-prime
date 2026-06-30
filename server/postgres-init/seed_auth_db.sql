-- FILE NÀY KHÔNG DÙNG (postgres-init chạy trước Hibernate tạo tables)
-- Seed data nằm ở: auth-service/src/main/resources/data.sql

-- ================================
-- ROLES (theo SRS v1.2)
-- ================================
INSERT INTO roles (role_name, description) VALUES
('ADMIN',    'Highest privilege — full CRUD on all modules including employees, members, cinema rooms, statistics'),
('EMPLOYEE', 'Counter staff — ticket selling, ticket booking, search members, manage movies, promotions'),
('MEMBER',   'Registered customer — book tickets, manage account, view booking history, manage loyalty points'),
('USER',     'Guest / not-member — view movie list, view promotions, view ticket prices, view showtimes')
ON CONFLICT (role_name) DO NOTHING;

-- ================================
-- PERMISSIONS (theo chức năng từng actor trong SRS)
-- ================================
INSERT INTO permission (name, description) VALUES
-- Auth & Account
('ACCOUNT_MANAGE',   'Create, update, lock/unlock accounts'),
-- Movie & Showtime
('MOVIE_READ',       'View movie list and detail'),
('MOVIE_MANAGE',     'Create, update, soft-delete movies'),
('SHOWTIME_READ',    'View showtimes'),
('SHOWTIME_MANAGE',  'Create, update, cancel showtimes'),
-- Cinema Room & Seat
('ROOM_MANAGE',      'Create, update, manage cinema rooms'),
('SEAT_MANAGE',      'Create, update, manage seats'),
-- Booking & Ticket
('BOOKING_READ',     'View and search all bookings'),
('BOOKING_MANAGE',   'Confirm bookings, counter ticket sales'),
('TICKET_MANAGE',    'Issue and manage tickets'),
-- Member & Employee
('MEMBER_READ',      'View and search member list'),
('MEMBER_MANAGE',    'Add, edit, delete member accounts'),
('EMPLOYEE_READ',    'View employee list'),
('EMPLOYEE_MANAGE',  'Add, edit, delete employees'),
-- Promotion & Statistics
('PROMOTION_READ',   'View promotions'),
('PROMOTION_MANAGE', 'Create and manage promotions'),
('STATISTICS_VIEW',  'View revenue and operational statistics'),
-- Score
('SCORE_VIEW',       'View loyalty point history')
ON CONFLICT (name) DO NOTHING;

-- ================================
-- ROLE → PERMISSION MAPPING
-- ================================

-- ADMIN: toàn quyền
INSERT INTO role_permissions (role_name, permission_name) VALUES
('ADMIN', 'ACCOUNT_MANAGE'),
('ADMIN', 'MOVIE_READ'),      ('ADMIN', 'MOVIE_MANAGE'),
('ADMIN', 'SHOWTIME_READ'),   ('ADMIN', 'SHOWTIME_MANAGE'),
('ADMIN', 'ROOM_MANAGE'),     ('ADMIN', 'SEAT_MANAGE'),
('ADMIN', 'BOOKING_READ'),    ('ADMIN', 'BOOKING_MANAGE'),  ('ADMIN', 'TICKET_MANAGE'),
('ADMIN', 'MEMBER_READ'),     ('ADMIN', 'MEMBER_MANAGE'),
('ADMIN', 'EMPLOYEE_READ'),   ('ADMIN', 'EMPLOYEE_MANAGE'),
('ADMIN', 'PROMOTION_READ'),  ('ADMIN', 'PROMOTION_MANAGE'),
('ADMIN', 'STATISTICS_VIEW'),
('ADMIN', 'SCORE_VIEW')
ON CONFLICT DO NOTHING;

-- EMPLOYEE: bán vé, quản lý phim/suất chiếu, tìm kiếm member, promotion
INSERT INTO role_permissions (role_name, permission_name) VALUES
('EMPLOYEE', 'MOVIE_READ'),      ('EMPLOYEE', 'MOVIE_MANAGE'),
('EMPLOYEE', 'SHOWTIME_READ'),   ('EMPLOYEE', 'SHOWTIME_MANAGE'),
('EMPLOYEE', 'BOOKING_READ'),    ('EMPLOYEE', 'BOOKING_MANAGE'), ('EMPLOYEE', 'TICKET_MANAGE'),
('EMPLOYEE', 'MEMBER_READ'),
('EMPLOYEE', 'PROMOTION_READ'),  ('EMPLOYEE', 'PROMOTION_MANAGE')
ON CONFLICT DO NOTHING;

-- MEMBER: đặt vé online, xem phim, xem điểm thưởng
INSERT INTO role_permissions (role_name, permission_name) VALUES
('MEMBER', 'MOVIE_READ'),
('MEMBER', 'SHOWTIME_READ'),
('MEMBER', 'PROMOTION_READ'),
('MEMBER', 'SCORE_VIEW')
ON CONFLICT DO NOTHING;

-- USER (guest): chỉ xem
INSERT INTO role_permissions (role_name, permission_name) VALUES
('USER', 'MOVIE_READ'),
('USER', 'SHOWTIME_READ'),
('USER', 'PROMOTION_READ')
ON CONFLICT DO NOTHING;

-- ================================
-- DEMO ACCOUNTS
-- password: 123456 (BCrypt strength 10)
-- ================================
INSERT INTO account (account_id, username, email, password_hash, status) VALUES
(gen_random_uuid(), 'admin',    'admin@cineprime.com',    '$2a$10$slYQmyNdgTY18LjhChyOEOYEsEFPxBgUG1BNT/BqOKm0gsxbycv/G', 1),
(gen_random_uuid(), 'employee', 'employee@cineprime.com', '$2a$10$slYQmyNdgTY18LjhChyOEOYEsEFPxBgUG1BNT/BqOKm0gsxbycv/G', 1),
(gen_random_uuid(), 'member',   'member@cineprime.com',   '$2a$10$slYQmyNdgTY18LjhChyOEOYEsEFPxBgUG1BNT/BqOKm0gsxbycv/G', 1),
(gen_random_uuid(), 'guest',    'guest@cineprime.com',    '$2a$10$slYQmyNdgTY18LjhChyOEOYEsEFPxBgUG1BNT/BqOKm0gsxbycv/G', 1)
ON CONFLICT (username) DO NOTHING;

-- ================================
-- ACCOUNT → ROLE MAPPING
-- ================================
INSERT INTO account_role (account_id, role_name)
SELECT account_id, 'ADMIN'    FROM account WHERE username = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO account_role (account_id, role_name)
SELECT account_id, 'EMPLOYEE' FROM account WHERE username = 'employee'
ON CONFLICT DO NOTHING;

INSERT INTO account_role (account_id, role_name)
SELECT account_id, 'MEMBER'   FROM account WHERE username = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO account_role (account_id, role_name)
SELECT account_id, 'USER'     FROM account WHERE username = 'guest'
ON CONFLICT DO NOTHING;
