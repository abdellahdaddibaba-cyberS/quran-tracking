const { Sequelize } = require('sequelize');

/**
 * تهيئة Sequelize للاتصال بقاعدة بيانات PostgreSQL
 */
const isProduction = process.env.NODE_ENV === 'production';

const sequelize = new Sequelize(
  String(process.env.PG_DB),
  String(process.env.PG_USER),
  String(process.env.PG_PASSWORD),
  {
    host: String(process.env.PG_HOST),
    port: process.env.PG_PORT,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: isProduction ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {},
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL متصل بنجاح باستخدام Sequelize');
    
    // تسجيل النماذج قبل المزامنة
    require('../models/User');
    require('../models/Halaqa');
    require('../models/Student');
    require('../models/DailyTracking');
    require('../models/Prize');
    require('../models/LoginLog');
    
    // مزامنة النماذج (إنشاء الجداول إذا لم تكن موجودة)
    // في الإنتاج، يفضل استخدام migrations
    await sequelize.sync({ alter: true });
    console.log('✅ تم مزامنة جميع الجداول بنجاح');
    
    // التأكد من وجود الفهارس الهامة لتحسين الأداء
    await sequelize.query('CREATE INDEX IF NOT EXISTS "students_halaqaId" ON "students" ("halaqaId");');
    await sequelize.query('CREATE INDEX IF NOT EXISTS "students_parentId" ON "students" ("parentId");');
    await sequelize.query('CREATE INDEX IF NOT EXISTS "prizes_studentId" ON "prizes" ("studentId");');
    console.log('⚡ تم التأكد من تهيئة الفهارس (Indexes) بنجاح');
  } catch (error) {
    console.error('❌ تعذر الاتصال بـ PostgreSQL:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
