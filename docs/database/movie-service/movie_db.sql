-- 1. Bảng TYPE (Thể loại phim)
CREATE TABLE type (
    type_id SERIAL PRIMARY KEY,
    type_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng MOVIE (Thông tin phim)
CREATE TABLE movie (
    movie_id SERIAL PRIMARY KEY,
    movie_name_vn VARCHAR(255) NOT NULL,
    movie_name_english VARCHAR(255),
    actor VARCHAR(255),
    director VARCHAR(255),
    content TEXT,
    duration INTEGER, -- Thời lượng phim tính bằng phút
    from_date DATE,
    to_date DATE,
    movie_production_company VARCHAR(255),
    version VARCHAR(50), -- Ví dụ: 2D, 3D, IMAX
    large_image VARCHAR(255),
    small_image VARCHAR(255),
    status INTEGER DEFAULT 1, -- 1: Active, 0: Inactive/Deleted (Phục vụ Soft Delete)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng trung gian MOVIE_TYPE (Quan hệ Nhiều - Nhiều giữa Phim và Thể loại)
CREATE TABLE movie_type (
    movie_id INTEGER NOT NULL,
    type_id INTEGER NOT NULL,
    PRIMARY KEY (movie_id, type_id),
    FOREIGN KEY (movie_id) REFERENCES movie(movie_id) ON DELETE CASCADE,
    FOREIGN KEY (type_id) REFERENCES type(type_id) ON DELETE CASCADE
);

-- 4. Bảng CINEMA_ROOM (Phòng chiếu)
CREATE TABLE cinema_room (
    cinema_room_id SERIAL PRIMARY KEY,
    cinema_room_name VARCHAR(100) NOT NULL,
    seat_quantity INTEGER NOT NULL,
    status INTEGER DEFAULT 1, -- 1: Hoạt động, 0: Bảo trì
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bảng SHOWTIME (Suất chiếu - Gom cụm ngày chiếu và khung giờ)
CREATE TABLE showtime (
    showtime_id SERIAL PRIMARY KEY,
    movie_id INTEGER NOT NULL,
    cinema_room_id INTEGER NOT NULL,
    show_date DATE NOT NULL, -- Ngày chiếu
    start_time TIME NOT NULL, -- Giờ bắt đầu suất chiếu
    end_time TIME NOT NULL, -- Giờ kết thúc suất chiếu
    status INTEGER DEFAULT 1, -- 1: Đang mở bán, 0: Đã hủy
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movie_id) REFERENCES movie(movie_id) ON DELETE CASCADE,
    FOREIGN KEY (cinema_room_id) REFERENCES cinema_room(cinema_room_id) ON DELETE CASCADE
);