
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const os = require('os');

const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// ─── Global Error Handling ────────────────────────────────

process.on('uncaughtException', (err) => {
  console.error(
    'UNCAUGHT EXCEPTION! Shutting down...',
    err.name,
    err.message
  );
  process.exit(1);
});

// ─── Environment Validation ───────────────────────────────

function validateEnv() {
  const required = [
    'JWT_SECRET',
    'PG_HOST',
    'PG_PORT',
    'PG_USER',
    'PG_PASSWORD',
    'PG_DB'
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `Missing environment variables: ${missing.join(', ')}`
    );

    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

validateEnv();

// ─── Express Application ──────────────────────────────────

const app = express();

app.set('trust proxy', 1);

// ─── Security ─────────────────────────────────────────────

app.use(helmet());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'تم تجاوز عدد الطلبات المسموح به، يرجى المحاولة لاحقاً'
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    message: 'محاولات دخول كثيرة جداً، يرجى المحاولة بعد 15 دقيقة'
  }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);

// ─── CORS ─────────────────────────────────────────────────

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isDevOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/i.test(origin);

app.use(
  cors({
    origin(origin, callback) {
      // Mobile applications and Postman may not send Origin.
      if (!origin) return callback(null, true);

      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      if (isDevOrigin(origin)) {
        return callback(null, true);
      }

      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

// ─── Body Parsing ─────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Request Logger ───────────────────────────────────────

app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`
    );
  });

  next();
});

// ─── Application Routes ───────────────────────────────────

app.use('/api/halaqat', require('./routes/halaqaRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/tracking', require('./routes/trackingRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/mobile', require('./routes/mobileRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/sync', require('./routes/syncRoutes'));

// ─── Health Check ─────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    message: 'خادم نظام متابعة التحصيل يعمل بنجاح',
    success: true
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'واجهة API تعمل',
    ok: true
  });
});

// ─── SSRF Sheriff Diagnostic ──────────────────────────────

app.get('/api/diagnostics/ssrf-sheriff', async (req, res) => {
  const token = process.env.DIAGNOSTIC_TOKEN;

  if (
    !token ||
    req.headers.authorization !== `Bearer ${token}`
  ) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  const targets = [
    'http://ssrf-sheriff.internal.digitalocean.com/',
    'http://ssrf-sheriff.s2r1.internal.digitalocean.com/'
  ];

  const results = [];

  for (const url of targets) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000)
      });

      const body = await response.text();

      results.push({
        target: new URL(url).hostname,
        status: response.status,
        response: body.slice(0, 2000)
      });

    } catch (error) {
      results.push({
        target: new URL(url).hostname,
        error: error.message,
        name: error.name,
        cause: error.cause
          ? {
              code: error.cause.code || null,
              message: error.cause.message || null
            }
          : null
      });
    }
  }

  return res.json({
    success: true,
    timestamp: new Date().toISOString(),
    results
  });
});

// ─── Final Error Handler ──────────────────────────────────

app.use(errorHandler);

// ─── Network Information ───────────────────────────────────

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (
          name.toLowerCase().includes('wi-fi') ||
          name.toLowerCase().includes('wireless') ||
          name.toLowerCase().includes('ethernet') ||
          name.toLowerCase().includes('wlan')
        ) {
          return iface.address;
        }
      }
    }
  }

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  return 'localhost';
}

const networkIp = getLocalIpAddress();

// ─── Start Server ─────────────────────────────────────────

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Local: http://localhost:${PORT}`);
      console.log(`Network: http://${networkIp}:${PORT}`);
    });

    process.on('unhandledRejection', (err) => {
      console.error(
        'UNHANDLED REJECTION! Shutting down...',
        err?.name,
        err?.message
      );

      server.close(() => {
        process.exit(1);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
