const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:123456@localhost:5433/movie_db' });
client.connect().then(async () => {
  try {
    const richContent = 'Paul Atreides (Timothée Chalamet) continues his epic journey alongside Chani (Zendaya) và người Fremen để trả thù những kẻ đã hủy hoại gia đình anh. Đứng trước sự lựa chọn giữa tình yêu của đời mình và số phận của vũ trụ, anh phải cố gắng ngăn chặn một tương lai tồi tệ mà chỉ mình anh mới có thể nhìn thấy. Một kiệt tác điện ảnh không thể bỏ lỡ của đạo diễn Denis Villeneuve.';
    await client.query('UPDATE movie SET content = $1 WHERE movie_id = 1', [richContent]);
    console.log('Successfully updated content for movie 1');
  } catch(e) {
    console.error(e);
  } finally {
    client.end();
  }
});
