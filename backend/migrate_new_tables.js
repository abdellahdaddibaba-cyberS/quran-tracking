/**
 * سكربت ترحيل — ينشئ الجداول الجديدة في قاعدة بيانات Supabase (الإنتاج)
 * تشغيل مرة واحدة فقط: node migrate_new_tables.js
 */
require('dotenv').config();
const { Client } = require('pg');

async function migrate() {
  const supabaseUrl = process.env.SUPABASE_DB_URL;
  if (!supabaseUrl) {
    console.error('❌ SUPABASE_DB_URL غير موجود في .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ متصل بـ Supabase');

    // 1. إنشاء جدول feedbacks
    await client.query(`
      CREATE TABLE IF NOT EXISTS "feedbacks" (
        "_id"        SERIAL PRIMARY KEY,
        "userId"     INTEGER NOT NULL,
        "type"       VARCHAR(255) NOT NULL,
        "message"    TEXT NOT NULL,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ جدول feedbacks جاهز');

    // 2. إنشاء جدول swimming_schedules
    await client.query(`
      CREATE TABLE IF NOT EXISTS "swimming_schedules" (
        "_id"        SERIAL PRIMARY KEY,
        "studentId"  INTEGER NOT NULL,
        "date"       DATE NOT NULL,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE("studentId", "date")
      );
    `);
    console.log('✅ جدول swimming_schedules جاهز');

    // 3. إنشاء فهارس لتحسين الأداء
    await client.query(`CREATE INDEX IF NOT EXISTS "feedbacks_userId" ON "feedbacks" ("userId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "swimming_schedules_date" ON "swimming_schedules" ("date");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "swimming_schedules_studentId" ON "swimming_schedules" ("studentId");`);
    console.log('✅ الفهارس جاهزة');

    console.log('\n🎉 انتهى الترحيل بنجاح! يمكنك الآن إعادة تشغيل الخادم.');
  } catch (err) {
    console.error('❌ خطأ أثناء الترحيل:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

migrate();
