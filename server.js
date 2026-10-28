// Máy chủ trung gian giữ khóa Gemini. Cần Node 18+.
//   npm i express
//   GEMINI_API_KEY=AIza... node server.js
// Đặt index.html (đã vá) vào thư mục public/ và thêm dòng này trước thẻ <script> chính:
//   <script>window.API_PROXY = '/api/analyze';</script>
const express = require('express');
const path = require('path');
const app = express();
app.use(express.json({ limit: '25mb' }));

// Phục vụ tệp tĩnh từ thư mục public/ nếu có, hoặc từ thư mục gốc
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const hits = new Map(); // giới hạn đơn giản: 10 lượt / 10 phút / IP
app.post('/api/analyze', async (req, res) => {
  const now = Date.now();
  const recent = (hits.get(req.ip) || []).filter(t => now - t < 10 * 60 * 1000);
  if (recent.length >= 10) return res.status(429).json({ error: { message: 'Bạn thử quá nhiều lần, hãy quay lại sau ít phút.' } });
  hits.set(req.ip, [...recent, now]);

  // TODO: kiểm tra đăng nhập thật (session/JWT) tại đây trước khi gọi AI.
  const { contents, generationConfig } = req.body || {};
  if (!Array.isArray(contents)) return res.status(400).json({ error: { message: 'Yêu cầu không hợp lệ' } });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'Máy chủ chưa cấu hình GEMINI_API_KEY. Hãy đặt biến môi trường GEMINI_API_KEY trước khi khởi động server.' } });
  }

  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents, generationConfig }) // chỉ chuyển tiếp 2 trường này
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: { message: 'Không kết nối được máy chủ AI: ' + e.message } });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Study Arena Server đang chạy tại: http://localhost:${PORT}`));
