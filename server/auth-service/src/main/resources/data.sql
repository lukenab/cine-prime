-- ================================
-- ROLES (theo SRS v1.2)
-- ================================
INSERT INTO roles (role_name, description) VALUES
('ADMIN',    'Highest privilege — full CRUD on all modules including employees, members, cinema rooms, statistics'),
('EMPLOYEE', 'Counter staff — ticket selling, ticket booking, search members, manage movies, promotions'),
('MEMBER',   'Registered customer — book tickets, manage account, view booking history, manage loyalty points')
ON CONFLICT (role_name) DO NOTHING;

-- ================================
-- PERMISSIONS
-- ================================
INSERT INTO permission (name, description) VALUES
('ACCOUNT_MANAGE',   'Create, update, lock/unlock accounts'),
('MOVIE_READ',       'View movie list and detail'),
('MOVIE_MANAGE',     'Create, update, soft-delete movies'),
('SHOWTIME_READ',    'View showtimes'),
('SHOWTIME_MANAGE',  'Create, update, cancel showtimes'),
('ROOM_MANAGE',      'Create, update, manage cinema rooms'),
('SEAT_MANAGE',      'Create, update, manage seats'),
('BOOKING_READ',     'View and search all bookings'),
('BOOKING_MANAGE',   'Confirm bookings, counter ticket sales'),
('TICKET_MANAGE',    'Issue and manage tickets'),
('MEMBER_READ',      'View and search member list'),
('MEMBER_MANAGE',    'Add, edit, delete member accounts'),
('EMPLOYEE_READ',    'View employee list'),
('EMPLOYEE_MANAGE',  'Add, edit, delete employees'),
('PROMOTION_READ',   'View promotions'),
('PROMOTION_MANAGE', 'Create and manage promotions'),
('STATISTICS_VIEW',  'View revenue and operational statistics'),
('SCORE_VIEW',       'View loyalty point history')
ON CONFLICT (name) DO NOTHING;

-- ================================
-- ROLE → PERMISSION MAPPING
-- ================================

-- ADMIN:
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

-- EMPLOYEE:
INSERT INTO role_permissions (role_name, permission_name) VALUES
('EMPLOYEE', 'MOVIE_READ'),      ('EMPLOYEE', 'MOVIE_MANAGE'),
('EMPLOYEE', 'SHOWTIME_READ'),   ('EMPLOYEE', 'SHOWTIME_MANAGE'),
('EMPLOYEE', 'BOOKING_READ'),    ('EMPLOYEE', 'BOOKING_MANAGE'), ('EMPLOYEE', 'TICKET_MANAGE'),
('EMPLOYEE', 'MEMBER_READ'),
('EMPLOYEE', 'PROMOTION_READ'),  ('EMPLOYEE', 'PROMOTION_MANAGE')
ON CONFLICT DO NOTHING;

-- MEMBER:
INSERT INTO role_permissions (role_name, permission_name) VALUES
('MEMBER', 'MOVIE_READ'),
('MEMBER', 'SHOWTIME_READ'),
('MEMBER', 'PROMOTION_READ'),
('MEMBER', 'SCORE_VIEW')
ON CONFLICT DO NOTHING;

-- Demo accounts (employee/member with hardcoded password) removed — auth-service's
-- ApplicationInitConfig now only bootstraps the ADMIN account, from app.admin.* config.

