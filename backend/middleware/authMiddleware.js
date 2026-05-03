const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * حماية المسارات والتحقق من التوكن
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // الحصول على التوكن من الهيدر
      token = req.headers.authorization.split(' ')[1];

      // فك التوكن
      const secret = process.env.JWT_SECRET || 'development_secret_fallback';
      const decoded = jwt.verify(token, secret);

      // جلب بيانات المستخدم من التوكن (بدون كلمة المرور)
      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (!req.user) {
        return res.status(401).json({ success: false, message: 'المستخدم غير موجود' });
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ success: false, message: 'غير مصرح لك، التوكن غير صالح' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'غير مصرح لك، لا يوجد توكن' });
  }
};

/**
 * التحقق من صلاحيات الأدمن
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'غير مسموح، صلاحيات الأدمن مطلوبة' });
  }
};

module.exports = { protect, adminOnly };
