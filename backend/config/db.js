const { Sequelize } = require('sequelize');

/**
 * تهيئة Sequelize للاتصال بقاعدة بيانات PostgreSQL
 */
const sequelize = new Sequelize(
  String(process.env.PG_DB),
  String(process.env.PG_USER),
  String(process.env.PG_PASSWORD),
  {
    host: String(process.env.PG_HOST),
    port: process.env.PG_PORT,
    dialect: 'postgres',
    logging: false, // تعيينه إلى console.log لمشاهدة استعلامات SQL
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL متصل بنجاح باستخدام Sequelize');
    
    // مزامنة النماذج (إنشاء الجداول إذا لم تكن موجودة)
    // في الإنتاج، يفضل استخدام migrations
    await sequelize.sync({ alter: true });
    console.log('✅ تم مزامنة جميع الجداول بنجاح');
  } catch (error) {
    console.error('❌ تعذر الاتصال بـ PostgreSQL:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
