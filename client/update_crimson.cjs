const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:123456@localhost:5433/movie_db' });
client.connect().then(async () => {
  try {
    const richContent = 'Khi một loạt các vụ mất tích bí ẩn xảy ra tại một thị trấn nhỏ sương mù, thám tử tài ba Elias phải dấn thân vào một cuộc điều tra đầy rẫy hiểm nguy. Càng đi sâu vào bóng tối, anh càng phát hiện ra những bí mật kinh hoàng về một giáo phái cổ xưa đang âm thầm thao túng tất cả. Sự thật dần hé lộ dưới bức màn đêm đỏ thẫm, đẩy anh vào ranh giới mong manh giữa sự sống và cái chết. Một kiệt tác giật gân, bí ẩn không thể bỏ qua.';
    await client.query('UPDATE movie SET content = $1, director = $2, actor = $3, movie_production_company = $4 WHERE movie_id = 3', 
    [richContent, 'David Fincher', 'Anya Taylor-Joy, Cillian Murphy, Florence Pugh', 'A24, Legendary Pictures']);
    console.log('Successfully updated details for movie 3');
  } catch(e) {
    console.error(e);
  } finally {
    client.end();
  }
});
