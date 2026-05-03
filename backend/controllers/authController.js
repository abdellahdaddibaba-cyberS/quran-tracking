const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const jwt = require('jsonwebtoken');

/**
 * توليد توكن JWT
 */
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    console.error('❌ CRITICAL ERROR: JWT_SECRET is not defined in environment variables!');
    // Fallback for development ONLY - better to fail than crash if user is testing
    // But jwt.sign WILL crash if secret is empty.
    return jwt.sign({ id }, 'development_secret_fallback', {
      expiresIn: '30d',
    });
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

/**
 * تسجيل الدخول
 */
const login = async (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  try {
    // البحث عن المستخدم
    const user = await User.findOne({ where: { username } });

    // التحقق من وجود المستخدم وكلمة المرور
    if (user && (await user.comparePassword(password))) {
      // تسجيل في السجل
      await LoginLog.create({
        username: username,
        status: 'success',
        ipAddress: ip,
        userAgent: userAgent
      });

      res.json({
        success: true,
        data: {
          _id: user._id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          token: generateToken(user._id)
        }
      });
    } else {
      // تسجيل محاولة فاشلة
      await LoginLog.create({
        username: username || 'unknown',
        status: 'failed',
        ipAddress: ip,
        userAgent: userAgent
      });

      res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * جلب بيانات المستخدم الحالي (Profile)
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user._id, {
      attributes: { exclude: ['password'] }
    });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * جلب سجلات تسجيل الدخول (للأدمن فقط)
 */
const getLoginLogs = async (req, res) => {
  try {
    const logs = await LoginLog.findAll({
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { login, getMe, getLoginLogs };
