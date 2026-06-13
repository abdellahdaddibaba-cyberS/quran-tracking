const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isDevOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/i.test(origin);

app.use(
  cors({
    origin(origin, callback) {
      // تطبيقات الموبايل و Postman لا ترسل Origin
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      if (isDevOrigin(origin)) return callback(null, true);
      if (corsOrigins.length === 0) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ─── Routes ───────────────────────────────────────────────────────
app.use('/api/halaqat',  require('./routes/halaqaRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/tracking', require('./routes/trackingRoutes'));
app.use('/api/reports',  require('./routes/reportRoutes'));
app.use('/api/ai',       require('./routes/aiRoutes'));
app.use('/api/auth',     require('./routes/authRoutes'));
app.use('/api/mobile',   require('./routes/mobileRoutes'));
app.use('/api/users',    require('./routes/userRoutes'));
app.use('/api/sync',     require('./routes/syncRoutes'));

// مسار التحقق من الخادم
app.get('/', (req, res) => {
  res.json({ message: '✅ خادم نظام متابعة التحصيل يعمل بنجاح' });
});

app.get('/api', (req, res) => {
  res.json({
    message: '✅ واجهة API تعمل — استخدم المسارات مثل /api/auth/login',
    ok: true,
  });
});

// ─── معالج الأخطاء (يجب أن يكون آخر middleware) ──────────────────
app.use(errorHandler);

// ─── تشغيل الخادم ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const os = require('os');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wireless') || name.toLowerCase().includes('ethernet') || name.toLowerCase().includes('wlan')) {
          return iface.address;
        }
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const networkIp = getLocalIpAddress();

async function startServer() {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 الخادم يعمل على جميع الشبكات على المنفذ ${PORT}`);
    console.log(`🔗 محلياً: http://localhost:${PORT}`);
    console.log(`🔗 للشبكة: http://${networkIp}:${PORT}`);
  });
}

startServer();

// ✅ System launched and migrated to PostgreSQL