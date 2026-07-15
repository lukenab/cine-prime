-- =========================
-- CLEAN ALL TEST DATA
-- =========================

TRUNCATE TABLE show_time RESTART IDENTITY CASCADE;

TRUNCATE TABLE seat RESTART IDENTITY CASCADE;
TRUNCATE TABLE cinema_room RESTART IDENTITY CASCADE;

TRUNCATE TABLE movie_cast RESTART IDENTITY CASCADE;
TRUNCATE TABLE movie_format RESTART IDENTITY CASCADE;
TRUNCATE TABLE movie_genre RESTART IDENTITY CASCADE;
TRUNCATE TABLE movie_translation RESTART IDENTITY CASCADE;
TRUNCATE TABLE movie RESTART IDENTITY CASCADE;

TRUNCATE TABLE person RESTART IDENTITY CASCADE;
TRUNCATE TABLE production_company RESTART IDENTITY CASCADE;

TRUNCATE TABLE genre RESTART IDENTITY CASCADE;
TRUNCATE TABLE screening_format RESTART IDENTITY CASCADE;
TRUNCATE TABLE age_rating RESTART IDENTITY CASCADE;


INSERT INTO age_rating (rating_id, rating_code, min_age, description)
VALUES
    (1, 'P',   0,  'Phim được phép phổ biến đến mọi độ tuổi'),
    (2, 'K',   0,  'Phim dành cho khán giả dưới 13 tuổi với điều kiện xem cùng cha mẹ hoặc người giám hộ'),
    (3, 'T13', 13, 'Phim phổ biến đến khán giả từ đủ 13 tuổi trở lên'),
    (4, 'T16', 16, 'Phim phổ biến đến khán giả từ đủ 16 tuổi trở lên'),
    (5, 'T18', 18, 'Phim phổ biến đến khán giả từ đủ 18 tuổi trở lên'),
    (6, 'C',   99, 'Phim không được phép phổ biến')
ON CONFLICT (rating_id) DO NOTHING;

SELECT setval(
    pg_get_serial_sequence('age_rating', 'rating_id'),
    6,
    true
);
INSERT INTO screening_format (
    format_id,
    format_code,
    format_name,
    description,
    surcharge
)
VALUES
    (1, '2D', '2D', 'Định dạng chiếu tiêu chuẩn 2D', 0.00),
    (2, '3D', '3D', 'Định dạng chiếu 3D với kính chuyên dụng', 30000.00),
    (3, 'IMAX', 'IMAX', 'Định dạng màn hình IMAX với âm thanh và hình ảnh chất lượng cao', 50000.00),
    (4, '4DX', '4DX', 'Định dạng 4DX với hiệu ứng chuyển động, gió, nước và mùi hương', 80000.00),
    (5, 'SCREENX', 'ScreenX', 'Định dạng ScreenX với màn hình 270 độ', 60000.00),
    (6, 'ATMOS', 'Dolby Atmos', 'Định dạng âm thanh Dolby Atmos sống động', 20000.00)
ON CONFLICT (format_id) DO NOTHING;

SELECT setval(
    pg_get_serial_sequence('screening_format', 'format_id'),
    6,
    true
);
INSERT INTO genre (genre_id, genre_name, genre_code) VALUES
    (1,  'Hành Động',      'action'),
    (2,  'Phiêu Lưu',      'adventure'),
    (3,  'Hoạt Hình',      'animation'),
    (4,  'Hài Hước',       'comedy'),
    (5,  'Tâm Lý',         'drama'),
    (6,  'Giả Tưởng',      'fantasy'),
    (7,  'Kinh Dị',        'horror'),
    (8,  'Lãng Mạn',       'romance'),
    (9,  'Khoa Học Viễn Tưởng', 'sci-fi'),
    (10, 'Hồi Hộp',        'thriller'),
    (11, 'Tội Phạm',       'crime'),
    (12, 'Lịch Sử',        'history'),
    (13, 'Bí Ẩn',          'mystery'),
    (14, 'Gia Đình',       'family'),
    (15, 'Tiểu Sử',        'biography')
ON CONFLICT (genre_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('genre', 'genre_id'), 15, true);

