/**
 * سكربت ترحيل — إضافة عمود likes لجدول feedbacks
 * node migrate_feedback_likes.js
 */
require('dotenv').config();
const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ متصل بـ Supabase');

    // إضافة عمود likes لجدول feedbacks إن لم يكن موجوداً
    await client.query(`ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;`);
    console.log('✅ عمود likes أُضيف لجدول feedbacks');

    console.log('\n🎉 انتهى الترحيل بنجاح!');
  } catch (err) {
    console.error('❌ خطأ:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

migrate();
