/**
 * Чат@Mail.Ru - Node.js Backend Server
 * 
 * Хранит все данные исключительно в зашифрованном виде в файле chat_data.txt (AES-256).
 * Защита от спама (флуд-контроль, дубликаты, кулдаун, автомут).
 * Скрытая админка для ynd | yndchatadmin2010!!
 * Не требует внешних npm пакетов.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const ChatCrypto = require('./assets/js/chat_crypto');

const PORT = process.env.PORT || 8080;
const DB_FILE = path.resolve(__dirname, 'chat_data.txt');
const ADMIN_USER = 'ynd';
const ADMIN_PASS = 'yndchatadmin2010!!';

// In-memory cache of decrypted DB for fast operations
let chatDb = null;
let lastMessageId = 0;

// Anti-spam tracker per IP / Client
// ip -> { lastMsgTime, msgTimestamps: [], lastText: '', strikes: 0 }
const spamTracker = new Map();

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const encrypted = fs.readFileSync(DB_FILE, 'utf8');
      const decrypted = ChatCrypto.decrypt(encrypted, ADMIN_PASS);
      chatDb = JSON.parse(decrypted);
      console.log('[DB] Зашифрованная база chat_data.txt успешно загружена и расшифрована.');
    } catch (e) {
      console.error('[DB] Ошибка расшифровки chat_data.txt:', e.message);
      chatDb = createDefaultDb();
      saveDatabase();
    }
  } else {
    chatDb = createDefaultDb();
    saveDatabase();
  }

  // Calculate highest message ID
  if (chatDb.messages && chatDb.messages.length > 0) {
    lastMessageId = Math.max(...chatDb.messages.map(m => m.id || 0));
  } else {
    lastMessageId = 0;
  }
}

function saveDatabase() {
  try {
    chatDb.updated_at = new Date().toISOString();
    const encrypted = ChatCrypto.encrypt(chatDb, ADMIN_PASS);
    fs.writeFileSync(DB_FILE, encrypted, 'utf8');
  } catch (e) {
    console.error('[DB] Ошибка сохранения зашифрованного chat_data.txt:', e.message);
  }
}

function createDefaultDb() {
  return {
    version: '1.0',
    title: 'Чат@Mail.Ru',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rooms: [
      { id: 'general', name: 'Беседка', desc: 'Основная комната для свободного общения' },
      { id: 'flirt', name: 'Знакомства и флирт', desc: 'Поиск друзей, знакомства и романтика' },
      { id: 'music', name: 'Музыка и Кино', desc: 'Обсуждение новинок, ретро-музыки и фильмов' },
      { id: 'tech', name: 'Hi-Tech и Игры', desc: 'Компьютеры, старые телефоны и ретро-софт' }
    ],
    messages: [
      {
        id: 1,
        room: 'general',
        author: 'Система',
        to: '',
        text: 'Добро пожаловать в исторический Чат@Mail.Ru образца 2010 года! Соблюдайте правила приличия.',
        color: '#00468c',
        time: '12:00:00',
        is_system: true,
        is_admin: false,
        is_private: false
      },
      {
        id: 2,
        room: 'general',
        author: 'ynd',
        to: '',
        text: 'Всем привет! Чат полностью восстановлен по канонам 2010 года. Приятного общения :)',
        color: '#d90000',
        time: '12:01:23',
        is_system: false,
        is_admin: true,
        is_private: false
      }
    ],
    banned_users: [],
    muted_users: {},
    settings: {
      cooldown_seconds: 2.5,
      max_msg_per_10s: 4,
      auto_mute_seconds: 60,
      max_length: 350
    }
  };
}

// Anti-spam validation function
function checkSpam(ip, author, text, isAdmin) {
  if (isAdmin) return { ok: true };

  const now = Date.now();

  // 1. Check if user is permanently banned
  if (chatDb.banned_users.includes(author.toLowerCase()) || chatDb.banned_users.includes(ip)) {
    return { ok: false, error: 'Вы заблокированы в чате администратором.' };
  }

  // 2. Check if user is currently muted
  if (chatDb.muted_users && chatDb.muted_users[author.toLowerCase()]) {
    const unmutAt = chatDb.muted_users[author.toLowerCase()];
    if (now < unmutAt) {
      const remaining = Math.ceil((unmutAt - now) / 1000);
      return { ok: false, error: `Вы временно заблокированы за спам. Осталось: ${remaining} сек.` };
    } else {
      delete chatDb.muted_users[author.toLowerCase()];
    }
  }

  // 3. Track client rate
  let st = spamTracker.get(ip);
  if (!st) {
    st = { lastMsgTime: 0, msgTimestamps: [], lastText: '', strikes: 0 };
    spamTracker.set(ip, st);
  }

  const cooldownMs = (chatDb.settings.cooldown_seconds || 2.5) * 1000;

  // Check cooldown
  if (now - st.lastMsgTime < cooldownMs) {
    st.strikes++;
    const waitSec = ((cooldownMs - (now - st.lastMsgTime)) / 1000).toFixed(1);
    if (st.strikes >= 3) {
      autoMute(author, ip);
      return { ok: false, error: 'Слишком частые сообщения! Вы получили временный мут на 60 сек.' };
    }
    return { ok: false, error: `Подождите ещё ${waitSec} сек. перед отправкой (защита от флуда)!` };
  }

  // Check duplicate
  if (st.lastText && st.lastText.trim().toLowerCase() === text.trim().toLowerCase()) {
    st.strikes++;
    if (st.strikes >= 3) {
      autoMute(author, ip);
      return { ok: false, error: 'Повтор сообщений запрещён! Вы получили временный мут на 60 сек.' };
    }
    return { ok: false, error: 'Повторяющиеся сообщения запрещены (защита от спама)!' };
  }

  // Check message frequency (max 4 per 10s)
  st.msgTimestamps = st.msgTimestamps.filter(t => now - t < 10000);
  if (st.msgTimestamps.length >= (chatDb.settings.max_msg_per_10s || 4)) {
    st.strikes++;
    if (st.strikes >= 3) {
      autoMute(author, ip);
      return { ok: false, error: 'Флуд запрещён! Вы получили временный мут на 60 сек.' };
    }
    return { ok: false, error: 'Слишком много сообщений за короткое время! Сделайте паузу.' };
  }

  // Check CAPS LOCK (>70% uppercase if len > 6)
  const lettersOnly = text.replace(/[^а-яА-Яa-zA-Z]/g, '');
  if (lettersOnly.length > 6) {
    const caps = lettersOnly.split('').filter(c => c === c.toUpperCase() && c !== c.toLowerCase()).length;
    if (caps / lettersOnly.length > 0.75) {
      return { ok: false, error: 'Пожалуйста, отключите Caps Lock (кричать в чате запрещено)!' };
    }
  }

  // Update spam tracker state
  st.lastMsgTime = now;
  st.lastText = text;
  st.msgTimestamps.push(now);

  return { ok: true };
}

function autoMute(author, ip) {
  const muteUntil = Date.now() + ((chatDb.settings.auto_mute_seconds || 60) * 1000);
  if (!chatDb.muted_users) chatDb.muted_users = {};
  chatDb.muted_users[author.toLowerCase()] = muteUntil;

  // Add system message about mute
  lastMessageId++;
  const sysMsg = {
    id: lastMessageId,
    room: 'general',
    author: 'Система',
    to: '',
    text: `Пользователь [${author}] временно лишён слова на 60 сек за спам/флуд.`,
    color: '#cc0000',
    time: formatTime(new Date()),
    is_system: true,
    is_admin: false,
    is_private: false
  };
  chatDb.messages.push(sysMsg);
  saveDatabase();
}

function formatTime(d) {
  const pad = n => (n < 10 ? '0' : '') + n;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Request dispatcher
function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Enable CORS for universal frontend interaction
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // --- API: Get Chat State ---
  if (pathname === '/api/chat/state') {
    const room = parsedUrl.query.room || 'general';
    const sinceId = parseInt(parsedUrl.query.since_id || '0', 10);
    const viewer = (parsedUrl.query.viewer || '').toLowerCase();

    // Filter messages for privacy & room
    const filtered = chatDb.messages.filter(m => {
      if (m.room && m.room !== room && m.room !== 'all') return false;
      if (m.id <= sinceId) return false;
      if (m.is_private) {
        const auth = (m.author || '').toLowerCase();
        const to = (m.to || '').toLowerCase();
        if (viewer !== auth && viewer !== to && viewer !== ADMIN_USER.toLowerCase()) {
          return false;
        }
      }
      return true;
    });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: true,
      rooms: chatDb.rooms,
      messages: filtered.slice(-100),
      last_id: lastMessageId,
      server_time: formatTime(new Date()),
      cooldown: chatDb.settings.cooldown_seconds || 2.5
    }));
    return;
  }

  // --- API: Send Message ---
  if (pathname === '/api/chat/send' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const author = (data.author || 'Гость').trim().substring(0, 24);
        const text = (data.text || '').trim();
        const room = data.room || 'general';
        const to = (data.to || '').trim();
        const isPrivate = !!data.is_private;
        const color = data.color || '#000000';
        const clientAdminToken = data.admin_token;

        const isAdmin = (clientAdminToken === ADMIN_PASS && author === ADMIN_USER);

        if (!text) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Пустое сообщение' }));
          return;
        }

        // Check if user is impersonating admin without credentials
        if (author.toLowerCase() === ADMIN_USER.toLowerCase() && !isAdmin) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Имя ynd зарезервировано за Администратором' }));
          return;
        }

        const ip = getClientIp(req);
        const spamCheck = checkSpam(ip, author, text, isAdmin);
        if (!spamCheck.ok) {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: spamCheck.error }));
          return;
        }

        // Limit message length
        const maxLen = chatDb.settings.max_length || 350;
        const cleanText = text.substring(0, maxLen);

        lastMessageId++;
        const newMsg = {
          id: lastMessageId,
          room: room,
          author: author,
          to: to,
          text: cleanText,
          color: color,
          time: formatTime(new Date()),
          is_system: false,
          is_admin: isAdmin,
          is_private: isPrivate
        };

        chatDb.messages.push(newMsg);
        // Keep max 250 in-memory messages to prevent bloat
        if (chatDb.messages.length > 250) {
          chatDb.messages = chatDb.messages.slice(-200);
        }

        saveDatabase();

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: newMsg }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Ошибка сервера: ' + err.message }));
      }
    });
    return;
  }

  // --- API: Admin Actions ---
  if (pathname === '/api/chat/admin' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const u = data.username;
        const p = data.password;

        if (u !== ADMIN_USER || p !== ADMIN_PASS) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Неверные данные администратора' }));
          return;
        }

        const action = data.action;
        const payload = data.payload || {};

        if (action === 'login') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, isAdmin: true, username: ADMIN_USER }));
          return;
        }

        if (action === 'delete_message') {
          const msgId = parseInt(payload.id, 10);
          chatDb.messages = chatDb.messages.filter(m => m.id !== msgId);
          saveDatabase();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, deleted_id: msgId }));
          return;
        }

        if (action === 'clear_room') {
          const r = payload.room || 'general';
          chatDb.messages = chatDb.messages.filter(m => m.room !== r);
          lastMessageId++;
          chatDb.messages.push({
            id: lastMessageId,
            room: r,
            author: 'Система',
            to: '',
            text: 'Чат комнаты очищен администратором ynd.',
            color: '#cc0000',
            time: formatTime(new Date()),
            is_system: true,
            is_admin: true,
            is_private: false
          });
          saveDatabase();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (action === 'ban_user') {
          const target = (payload.user || '').toLowerCase().trim();
          if (target && !chatDb.banned_users.includes(target)) {
            chatDb.banned_users.push(target);
            saveDatabase();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, banned: chatDb.banned_users }));
          return;
        }

        if (action === 'unban_user') {
          const target = (payload.user || '').toLowerCase().trim();
          chatDb.banned_users = chatDb.banned_users.filter(u => u !== target);
          saveDatabase();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, banned: chatDb.banned_users }));
          return;
        }

        if (action === 'mute_user') {
          const target = (payload.user || '').toLowerCase().trim();
          const minutes = parseInt(payload.minutes || '5', 10);
          if (target) {
            chatDb.muted_users[target] = Date.now() + (minutes * 60 * 1000);
            saveDatabase();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, muted: chatDb.muted_users }));
          return;
        }

        if (action === 'announce') {
          const text = (payload.text || '').trim();
          if (text) {
            lastMessageId++;
            chatDb.messages.push({
              id: lastMessageId,
              room: payload.room || 'general',
              author: 'СИСТЕМА (Оповещение)',
              to: '',
              text: '📢 ' + text,
              color: '#d90000',
              time: formatTime(new Date()),
              is_system: true,
              is_admin: true,
              is_private: false
            });
            saveDatabase();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (action === 'get_raw_file') {
          const raw = fs.readFileSync(DB_FILE, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            raw_encrypted: raw,
            decrypted_json: chatDb
          }));
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестное действие' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- Serve raw encrypted chat_data.txt ---
  if (pathname === '/chat_data.txt') {
    if (fs.existsSync(DB_FILE)) {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'inline; filename="chat_data.txt"'
      });
      fs.createReadStream(DB_FILE).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Файл базы данных не найден');
    }
    return;
  }

  // --- Static File Server ---
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  // Prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.ico': 'image/x-icon',
      '.txt': 'text/plain; charset=utf-8',
      '.apk': 'application/vnd.android.package-archive'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

// Initialize DB and launch server
loadDatabase();
const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`[Чат@Mail.Ru Server] Запущен на порту ${PORT}`);
  console.log(`Адрес: http://localhost:${PORT}/chat.html`);
  console.log(`Файл зашифрованной базы: ${DB_FILE}`);
  console.log(`====================================================`);
});
