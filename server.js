const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'kaisoul_secret_key_2026';
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

// Khởi tạo Database SQLite
(async () => {
  db = await open({
    filename: './kaisoul.db',
    driver: sqlite3.Database
  });

  // Tạo bảng lưu Người dùng và Tin nhắn
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT,
      message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
})();

// === API ĐĂNG KÝ ===
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin!' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    res.json({ message: 'Đăng ký tài khoản thành công!' });
  } catch (err) {
    res.status(400).json({ error: 'Tên tài khoản đã tồn tại!' });
  }
});

// === API ĐĂNG NHẬP ===
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng!' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

// === API LẤY LỊCH SỬ TIN NHẮN ===
app.get('/api/messages', async (req, res) => {
  const messages = await db.all('SELECT sender, message, strftime("%H:%M", timestamp, "localtime") as time FROM messages ORDER BY id ASC LIMIT 50');
  res.json(messages);
});

// === XỬ LÝ SOCKET.IO ===
io.on('connection', (socket) => {
  socket.on('send_message', async (data) => {
    // Lưu tin nhắn vào Database
    await db.run('INSERT INTO messages (sender, message) VALUES (?, ?)', [data.sender, data.message]);

    io.emit('receive_message', {
      sender: data.sender,
      message: data.message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Kaisoul đang chạy tại: http://localhost:${PORT}`);
});
