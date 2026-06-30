const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:123456@localhost:5433/movie_db' });

const MOVIE_ID = 1;
const ROOMS = [1, 2, 3, 4];
const TIMES = [
  { start: '09:00:00', end: '11:15:00' },
  { start: '12:30:00', end: '14:45:00' },
  { start: '16:00:00', end: '18:15:00' },
  { start: '19:30:00', end: '21:45:00' }
];

client.connect().then(async () => {
  try {
    await client.query('BEGIN');
    
    console.log(`Deleting existing showtimes for movie_id = ${MOVIE_ID}`);
    await client.query('DELETE FROM show_time WHERE movie_id = $1', [MOVIE_ID]);
    
    let showtimeCount = 0;
    
    // Generate for next 14 days
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const d = new Date();
      d.setDate(d.getDate() + dayOffset);
      
      // Skip Monday (day 1)
      if (d.getDay() === 1) continue;
      
      const dateStr = d.toISOString().split('T')[0];
      
      for (const roomId of ROOMS) {
        for (const time of TIMES) {
          await client.query(
            `INSERT INTO show_time (show_date, start_time, end_time, movie_id, cinema_room_id, update_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [dateStr, time.start, time.end, MOVIE_ID, roomId]
          );
          showtimeCount++;
        }
      }
    }
    
    await client.query('COMMIT');
    console.log(`Successfully inserted ${showtimeCount} showtimes.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding showtimes:', err);
  } finally {
    client.end();
  }
});