-- -----------------------------------------------------------------------------
-- 2. PRODUCTION COMPANY
-- -----------------------------------------------------------------------------
INSERT INTO production_company (company_id, name, country) VALUES
    (1,  'Warner Bros. Pictures',    'USA'),
    (2,  'Marvel Studios',           'USA'),
    (3,  'Pixar Animation Studios',  'USA'),
    (4,  'Universal Pictures',       'USA'),
    (5,  'Paramount Pictures',       'USA'),
    (6,  '20th Century Studios',     'USA'),
    (7,  'Lionsgate',                'USA'),
    (8,  'A24',                      'USA')
ON CONFLICT (name) DO NOTHING;

SELECT setval(pg_get_serial_sequence('production_company', 'company_id'), 8, true);

-- -----------------------------------------------------------------------------
-- 3. PERSON  (directors + lead actors)
-- -----------------------------------------------------------------------------
INSERT INTO person (person_id, full_name, nationality) VALUES
    -- Directors
    (1,  'Denis Villeneuve',   'Canadian'),
    (2,  'Shawn Levy',         'Canadian'),
    (3,  'Kelsey Mann',        'American'),
    (4,  'Christopher Nolan',  'British'),
    (5,  'Matt Reeves',        'American'),
    (6,  'Joseph Kosinski',    'American'),
    (7,  'James Cameron',      'Canadian'),
    (8,  'Chad Stahelski',     'American'),
    -- Actors
    (9,  'Timothée Chalamet',  'American'),
    (10, 'Zendaya',            'American'),
    (11, 'Ryan Reynolds',      'Canadian'),
    (12, 'Hugh Jackman',       'Australian'),
    (13, 'Cillian Murphy',     'Irish'),
    (14, 'Emily Blunt',        'British'),
    (15, 'Robert Pattinson',   'British'),
    (16, 'Zoe Kravitz',        'American'),
    (17, 'Tom Cruise',         'American'),
    (18, 'Leonardo DiCaprio',  'American'),
    (19, 'Joseph Gordon-Levitt','American'),
    (20, 'Sam Worthington',    'Australian'),
    (21, 'Zoe Saldana',        'American'),
    (22, 'Keanu Reeves',       'Canadian'),
    (23, 'Donnie Yen',         'Chinese'),
    (24, 'Anne Hathaway',      'American'),
    (25, 'Rebecca Ferguson',   'Swedish')
ON CONFLICT (person_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('person', 'person_id'), 25, true);

-- -----------------------------------------------------------------------------
-- 4. MOVIE  (10 phim — status NOW_SHOWING để test được ngay)
-- -----------------------------------------------------------------------------
INSERT INTO movie (movie_id, original_title, original_language, duration_minutes,
                   release_date, age_rating_id, company_id,
                   poster_url, thumbnail_url, synopsis, status)
VALUES
    (1, 'Dune: Part Two', 'en', 166, '2024-03-01', 3, 1,
     'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
     'https://image.tmdb.org/t/p/w342/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
     'Paul Atreides joins forces with Chani and the Fremen as he seeks revenge against those who destroyed his family.',
     'NOW_SHOWING'),

    (2, 'Deadpool & Wolverine', 'en', 128, '2024-07-26', 5, 2,
     'https://image.tmdb.org/t/p/w780/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
     'https://image.tmdb.org/t/p/w342/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
     'Deadpool teams up with Wolverine on a chaotic mission that could change the fate of their worlds.',
     'NOW_SHOWING'),

    (3, 'Inside Out 2', 'en', 100, '2024-06-14', 1, 3,
     'https://image.tmdb.org/t/p/w780/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg',
     'https://image.tmdb.org/t/p/w342/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg',
     'Riley enters her teenage years and faces new emotions that shake up the balance inside her mind.',
     'NOW_SHOWING'),

    (4, 'Oppenheimer', 'en', 180, '2023-07-21', 4, 4,
     'https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
     'https://image.tmdb.org/t/p/w342/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
     'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb during World War II.',
     'NOW_SHOWING'),

    (5, 'Interstellar', 'en', 169, '2014-11-07', 1, 5,
     'https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
     'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
     'A team of explorers travel through a wormhole in space in an attempt to ensure humanity''s survival.',
     'NOW_SHOWING'),

    (6, 'The Batman', 'en', 176, '2022-03-04', 3, 1,
     'https://image.tmdb.org/t/p/w780/nMp4tu8XuVG3CSWdXTFiHLdngnc.jpg',
     'https://image.tmdb.org/t/p/w342/nMp4tu8XuVG3CSWdXTFiHLdngnc.jpg',
     'When a sadistic serial killer begins murdering key political figures in Gotham, Batman investigates the city''s hidden corruption.',
     'NOW_SHOWING'),

    (7, 'Top Gun: Maverick', 'en', 130, '2022-05-27', 1, 5,
     'https://image.tmdb.org/t/p/w780/62HCnUTziyWcpDaBO2i1DX17ljH.jpg',
     'https://image.tmdb.org/t/p/w342/62HCnUTziyWcpDaBO2i1DX17ljH.jpg',
     'After thirty years, Maverick is still pushing the envelope as a courageous test pilot while dodging the advancement in rank.',
     'NOW_SHOWING'),

    (8, 'Inception', 'en', 148, '2010-07-16', 3, 1,
     'https://image.tmdb.org/t/p/w780/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
     'https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
     'A thief who steals corporate secrets through dream-sharing technology is given the task of planting an idea into a CEO''s mind.',
     'NOW_SHOWING'),

    (9, 'Avatar: The Way of Water', 'en', 192, '2022-12-16', 1, 6,
     'https://image.tmdb.org/t/p/w780/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
     'https://image.tmdb.org/t/p/w342/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
     'Jake Sully and Neytiri must protect their family as a familiar threat returns to Pandora.',
     'NOW_SHOWING'),

    (10, 'John Wick: Chapter 4', 'en', 169, '2023-03-24', 5, 7,
     'https://image.tmdb.org/t/p/w780/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg',
     'https://image.tmdb.org/t/p/w342/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg',
     'John Wick uncovers a path to defeating the High Table, but must face a new enemy with powerful alliances across the globe.',
     'NOW_SHOWING')

