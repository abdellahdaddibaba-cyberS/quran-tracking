const { Sequelize } = require('sequelize');

/**
 * تهيئة Sequelize للاتصال بقاعدة بيانات PostgreSQL
 */
const nodeEnv = (process.env.NODE_ENV || 'development').trim();
const isProduction = nodeEnv === 'production';
// SSL فقط عند الحاجة (Render/Supabase): PG_SSL=true — وليس تلقائياً مع production
const useSsl = process.env.PG_SSL === 'true' || process.env.PG_SSL === '1';

const sequelize = new Sequelize(
  String(process.env.PG_DB),
  String(process.env.PG_USER),
  String(process.env.PG_PASSWORD),
  {
    host: String(process.env.PG_HOST),
    port: process.env.PG_PORT,
    dialect: 'postgres',
    logging: nodeEnv === 'development' ? console.log : false,
    dialectOptions: useSsl ? {
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
    
    // المزامنة: بدون alter افتراضياً (أكثر أماناً). لتفعيل alter في التطوير: PG_SYNC_ALTER=true
    const useAlter = !isProduction && (process.env.PG_SYNC_ALTER === 'true' || process.env.PG_SYNC_ALTER === '1');
    const syncOptions = useAlter ? { alter: true } : {};
    await sequelize.sync(syncOptions);
    console.log(
      isProduction
        ? '✅ تم مزامنة الجداول (وضع الإنتاج — بدون alter)'
        : useAlter
          ? '✅ تم مزامنة الجداول (وضع التطوير — alter)'
          : '✅ تم مزامنة الجداول (وضع التطوير — بدون alter)'
    );
    
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
