const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:123456@localhost:5433/movie_db' });
client.connect().then(async () => {
  try {
    // 1. Insert movie
    const insertMovie = `
      INSERT INTO movie (movie_name_vn, movie_name_english, director, actor, duration, content, version, status, movie_production_company, large_image, small_image, create_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING movie_id;
    `;
    const movieValues = [
      'Màn Đêm Đỏ Thẫm',
      'Crimson Veil',
      'Unknown Director',
      'Unknown Actor',
      138,
      'A thrilling mystery unfolds in the shadows...',
      '2D',
      true,
      'CinePrime Studios',
      'https://images.unsplash.com/photo-1675726205553-4e348f24da2c',
      'https://images.unsplash.com/photo-1675726205553-4e348f24da2c'
    ];
    const res = await client.query(insertMovie, movieValues);
    const movieId = res.rows[0].movie_id;
    
    // 2. Insert movie_type (assuming type_id 6 for Thriller exists)
    try {
      await client.query('INSERT INTO movie_movie_types (movie_movie_id, movie_types_type_id) VALUES ($1, $2)', [movieId, 6]);
    } catch (e) {
      console.log('Skipping movie_types insert due to naming mismatch:', e.message);
    }
    
    // 3. Insert showtimes
    for (let i = 0; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      if (d.getDay() === 1) continue; // Skip Monday
      
      const showDate = d.toISOString().split('T')[0];
      const count = Math.random() > 0.5 ? 3 : 2;
      
      const insertSt = 'INSERT INTO show_time (movie_id, cinema_room_id, show_date, start_time, end_time, update_at) VALUES ($1, $2, $3, $4, $5, NOW())';
      
      // 10:00 - 12:18
      await client.query(insertSt, [movieId, 1, showDate, '10:00:00', '12:18:00']);
      // 14:30 - 16:48
      await client.query(insertSt, [movieId, 2, showDate, '14:30:00', '16:48:00']);
      
      if (count === 3) {
        // 19:15 - 21:33
        await client.query(insertSt, [movieId, 3, showDate, '19:15:00', '21:33:00']);
      }
    }
    console.log('Seeded successfully with pg! movieId =', movieId);
  } catch(e) {
    console.error(e);
  } finally {
    client.end();
  }
});