ON CONFLICT (movie_id) DO UPDATE SET
    original_title   = EXCLUDED.original_title,
    duration_minutes = EXCLUDED.duration_minutes,
    status           = EXCLUDED.status,
    updated_at       = NOW();

SELECT setval(pg_get_serial_sequence('movie', 'movie_id'), 10, true);

-- -----------------------------------------------------------------------------
-- 5. MOVIE TRANSLATION  (vi + en cho mỗi phim)
-- -----------------------------------------------------------------------------
INSERT INTO movie_translation (movie_id, language_code, title, synopsis) VALUES
    -- Dune: Part Two
    (1, 'en', 'Dune: Part Two',
     'Paul Atreides joins forces with Chani and the Fremen as he seeks revenge against those who destroyed his family.'),
    (1, 'vi', 'Hành Tinh Cát: Phần Hai',
     'Paul Atreides liên minh với Chani và người Fremen để trả thù những kẻ đã hủy diệt gia tộc mình.'),

    -- Deadpool & Wolverine
    (2, 'en', 'Deadpool & Wolverine',
     'Deadpool teams up with Wolverine on a chaotic mission that could change the fate of their worlds.'),
    (2, 'vi', 'Deadpool Và Wolverine',
     'Deadpool hợp tác với Wolverine trong một nhiệm vụ hỗn loạn có thể thay đổi vận mệnh cả hai thế giới.'),

    -- Inside Out 2
    (3, 'en', 'Inside Out 2',
     'Riley enters her teenage years and faces new emotions that shake up the balance inside her mind.'),
    (3, 'vi', 'Những Mảnh Ghép Cảm Xúc 2',
     'Riley bước vào tuổi teen và đối mặt với những cảm xúc mới làm xáo trộn thế giới nội tâm của cô bé.'),

    -- Oppenheimer
    (4, 'en', 'Oppenheimer',
     'The story of J. Robert Oppenheimer and his role in the development of the atomic bomb.'),
    (4, 'vi', 'Oppenheimer',
     'Câu chuyện về nhà khoa học J. Robert Oppenheimer và vai trò của ông trong việc phát triển bom nguyên tử.'),

    -- Interstellar
    (5, 'en', 'Interstellar',
     'A team of explorers travel through a wormhole in space in an attempt to ensure humanity''s survival.'),
    (5, 'vi', 'Hố Đen Tử Thần',
     'Một nhóm phi hành gia du hành qua lỗ sâu đục trong không gian để tìm kiếm hành tinh mới cho nhân loại.'),

    -- The Batman
    (6, 'en', 'The Batman',
     'When a sadistic serial killer begins murdering key political figures in Gotham, Batman investigates the city''s hidden corruption.'),
    (6, 'vi', 'Người Dơi',
     'Khi một kẻ giết người bắt đầu sát hại các nhân vật chính trị Gotham, Batman buộc phải điều tra sự thối nát ẩn giấu.'),

    -- Top Gun: Maverick
    (7, 'en', 'Top Gun: Maverick',
     'After thirty years, Maverick is still pushing the envelope as a courageous test pilot.'),
    (7, 'vi', 'Phi Công Siêu Đẳng: Maverick',
     'Sau 30 năm, Maverick vẫn tiếp tục thách thức giới hạn bản thân với tư cách là phi công thử nghiệm.'),

    -- Inception
    (8, 'en', 'Inception',
     'A thief who steals corporate secrets through dream-sharing technology is given the task of planting an idea.'),
    (8, 'vi', 'Kẻ Đánh Cắp Giấc Mơ',
     'Một tên trộm chuyên đánh cắp bí mật qua công nghệ xâm nhập giấc mơ được giao nhiệm vụ cấy ghép một ý tưởng.'),

    -- Avatar: The Way of Water
    (9, 'en', 'Avatar: The Way of Water',
     'Jake Sully and Neytiri must protect their family as a familiar threat returns to Pandora.'),
    (9, 'vi', 'Avatar: Dòng Chảy Của Nước',
     'Jake Sully và Neytiri phải bảo vệ gia đình khi một mối đe dọa quen thuộc quay trở lại Pandora.'),

    -- John Wick: Chapter 4
    (10, 'en', 'John Wick: Chapter 4',
     'John Wick uncovers a path to defeating the High Table, but must face a new enemy with powerful alliances.'),
    (10, 'vi', 'Sát Thủ John Wick 4',
     'John Wick tìm ra con đường đánh bại Hội Đồng Tối Cao nhưng phải đối mặt với kẻ thù mới đầy quyền lực.')

