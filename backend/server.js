const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'Yes' : 'No');
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// الاتصال بقاعدة البيانات (Sequelize)
connectDB();

const app = express();

// ─── Middleware ───────────────────────────────────────────────────
app.use(cors());
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

// مسار التحقق من الخادم
app.get('/', (req, res) => {
  res.json({ message: '✅ خادم نظام متابعة التحصيل يعمل بنجاح' });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 الخادم يعمل على جميع الشبكات على المنفذ ${PORT}`);
  console.log(`🔗 محلياً: http://localhost:${PORT}`);
  console.log(`🔗 للشبكة: http://${networkIp}:${PORT}`);
});

// ✅ System launched and migrated to PostgreSQL