/**
 * معالج الأخطاء المركزي
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // --- أخطاء Sequelize (PostgreSQL) ---

  // أخطاء التحقق من البيانات (Sequelize Validation Error)
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = err.errors.map((e) => e.message).join(', ');
  }

  // أخطاء تكرار المفاتيح الفريدة (Sequelize Unique Constraint Error)
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    const fields = err.errors.map(e => e.path);
    if (fields.includes('username')) {
      message = 'اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم آخر';
    } else {
      message = 'هذه البيانات مسجلة مسبقاً';
    }
  }

  // أخطاء قاعدة البيانات العامة
  if (err.name === 'SequelizeDatabaseError') {
    console.error('🔥 Sequelize Database Error:', err.message);
    if (process.env.NODE_ENV === 'production') {
      message = 'حدث خطأ تقني في قاعدة البيانات';
    }
  }

  // --- أخطاء التحقق من الهوية (JWT) ---
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'رمز الوصول (Token) غير صالح';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً';
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;