ON CONFLICT (movie_id, language_code) DO UPDATE SET
    title    = EXCLUDED.title,
    synopsis = EXCLUDED.synopsis;

-- -----------------------------------------------------------------------------
-- 6. MOVIE GENRE
-- -----------------------------------------------------------------------------
DELETE FROM movie_genre WHERE movie_id BETWEEN 1 AND 10;

INSERT INTO movie_genre (movie_id, genre_id) VALUES
    (1, 1), (1, 2), (1, 9),           -- Dune 2: Action, Adventure, Sci-Fi
    (2, 1), (2, 4), (2, 9),           -- Deadpool: Action, Comedy, Sci-Fi
    (3, 3), (3, 4), (3, 14),          -- Inside Out 2: Animation, Comedy, Family
    (4, 5), (4, 12), (4, 15),         -- Oppenheimer: Drama, History, Biography
    (5, 2), (5, 5), (5, 9),           -- Interstellar: Adventure, Drama, Sci-Fi
    (6, 1), (6, 5), (6, 11),          -- The Batman: Action, Drama, Crime
    (7, 1), (7, 5),                   -- Top Gun: Action, Drama
    (8, 1), (8, 9), (8, 10),          -- Inception: Action, Sci-Fi, Thriller
    (9, 1), (9, 2), (9, 9),           -- Avatar 2: Action, Adventure, Sci-Fi
    (10, 1), (10, 10), (10, 11);      -- John Wick 4: Action, Thriller, Crime

-- -----------------------------------------------------------------------------
-- 7. MOVIE FORMAT  (format_id: 1=2D, 2=3D, 3=IMAX)
-- -----------------------------------------------------------------------------
DELETE FROM movie_format WHERE movie_id BETWEEN 1 AND 10;

INSERT INTO movie_format (movie_id, format_id) VALUES
    (1, 1), (1, 2), (1, 3),   -- Dune 2: 2D, 3D, IMAX
    (2, 1), (2, 2),            -- Deadpool: 2D, 3D
    (3, 1), (3, 2),            -- Inside Out 2: 2D, 3D
    (4, 1), (4, 3),            -- Oppenheimer: 2D, IMAX
    (5, 1), (5, 3),            -- Interstellar: 2D, IMAX
    (6, 1), (6, 2),            -- The Batman: 2D, 3D
    (7, 1), (7, 2),            -- Top Gun: 2D, 3D
    (8, 1), (8, 3),            -- Inception: 2D, IMAX
    (9, 1), (9, 2), (9, 3),   -- Avatar 2: 2D, 3D, IMAX
    (10, 1);                   -- John Wick 4: 2D

