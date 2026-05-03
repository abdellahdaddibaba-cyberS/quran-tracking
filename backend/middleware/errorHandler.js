/**
 * معالج الأخطاء المركزي
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // خطأ Mongoose — معرّف غير صالح
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'المورد المطلوب غير موجود';
  }

  // خطأ تكرار المفتاح الفريد
  if (err.code === 11000) {
    statusCode = 400;
    message = 'هذه البيانات مسجلة مسبقاً';
  }

  // أخطاء التحقق من Mongoose
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;
