const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * JWT secret: required in production; dev fallback only when NODE_ENV is not production.
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return 'development_secret_fallback';
}

/**
 * حماية المسارات والتحقق من التوكن
 */
const protect = async (req, res, next) => {
  if (!req.headers.authorization?.startsWith('Bearer')) {
    return res.status(401).json({ success: false, message: 'غير مصرح لك، لا يوجد توكن' });
  }

  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret());

    req.user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (req.user.isActive === false) {
      return res.status(401).json({ success: false, message: 'الحساب معطّل' });
    }

    next();
  } catch (error) {
    if (error.message === 'JWT_SECRET must be set in production') {
      console.error(error.message);
      return res.status(500).json({ success: false, message: 'خطأ في إعداد الخادم' });
    }
    console.error(error);
    return res.status(401).json({ success: false, message: 'غير مصرح لك، التوكن غير صالح' });
  }
};

/**
 * التحقق من صلاحيات الأدمن
 */
const adminOnly = (req, res, next) => {
  if (req.user?.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'غير مسموح، صلاحيات الأدمن مطلوبة' });
};

/**
 * المشرفون والمعلمون (إدخال يومي، تقارير، إدارة)
 */
const staffOnly = (req, res, next) => {
  if (req.user && ['admin', 'teacher'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'غير مسموح، صلاحيات المشرف مطلوبة' });
};

/**
 * مسارات تطبيق ولي الأمر
 */
const parentOnly = (req, res, next) => {
  if (req.user?.role === 'parent') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'غير مسموح، حساب ولي أمر مطلوب' });
};

module.exports = { protect, adminOnly, staffOnly, parentOnly, getJwtSecret };