-- -----------------------------------------------------------------------------
-- 8. MOVIE CAST
-- -----------------------------------------------------------------------------
DELETE FROM movie_cast WHERE movie_id BETWEEN 1 AND 10;

INSERT INTO movie_cast (movie_id, person_id, role_type, character_name, billing_order) VALUES
    -- Dune: Part Two (movie_id=1)
    (1, 1,  'DIRECTOR', NULL,           1),
    (1, 9,  'ACTOR',    'Paul Atreides',1),
    (1, 10, 'ACTOR',    'Chani',        2),
    (1, 25, 'ACTOR',    'Lady Jessica', 3),

    -- Deadpool & Wolverine (movie_id=2)
    (2, 2,  'DIRECTOR', NULL,            1),
    (2, 11, 'ACTOR',    'Deadpool',      1),
    (2, 12, 'ACTOR',    'Wolverine',     2),

    -- Inside Out 2 (movie_id=3)
    (3, 3,  'DIRECTOR', NULL,   1),

    -- Oppenheimer (movie_id=4)
    (4, 4,  'DIRECTOR', NULL,             1),
    (4, 13, 'ACTOR',    'J. Robert Oppenheimer', 1),
    (4, 14, 'ACTOR',    'Katherine Oppenheimer', 2),

    -- Interstellar (movie_id=5)
    (5, 4,  'DIRECTOR', NULL,        1),
    (5, 24, 'ACTOR',    'Brand',     2),

    -- The Batman (movie_id=6)
    (6, 5,  'DIRECTOR', NULL,         1),
    (6, 15, 'ACTOR',    'Bruce Wayne',1),
    (6, 16, 'ACTOR',    'Selina Kyle',2),

    -- Top Gun: Maverick (movie_id=7)
    (7, 6,  'DIRECTOR', NULL,         1),
    (7, 17, 'ACTOR',    'Maverick',   1),

    -- Inception (movie_id=8)
    (8, 4,  'DIRECTOR', NULL,       1),
    (8, 18, 'ACTOR',    'Cobb',     1),
    (8, 19, 'ACTOR',    'Arthur',   2),

    -- Avatar: The Way of Water (movie_id=9)
    (9, 7,  'DIRECTOR', NULL,           1),
    (9, 20, 'ACTOR',    'Jake Sully',   1),
    (9, 21, 'ACTOR',    'Neytiri',      2),

    -- John Wick: Chapter 4 (movie_id=10)
    (10, 8,  'DIRECTOR', NULL,          1),
    (10, 22, 'ACTOR',    'John Wick',   1),
    (10, 23, 'ACTOR',    'Caine',       2);

-- -----------------------------------------------------------------------------
-- 9. CINEMA ROOM  (4 phòng để test showtime)
-- -----------------------------------------------------------------------------
INSERT INTO cinema_room (cinema_room_id, cinema_room_name, room_type, total_seat_capacity, status)
VALUES
    (1, 'Phòng 1 - IMAX',     'IMAX',     120, 'ACTIVE'),
    (2, 'Phòng 2 - 3D',       'LARGE',     80, 'ACTIVE'),
    (3, 'Phòng 3 - Standard', 'STANDARD', 100, 'ACTIVE'),
    (4, 'Phòng 4 - Standard', 'STANDARD', 100, 'ACTIVE')
ON CONFLICT (cinema_room_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('cinema_room', 'cinema_room_id'), 4, true);
INSERT INTO seat (
    seat_code,
    row_label,
    col_number,
    seat_type,
    status,
    cinema_room_id,
    base_price,
    created_at,
    updated_at
)
SELECT
    chr(64 + r) || c AS seat_code,
    chr(64 + r) AS row_label,
    c,
    CASE
        WHEN r = 5 AND c IN (9,10) THEN 'COUPLE'
        WHEN r IN (4,5) THEN 'VIP'
        ELSE 'STANDARD'
    END,
    'ACTIVE',
    room_id,
    CASE
        WHEN r = 5 AND c IN (9,10) THEN 250000.00
        WHEN r IN (4,5) THEN 140000.00
        ELSE 100000.00
    END,
    NOW(),
    NOW()
FROM generate_series(1,4) room_id
CROSS JOIN generate_series(1,5) r
CROSS JOIN generate_series(1,10) c;