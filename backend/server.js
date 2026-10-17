const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// ─── معالجة الأخطاء العالمية (Global Error Handling) ───────────────
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION! Shutting down...', err.name, err.message);
  process.exit(1);
});

/**
 * التحقق من وجود متغيرات البيئة الأساسية لضمان عمل النظام
 */
function validateEnv() {
  const required = ['JWT_SECRET', 'PG_HOST', 'PG_PORT', 'PG_USER', 'PG_PASSWORD', 'PG_DB'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ خطأ في الإعداد: متغيرات البيئة التالية مفقودة: ${missing.join(', ')}`);
    if (process.env.NODE_ENV === 'production') process.exit(1);
  }
}

validateEnv();

const app = express();

// ─── الأمان ومعدل الطلبات (Security & Rate Limiting) ───────────────
app.use(helmet());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 300, // 300 طلب لكل 15 دقيقة
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'تم تجاوز عدد الطلبات المسموح به، يرجى المحاولة لاحقاً' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // 15 محاولة دخول لكل 15 دقيقة
  message: { success: false, message: 'محاولات دخول كثيرة جداً، يرجى المحاولة بعد 15 دقيقة' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);

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
  try {
    await connectDB();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 الخادم يعمل على جميع الشبكات على المنفذ ${PORT}`);
      console.log(`🔗 محلياً: http://localhost:${PORT}`);
      console.log(`🔗 للشبكة: http://${networkIp}:${PORT}`);
    });

    // معالجة الـ Rejections غير المعالجة لضمان ثبات السيرفر
    process.on('unhandledRejection', (err) => {
      console.error('🔥 UNHANDLED REJECTION! Shutting down gracefully...', err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });
  } catch (error) {
    console.error('❌ فشل بدء تشغيل الخادم:', error.message);
    process.exit(1);
  }
}

startServer();

// ✅ System launched and migrated to PostgreSQL