-- ================================
-- ROLES (theo SRS v1.2)
-- ================================
INSERT INTO roles (role_name, description) VALUES
('ADMIN',    'Highest privilege — full CRUD on all modules including employees, members, cinema rooms, statistics'),
('BRANCH_MANAGER', 'Cinema branch manager — can prepare concession product proposals'),
('PROGRAMMING_OPERATOR', 'Head-office programming staff — prepares movie, release and schedule drafts'),
('EMPLOYEE', 'Cinema staff — ticket sales, booking and branch operations'),
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
('SCORE_VIEW',       'View loyalty point history'),
('CONCESSION_CATALOG_DRAFT', 'Create and edit concession product drafts'),
('CONCESSION_CATALOG_SUBMIT', 'Submit concession products for approval'),
('CONCESSION_CATALOG_APPROVE', 'Approve or reject concession products')
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
('ADMIN', 'SCORE_VIEW'),
('ADMIN', 'CONCESSION_CATALOG_DRAFT'),
('ADMIN', 'CONCESSION_CATALOG_SUBMIT'),
('ADMIN', 'CONCESSION_CATALOG_APPROVE')
ON CONFLICT DO NOTHING;

-- BRANCH MANAGER:
INSERT INTO role_permissions (role_name, permission_name) VALUES
('BRANCH_MANAGER', 'CONCESSION_CATALOG_DRAFT'),
('BRANCH_MANAGER', 'CONCESSION_CATALOG_SUBMIT')
ON CONFLICT DO NOTHING;

-- EMPLOYEE:
INSERT INTO role_permissions (role_name, permission_name) VALUES
('EMPLOYEE', 'MOVIE_READ'),
('EMPLOYEE', 'SHOWTIME_READ'),
('EMPLOYEE', 'BOOKING_READ'),    ('EMPLOYEE', 'BOOKING_MANAGE'), ('EMPLOYEE', 'TICKET_MANAGE'),
('EMPLOYEE', 'PROMOTION_READ')
ON CONFLICT DO NOTHING;

-- PROGRAMMING OPERATOR: prepares content and scheduling drafts; approval remains ADMIN-only.
INSERT INTO role_permissions (role_name, permission_name) VALUES
('PROGRAMMING_OPERATOR', 'MOVIE_READ'), ('PROGRAMMING_OPERATOR', 'MOVIE_MANAGE'),
('PROGRAMMING_OPERATOR', 'SHOWTIME_READ'), ('PROGRAMMING_OPERATOR', 'SHOWTIME_MANAGE')
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

-- Promotion maker-checker workflow (P0/P1).
INSERT INTO roles (role_name, description) VALUES
('COMMERCIAL_MANAGER', 'Commercial maker - prepares pricing and promotion drafts'),
('COMMERCIAL_APPROVER', 'Commercial checker - approves and controls promotion lifecycle')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO permission (name, description) VALUES
('PROMOTION_CREATE', 'Create new promotion'),
('PROMOTION_UPDATE', 'Edit promotion'),
('PROMOTION_SUBMIT', 'Submit promotion drafts for approval'),
('PROMOTION_APPROVE', 'Approve or reject promotion submissions'),
('PROMOTION_ACTIVATE', 'Activate approved promotions'),
('PROMOTION_PAUSE', 'Pause or resume live promotions'),
('PROMOTION_ARCHIVE', 'Archive promotions with an audit reason')
ON CONFLICT (name) DO NOTHING;

-- Additive grants preserve unrelated access-matrix customizations.
INSERT INTO role_permissions (role_name, permission_name) VALUES
('COMMERCIAL_MANAGER', 'PROMOTION_READ'),
('COMMERCIAL_MANAGER', 'PROMOTION_CREATE'),
('COMMERCIAL_MANAGER', 'PROMOTION_UPDATE'),
('COMMERCIAL_MANAGER', 'PROMOTION_SUBMIT'),
('COMMERCIAL_APPROVER', 'PROMOTION_READ'),
('COMMERCIAL_APPROVER', 'PROMOTION_APPROVE'),
('COMMERCIAL_APPROVER', 'PROMOTION_ACTIVATE'),
('COMMERCIAL_APPROVER', 'PROMOTION_PAUSE'),
('COMMERCIAL_APPROVER', 'PROMOTION_ARCHIVE'),
('ADMIN', 'PROMOTION_CREATE'),
('ADMIN', 'PROMOTION_UPDATE'),
('ADMIN', 'PROMOTION_SUBMIT'),
('ADMIN', 'PROMOTION_APPROVE'),
('ADMIN', 'PROMOTION_ACTIVATE'),
('ADMIN', 'PROMOTION_PAUSE'),
('ADMIN', 'PROMOTION_ARCHIVE')
ON CONFLICT DO NOTHING;

-- Coarse/ambiguous promotion grants are replaced by the workflow permissions above.
DELETE FROM role_permissions WHERE permission_name IN ('PROMOTION_MANAGE', 'PROMOTION_DELETE');
DELETE FROM permission WHERE name IN ('PROMOTION_MANAGE', 'PROMOTION_DELETE');

