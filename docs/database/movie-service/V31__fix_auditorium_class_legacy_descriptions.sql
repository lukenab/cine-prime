-- V18 originally inserted PLF/MOTION with raw Vietnamese description text
-- ("Man hinh lon, am thanh nang cao" / "Ghe co hieu ung chuyen dong"), while
-- every other auditorium_class row already used English descriptions. V19
-- later deactivated these two rows (active = FALSE) but never touched their
-- description text. Fresh installs (postgres-init/movie_db.sql) never insert
-- PLF/MOTION at all, so this only affects databases that went through V18.

UPDATE auditorium_class
SET description = 'Large-format screen with enhanced audio service tier'
WHERE class_code = 'PLF';

UPDATE auditorium_class
SET description = 'Motion-effect seating service tier'
WHERE class_code = 'MOTION';
