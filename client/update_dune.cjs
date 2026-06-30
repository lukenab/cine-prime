const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:123456@localhost:5433/movie_db' });
client.connect().then(async () => {
  try {
    await client.query(`
      UPDATE movie SET
        movie_name_vn = 'Dune: Hành Tinh Cát',
        movie_name_english = 'Dune: Part Two',
        director = 'Denis Villeneuve',
        actor = 'Timothée Chalamet',
        duration = 161,
        content = 'Paul Atreides continues his journey...',
        movie_production_company = 'Legendary',
        large_image = 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa',
        small_image = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'
      WHERE movie_id = 1
    `);
    
    await client.query('DELETE FROM movie WHERE movie_id = 2');
    
    console.log('Successfully updated movie 1 to Dune and deleted movie 2');
  } catch(e) {
    console.error(e);
  } finally {
    client.end();
  }
});
