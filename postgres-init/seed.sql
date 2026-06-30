INSERT INTO movie (movie_id, movie_name_english, status, duration) 
VALUES (1, 'Test Movie', true, 120) ON CONFLICT DO NOTHING;

INSERT INTO seat (seat_id, cinema_room_id, seat_code, seat_type, price, seat_status)
VALUES (1, 1, 'A1', 'STANDARD', 100000, 1),
       (2, 1, 'A2', 'STANDARD', 100000, 1) ON CONFLICT DO NOTHING;

INSERT INTO show_time (showtime_id, movie_id, cinema_room_id, show_date, start_time, end_time)
VALUES (1, 1, 1, '2026-06-30', '10:00:00', '12:00:00') ON CONFLICT DO NOTHING;
