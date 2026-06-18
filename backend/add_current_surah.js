/**
 * سكربت إضافة عمود currentSurah لجدول الطلاب محلياً وفي Supabase
 * تشغيل: node add_current_surah.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Client } = require('pg');

async function migrateLocal() {
  console.log('⏳ جاري تحديث قاعدة البيانات المحلية...');
  const localClient = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB,
  });

  try {
    await localClient.connect();
    console.log('✅ متصل بقاعدة البيانات المحلية');

    // إضافة العمود
    await localClient.query(`
      ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "currentSurah" VARCHAR(255);
    `);
    console.log('✅ عمود "currentSurah" مضاف أو موجود بالفعل محلياً.');

    // تحديث القيم الفارغة بـ بداية السورة
    const updateRes = await localClient.query(`
      UPDATE "students" 
      SET "currentSurah" = "startSurah" 
      WHERE "currentSurah" IS NULL OR "currentSurah" = '';
    `);
    console.log(`✅ تم تحديث ${updateRes.rowCount} طالب بقيم البداية محلياً.`);
  } catch (err) {
    console.error('❌ خطأ في قاعدة البيانات المحلية:', err.message);
  } finally {
    await localClient.end().catch(() => {});
  }
}

async function migrateSupabase() {
  const supabaseUrl = process.env.SUPABASE_DB_URL;
  if (!supabaseUrl) {
    console.warn('⚠️ SUPABASE_DB_URL غير موجود في .env. تم تخطي تحديث Supabase.');
    return;
  }

  console.log('⏳ جاري تحديث قاعدة بيانات Supabase...');
  const supabaseClient = new Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await supabaseClient.connect();
    console.log('✅ متصل بـ Supabase');

    // إضافة العمود
    await supabaseClient.query(`
      ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "currentSurah" VARCHAR(255);
    `);
    console.log('✅ عمود "currentSurah" مضاف أو موجود بالفعل في Supabase.');

    // تحديث القيم الفارغة بـ بداية السورة
    const updateRes = await supabaseClient.query(`
      UPDATE "students" 
      SET "currentSurah" = "startSurah" 
      WHERE "currentSurah" IS NULL OR "currentSurah" = '';
    `);
    console.log(`✅ تم تحديث ${updateRes.rowCount} طالب بقيم البداية في Supabase.`);
  } catch (err) {
    console.error('❌ خطأ في قاعدة بيانات Supabase:', err.message);
  } finally {
    await supabaseClient.end().catch(() => {});
  }
}

async function main() {
  await migrateLocal();
  console.log('----------------------------------------');
  await migrateSupabase();
  console.log('🎉 انتهت عملية الترحيل بنجاح!');
}

main();
